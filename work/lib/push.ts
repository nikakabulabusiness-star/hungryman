import {deliverWebPush,webPushConfig} from './web-push';
import {getSiteFeatures} from './site-controls-store';
import {systemGrants,threadEnabled} from './site-controls';
import {getPositions} from './positions';
import {hasPermission} from './permissions';
import {checkPushReceipts} from './push-receipts';
import {conversationPeople} from './chat-directory';
import {after} from 'next/server';
import {storage} from '@/lib/storage';
import {listApprovedStaff} from '@/lib/staff-access';

export function queuePush(id:string,thread:string,sender:string,title:string,body:string,callId:string|null=null){return storage().DB.prepare('INSERT OR IGNORE INTO push_outbox (id,conversation_id,sender,title,body,call_id,created) SELECT ?,?,?,?,?,?,? WHERE COALESCE((SELECT json_extract(value,\'$.notifications\') FROM workspace_settings WHERE key=\'site_features\'),1)!=0 AND NOT EXISTS(SELECT 1 FROM chat_deleted_conversations WHERE id=?)').bind(id,thread,sender,title.slice(0,100),body.slice(0,160),callId,Date.now(),thread)}
export function dispatchPush(){after(async()=>{try{await flushPush()}catch{console.error('push-delivery-retry-pending')}})}

/** Outbox claims serialize retries; per-device receipts prevent partial-batch duplicates. */
export async function flushPush(){
 const features=await getSiteFeatures();if(!features.notifications){await storage().DB.prepare('UPDATE push_outbox SET sent=? WHERE sent IS NULL OR sent<0').bind(Date.now()).run();return {examined:0}}
 await checkPushReceipts();
 const db=storage().DB,now=Date.now(),[staff,positions]=await Promise.all([listApprovedStaff(),getPositions()]),approved=new Map(staff.map(p=>[p.userId,{role:p.role,isSiteAdmin:p.isSiteAdmin,isDeveloper:p.role==='Developer',features,permissions:[...(positions.find(position=>position.name===p.role)?.permissions||[]),...(p.isSiteAdmin?systemGrants(p.systemPermissions||[]):[])]}]));
 const rows=await db.prepare('SELECT * FROM push_outbox WHERE (sent IS NULL OR (sent<0 AND sent>?)) AND attempts<4 AND created>? ORDER BY created LIMIT 15').bind(-(now-60000),now-3600000).all<{id:string;conversation_id:string;sender:string;title:string;body:string;call_id:string|null;attempts:number;created:number}>();
 const deadline=Date.now()+20000;let examined=0;
 for(const row of rows.results){
  if(Date.now()>deadline)break;examined++;
  if(!threadEnabled(row.conversation_id,features)||row.call_id&&!features.calls||await db.prepare('SELECT id FROM chat_deleted_conversations WHERE id=?').bind(row.conversation_id).first()||row.call_id&&(now-row.created>90000||!await db.prepare('SELECT id FROM chat_calls WHERE id=? AND ended IS NULL').bind(row.call_id).first())){await db.prepare('UPDATE push_outbox SET sent=? WHERE id=?').bind(now,row.id).run();continue}
  const claim=await db.prepare('UPDATE push_outbox SET attempts=attempts+1,sent=? WHERE id=? AND (sent IS NULL OR (sent<0 AND sent>?)) AND attempts=?').bind(-now,row.id,-(now-60000),row.attempts).run();if(!claim.meta.changes)continue;
  const memberIds=new Set((await conversationPeople(row.conversation_id)).map(p=>p.userId));
  const devices=await db.prepare(`SELECT token,user_id FROM push_devices WHERE user_id<>? AND updated>?
   AND NOT EXISTS(SELECT 1 FROM chat_hidden_threads h WHERE h.user_id=push_devices.user_id AND h.conversation_id=? AND h.cleared_before>=?)
   AND (NOT EXISTS (SELECT 1 FROM chat_preferences p WHERE p.user_id=push_devices.user_id AND p.conversation_id=? AND p.muted=1) OR EXISTS (SELECT 1 FROM chat_mentions m WHERE m.message_id=? AND m.user_id=push_devices.user_id))`).bind(row.sender,now-90*86400000,row.conversation_id,row.created,row.conversation_id,row.id).all<{token:string;user_id:string}>();
  const recipients=devices.results.filter(d=>hasPermission(approved.get(d.user_id),row.call_id?'chat.call':'chat.view')&&memberIds.has(d.user_id));
  for(let index=0;index<recipients.length;index+=50)await db.batch(recipients.slice(index,index+50).map(device=>db.prepare('INSERT INTO push_deliveries (message_id,token,user_id) VALUES (?,?,?) ON CONFLICT(message_id,token) DO UPDATE SET user_id=excluded.user_id,sent=NULL,attempts=0,ticket=NULL,receipt_checked=NULL,receipt_error=NULL WHERE push_deliveries.user_id<>excluded.user_id').bind(row.id,device.token,device.user_id)));
  const delivered=new Set((await db.prepare('SELECT token,user_id FROM push_deliveries WHERE message_id=? AND sent IS NOT NULL').bind(row.id).all<{token:string;user_id:string}>()).results.map(d=>d.token+':'+d.user_id));
  const pending=recipients.filter(device=>!delivered.has(device.token+':'+device.user_id));let successful=true;
  for(let index=0;index<pending.length;index+=100){
   const batch=pending.slice(index,index+100);
   try{
    const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(batch.map(d=>({to:d.token,title:row.title,body:row.body,sound:'default',priority:'high',channelId:row.call_id?'calls':'messages',ttl:row.call_id?90:3600,data:{conversationId:row.conversation_id,messageId:row.call_id?undefined:row.id,callId:row.call_id||undefined,recipientUserId:d.user_id}}))),signal:AbortSignal.timeout(10000)});
    if(!response.ok){successful=false;continue}
    const result=await response.json() as {data?:{status:string;id?:string;details?:{error:string}}[]};if(!Array.isArray(result.data)||result.data.length!==batch.length){successful=false;continue}
    for(let n=0;n<result.data.length;n++){
     const ticket=result.data[n],device=batch[n];
     if(ticket.status==='ok'||ticket.details?.error==='DeviceNotRegistered'){
      await db.prepare('UPDATE push_deliveries SET sent=?,ticket=?,attempts=attempts+1 WHERE message_id=? AND token=? AND user_id=?').bind(Date.now(),ticket.id||null,row.id,device.token,device.user_id).run();
      if(ticket.details?.error==='DeviceNotRegistered')await db.prepare('DELETE FROM push_devices WHERE token=? AND user_id=?').bind(device.token,device.user_id).run();
     }else successful=false;
    }
   }catch{successful=false}
  }
  if(webPushConfig().enabled){
   const browsers=(await db.prepare(`SELECT DISTINCT s.user_id FROM web_push_subscriptions s JOIN staff_sessions ss ON ss.token_hash=s.session_hash AND ss.user_id=s.user_id WHERE s.user_id<>? AND s.updated>? AND ss.expires>?
    AND NOT EXISTS(SELECT 1 FROM chat_hidden_threads h WHERE h.user_id=s.user_id AND h.conversation_id=? AND h.cleared_before>=?)
    AND (NOT EXISTS(SELECT 1 FROM chat_preferences p WHERE p.user_id=s.user_id AND p.conversation_id=? AND p.muted=1) OR EXISTS(SELECT 1 FROM chat_mentions m WHERE m.message_id=? AND m.user_id=s.user_id))`).bind(row.sender,now-90*86400000,now,row.conversation_id,row.created,row.conversation_id,row.id).all<{user_id:string}>()).results;
   const ids=browsers.filter(d=>hasPermission(approved.get(d.user_id),row.call_id?'chat.call':'chat.view')&&memberIds.has(d.user_id)).map(d=>d.user_id);
   if(!await deliverWebPush({id:'chat:'+row.id,href:'/chat?conversationId='+encodeURIComponent(row.conversation_id),kind:row.call_id?'call':'chat',ttl:row.call_id?90:3600},ids))successful=false;
  }
  await db.prepare('UPDATE push_outbox SET sent=? WHERE id=?').bind(successful?Date.now():null,row.id).run();
 }
 await db.prepare('DELETE FROM push_outbox WHERE created<?').bind(now-7*86400000).run();
 await db.prepare('DELETE FROM push_deliveries WHERE NOT EXISTS(SELECT 1 FROM push_outbox o WHERE o.id=push_deliveries.message_id)').run();
 return {examined};
}
