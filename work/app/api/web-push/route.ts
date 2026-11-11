import {getStaffAccess} from '@/lib/staff-access';
import {sameOrigin} from '@/lib/visitor';
import {storage} from '@/lib/storage';
import {hashSessionToken,STAFF_SESSION_COOKIE,STAFF_EMBEDDED_SESSION_COOKIE} from '@/lib/staff-auth';
import {validSubscription,webPushConfig} from '@/lib/web-push';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
async function currentSession(req:Request,userId:string){
 const cookie=req.headers.get('cookie')||'';
 for(const name of [STAFF_SESSION_COOKIE,STAFF_EMBEDDED_SESSION_COOKIE]){const value=cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))?.[1];if(!value)continue;const hash=await hashSessionToken(value);if(await storage().DB.prepare('SELECT token_hash FROM staff_sessions WHERE token_hash=? AND user_id=? AND expires>?').bind(hash,userId,Date.now()).first())return hash}
 return null;
}
export async function GET(){const a=await getStaffAccess();if(!a?.isApproved)return json({error:'შეტყობინებების ჩასართავად შედი ანგარიშში.'},401);const c=webPushConfig();return json({enabled:c.enabled&&a.features?.notifications!==false,publicKey:c.enabled?c.publicKey:null,userId:a.userId})}
export async function POST(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||!sameOrigin(req)||a.features?.notifications===false)return json({error:'წვდომა შეზღუდულია.'},403);
 if(!webPushConfig().enabled)return json({error:'შეტყობინებები ჯერ არ არის დაკავშირებული.'},503);
 const b=await req.json().catch(()=>null) as {endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown}}|null,subscription={endpoint:b?.endpoint,p256dh:b?.keys?.p256dh,auth:b?.keys?.auth};
 if(!validSubscription(subscription))return json({error:'ბრაუზერის შეტყობინების მისამართი არასწორია.'},400);
 const session=await currentSession(req,a.userId);if(!session)return json({error:'შედი ანგარიშში ამ ბრაუზერიდან.'},401);
 const {DB}=storage(),now=Date.now();
 await DB.batch([
  DB.prepare('DELETE FROM web_push_subscriptions WHERE endpoint=? AND (user_id<>? OR session_hash<>?)').bind(subscription.endpoint,a.userId,session),
  DB.prepare('INSERT INTO web_push_subscriptions(id,endpoint,user_id,session_hash,p256dh,auth,updated) VALUES(?,?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,updated=excluded.updated').bind(crypto.randomUUID(),subscription.endpoint,a.userId,session,subscription.p256dh,subscription.auth,now),
  DB.prepare('DELETE FROM web_push_subscriptions WHERE user_id=? AND id NOT IN(SELECT id FROM web_push_subscriptions WHERE user_id=? ORDER BY updated DESC LIMIT 10)').bind(a.userId,a.userId),
 ]);return json({ok:true});
}
export async function DELETE(req:Request){const a=await getStaffAccess();if(!a||!sameOrigin(req))return json({error:'წვდომა შეზღუდულია.'},403);const b=await req.json().catch(()=>null) as {endpoint?:unknown}|null;if(typeof b?.endpoint!=='string')return json({error:'არასწორი მოთხოვნა.'},400);await storage().DB.prepare('DELETE FROM web_push_subscriptions WHERE endpoint=? AND user_id=?').bind(b.endpoint,a.userId).run();return json({ok:true})}
