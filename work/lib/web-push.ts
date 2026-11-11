import {env} from 'cloudflare:workers';
import {storage} from './storage';
import {createWebPushRequest} from './web-push-crypto';
export type WebSubscription={endpoint:string;p256dh:string;auth:string};
export function webPushConfig(){const e=env as unknown as Record<string,string|undefined>;const publicKey=e.WORK_WEB_PUSH_PUBLIC_KEY||'',privateKey=e.WORK_WEB_PUSH_PRIVATE_KEY||'',subject=e.WORK_WEB_PUSH_SUBJECT||'';return {publicKey,privateKey,subject,enabled:!!publicKey&&!!privateKey&&/^(https:\/\/|mailto:)/.test(subject)}}
export function validPushEndpoint(endpoint:unknown):endpoint is string{
 if(typeof endpoint!=='string'||endpoint.length>2048)return false;
 try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==='443')&&((u.hostname==='fcm.googleapis.com'&&/^\/(fcm\/send|wp)\//.test(u.pathname))||(u.hostname==='updates.push.services.mozilla.com'&&u.pathname.startsWith('/wpush/'))||/^[a-z0-9-]+\.push\.apple\.com$/.test(u.hostname)||/^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname))}catch{return false}
}
function keyBytes(value:unknown,length:number){if(typeof value!=='string'||!/^[A-Za-z0-9_-]+={0,2}$/.test(value))return null;try{const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/'));return raw.length===length&&btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')===value.replace(/=+$/,'')?raw:null}catch{return null}}
export function validSubscription(v:unknown):v is WebSubscription{if(!v||typeof v!=='object')return false;const s=v as WebSubscription,key=keyBytes(s.p256dh,65);return validPushEndpoint(s.endpoint)&&!!key&&key.charCodeAt(0)===4&&!!keyBytes(s.auth,16)}
export type WebEvent={id:string;href:string;kind:'call'|'chat'|'work';ttl?:number};
/** Only generic text crosses into OS notifications; content stays behind account authorization. */
export async function deliverWebPush(event:WebEvent,userIds:readonly string[]){
 const config=webPushConfig();if(!config.enabled||!userIds.length)return true;
 const ids=[...new Set(userIds)];if(ids.length>90){let okay=true;for(let i=0;i<ids.length;i+=90)if(!await deliverWebPush(event,ids.slice(i,i+90)))okay=false;return okay}
 const db=storage().DB,now=Date.now(),marks=ids.map(()=>'?').join(',');
 type Device=WebSubscription&{id:string;user_id:string};
 const rows=(await db.prepare(`SELECT s.id,s.user_id,s.endpoint,s.p256dh,s.auth FROM web_push_subscriptions s JOIN staff_sessions ss ON ss.token_hash=s.session_hash AND ss.user_id=s.user_id WHERE s.user_id IN (${marks}) AND ss.expires>? AND s.updated>? AND NOT EXISTS(SELECT 1 FROM web_push_deliveries d WHERE d.event_id=? AND d.subscription_id=s.id AND (d.sent IS NOT NULL OR d.attempts>=4)) LIMIT 21`).bind(...ids,now,now-90*86400000,event.id).all<Device>()).results;
 let okay=rows.length<=20;
 for(let start=0;start<Math.min(rows.length,20);start+=5)await Promise.all(rows.slice(start,Math.min(start+5,20)).map(async device=>{
  if(!validSubscription(device as unknown)){await db.prepare('DELETE FROM web_push_subscriptions WHERE id=?').bind(device.id).run();return}
  await db.prepare('INSERT OR IGNORE INTO web_push_deliveries(event_id,subscription_id,created) VALUES(?,?,?)').bind(event.id,device.id,now).run();
  const claim=await db.prepare('UPDATE web_push_deliveries SET attempts=attempts+1,claimed=? WHERE event_id=? AND subscription_id=? AND sent IS NULL AND attempts<4 AND (claimed IS NULL OR claimed<?)').bind(now,event.id,device.id,now-60000).run();
  if(!claim.meta.changes){okay=false;return}
  // Recheck active session immediately before outbound delivery to close logout races.
  if(!await db.prepare('SELECT s.id FROM web_push_subscriptions s JOIN staff_sessions ss ON ss.token_hash=s.session_hash AND ss.user_id=s.user_id WHERE s.id=? AND ss.expires>?').bind(device.id,Date.now()).first())return;
  try{
   const encrypted=await createWebPushRequest(device,{title:'Hungryman Work',body:event.kind==='call'?'შემომავალი ზარი — გასახსნელად დააჭირე.':event.kind==='chat'?'გაქვს ახალი შეტყობინება.':'სამუშაო სივრცეში ახალი შეტყობინებაა.',href:event.href,recipientUserId:device.user_id,tag:event.id},config);
   const response=await fetch(device.endpoint,{method:'POST',headers:{...encrypted.headers,TTL:String(event.ttl??3600),Urgency:event.kind==='call'?'high':'normal'},body:encrypted.body as unknown as BodyInit,redirect:'error',signal:AbortSignal.timeout(5000)});
   if(response.ok||response.status===404||response.status===410){await db.prepare('UPDATE web_push_deliveries SET sent=? WHERE event_id=? AND subscription_id=?').bind(Date.now(),event.id,device.id).run();if(response.status===404||response.status===410)await db.prepare('DELETE FROM web_push_subscriptions WHERE id=?').bind(device.id).run()}
   else if([400,401,403,413].includes(response.status)){await db.prepare('UPDATE web_push_deliveries SET attempts=4 WHERE event_id=? AND subscription_id=?').bind(event.id,device.id).run()}
   else{okay=false;await db.prepare('UPDATE web_push_deliveries SET claimed=NULL WHERE event_id=? AND subscription_id=?').bind(event.id,device.id).run()}
  }catch{okay=false;await db.prepare('UPDATE web_push_deliveries SET claimed=NULL WHERE event_id=? AND subscription_id=?').bind(event.id,device.id).run()}
 }));
 await db.prepare('DELETE FROM web_push_deliveries WHERE created<?').bind(now-7*86400000).run();
 return okay;
}
