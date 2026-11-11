import {deliverWebPush,webPushConfig} from './web-push';
import {conversationPeople} from './chat-directory';
import {getSiteFeatures} from './site-controls-store';
import {systemGrants,threadEnabled} from './site-controls';
import {checkPushReceipts} from './push-receipts';
import {after} from 'next/server';
import {storage} from './storage';
import {listApprovedStaff} from './staff-access';
import {getPositions} from './positions';
import {hasPermission} from './permissions';
import {attendancePlan,localDate} from './attendance';
import {salaryEvents} from './calendar-payday';
import {canReviewAccounts,reviewRoles,noticeHref,type NoticeTarget} from './notification-policy';

export type NoticeInput={key:string;category:string;title:string;body:string;target:NoticeTarget;targetId?:string;important?:boolean;created?:number;push?:boolean};
export type WorkNotice={id:string;category:string;title:string;body:string;target:NoticeTarget;target_id:string;important:number;created:number;read_at:number|null};
export async function reviewers(){const [people,positions]=await Promise.all([listApprovedStaff(),getPositions()]);return people.filter(p=>p.userId&&(p.isSiteAdmin||reviewRoles.includes(p.role))&&hasPermission({role:p.role,isSiteAdmin:p.isSiteAdmin,isDeveloper:p.role==='Developer',permissions:[...(positions.find(r=>r.name===p.role)?.permissions||[]),...(p.isSiteAdmin?systemGrants(p.systemPermissions||[]):[])]},'calendar.manage')).map(p=>p.userId!)}
export async function accountReviewers(){const [people,positions]=await Promise.all([listApprovedStaff(),getPositions()]);return people.filter(p=>p.userId&&canReviewAccounts({role:p.role,isSiteAdmin:p.isSiteAdmin,isDeveloper:p.role==='Developer',permissions:[...(positions.find(r=>r.name===p.role)?.permissions||[]),...(p.isSiteAdmin?systemGrants(p.systemPermissions||[]):[])]})).map(p=>p.userId!)}
/** Deterministic IDs make business events and recurring jobs safe to retry. */
export function noticeStatements(userIds:(string|null)[],event:NoticeInput,guard?:{query:string;values:unknown[]}){const db=storage().DB,now=event.created??Date.now();return [...new Set(userIds.filter((id):id is string=>!!id))].map(userId=>db.prepare('INSERT OR IGNORE INTO work_notifications (id,user_id,category,title,body,target,target_id,important,created,push_enabled) SELECT ?,?,?,?,?,?,?,?,?,?'+' WHERE COALESCE((SELECT json_extract(value,\'$.notifications\') FROM workspace_settings WHERE key=\'site_features\'),1)!=0'+(guard?' AND '+guard.query:'')).bind(event.key+':'+userId,userId,event.category,event.title.slice(0,120),event.body.slice(0,500),event.target,event.targetId||'',event.important?1:0,now,event.push===false?0:1,...(guard?.values||[])))}
export async function notifyUsers(userIds:(string|null)[],event:NoticeInput){const statements=noticeStatements(userIds,event);for(let index=0;index<statements.length;index+=50)await storage().DB.batch(statements.slice(index,index+50));dispatchNotices()}
export function dispatchNotices(){after(async()=>{try{await flushNotices()}catch{console.error('work-notification-delivery-pending')}})}
export async function flushNotices(){
 const features=await getSiteFeatures();if(!features.notifications){await storage().DB.prepare('UPDATE work_notifications SET push_enabled=0 WHERE push_enabled=1').run();return {examined:0}}
 await checkPushReceipts();
 const db=storage().DB,now=Date.now(),today=localDate(now),[people,positions]=await Promise.all([listApprovedStaff(),getPositions()]),active=new Map(people.filter(p=>p.userId).map(p=>[p.userId,p]));
 await db.prepare(`INSERT OR IGNORE INTO work_notification_deliveries (notification_id,token) SELECT n.id,d.token FROM work_notifications n JOIN push_devices d ON d.user_id=n.user_id WHERE n.push_enabled=1 AND n.created>? AND n.read_at IS NULL AND d.updated>?`).bind(now-86400000,now-90*86400000).run();
 type Delivery=WorkNotice&{notification_id:string;user_id:string;token:string;attempts:number};
 // Join the live registration: logging out or switching accounts cancels stale deliveries.
 const rows=(await db.prepare(`SELECT d.notification_id,d.token,d.attempts,n.* FROM work_notification_deliveries d JOIN work_notifications n ON n.id=d.notification_id JOIN push_devices p ON p.token=d.token AND p.user_id=n.user_id WHERE d.sent IS NULL AND d.attempts<6 AND (d.claimed IS NULL OR d.claimed<?) AND n.created>? AND n.read_at IS NULL AND p.updated>? ORDER BY n.created LIMIT 100`).bind(now-60000,now-86400000,now-90*86400000).all<Delivery>()).results;
 async function mayDeliver(row:WorkNotice&{user_id:string}){
  const person=active.get(row.user_id),actor={role:person?.role,isSiteAdmin:person?.isSiteAdmin,isDeveloper:person?.role==='Developer',features,permissions:[...(positions.find(p=>p.name===person?.role)?.permissions||[]),...(person?.isSiteAdmin?systemGrants(person.systemPermissions||[]):[])]};
  let allowed=!!person&&hasPermission(actor,'workspace.view');
  if(row.target==='requests')allowed=allowed&&(person!.isSiteAdmin||reviewRoles.includes(person!.role))&&hasPermission(actor,'calendar.manage')&&!!await db.prepare("SELECT id FROM attendance_requests WHERE id=? AND status='pending' UNION ALL SELECT id FROM staff_time_off_requests WHERE id=? AND status='pending'").bind(row.target_id,row.target_id).first();
  if(row.target==='accounts')allowed=allowed&&canReviewAccounts(actor)&&!!await db.prepare("SELECT user_id FROM team_members WHERE user_id=? AND status='pending' AND password_hash IS NOT NULL").bind(row.target_id).first();
  if(row.target==='shoot')allowed=allowed&&hasPermission(actor,'shoots.view')&&!!await db.prepare("SELECT id FROM shoots WHERE id=? AND status!='cancelled'").bind(row.target_id).first();
  if(row.target==='work')allowed=allowed&&features.work!==false&&(row.category!=='work_review'||person!.role==='Owner')&&!!await db.prepare("SELECT id FROM work_videos WHERE id=? AND (?!='work_review' OR EXISTS(SELECT 1 FROM json_each(stages_json) WHERE value='review'))").bind(row.target_id,row.category).first();
  if(row.target==='work_task')allowed=allowed&&features.work!==false&&!!await db.prepare("SELECT id FROM work_tasks WHERE id=? AND scope='assigned' AND deleted IS NULL AND (creator_id=? OR assignee_id=?)").bind(row.target_id,row.user_id,row.user_id).first();
  if(row.target==='attendance'&&features.attendance===false)allowed=false;
  if(allowed&&row.category==='attendance_prompt'){
   const [day]=row.target_id===today?await attendancePlan(person!.email,row.user_id,today,today):[];
   allowed=!!day&&day.planned==='work'&&day.mode==='pending'&&!day.firstArrival&&!await db.prepare('SELECT id FROM attendance_requests WHERE user_id=? AND work_date=?').bind(row.user_id,today).first();
  }
  if(allowed&&row.id.startsWith('salary-reminder:'))allowed=row.target_id===today&&(await salaryEvents(today,today)).some(event=>event.start_date===today);
  if(allowed&&(row.target==='calendar'||row.target==='attendance'))allowed=hasPermission(actor,'calendar.view');
  if(allowed&&row.target==='chat')allowed=hasPermission(actor,'chat.view')&&threadEnabled(row.target_id,features)&&(await conversationPeople(row.target_id)).some(p=>p.userId===row.user_id);
  return allowed;
 }
 const pending:Delivery[]=[];
 for(const row of rows){
  const allowed=await mayDeliver(row);
  if(!allowed){await db.prepare('UPDATE work_notification_deliveries SET sent=? WHERE notification_id=? AND token=?').bind(now,row.id,row.token).run();continue}
  const claim=await db.prepare('UPDATE work_notification_deliveries SET claimed=?,attempts=attempts+1 WHERE notification_id=? AND token=? AND sent IS NULL AND attempts=? AND (claimed IS NULL OR claimed<?)').bind(now,row.id,row.token,row.attempts,now-60000).run();if(claim.meta.changes)pending.push(row);
 }
 if(pending.length)try{
  const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(pending.map(row=>({to:row.token,title:row.title,body:row.body,sound:'default',priority:'high',channelId:'work',ttl:86400,...(row.category==='attendance_prompt'?{categoryId:'attendanceStatus'}:{}),data:{notificationId:row.id,target:row.target,targetId:row.target_id,recipientUserId:row.user_id,...(row.category==='attendance_prompt'?{attendance:true,date:row.target_id}:{})}}))),signal:AbortSignal.timeout(10000)});
  if(response.ok){const payload=await response.json() as {data?:{status?:string;id?:string;details?:{error?:string}}[]};
   if(Array.isArray(payload.data)&&payload.data.length===pending.length)for(let index=0;index<pending.length;index++){
    const row=pending[index],ticket=payload.data[index];
    if(ticket.status==='ok'||ticket.details?.error==='DeviceNotRegistered'){
     await db.prepare('UPDATE work_notification_deliveries SET sent=?,ticket=? WHERE notification_id=? AND token=?').bind(Date.now(),ticket.id||null,row.id,row.token).run();
     if(ticket.details?.error==='DeviceNotRegistered')await db.prepare('DELETE FROM push_devices WHERE token=? AND user_id=?').bind(row.token,row.user_id).run();
    }
   }
  }
 }catch{ /* Durable claims expire; the scheduled dispatcher or next business event retries. */ }
 if(webPushConfig().enabled){
  // Web-only users need their own durable deliveries, independent of Expo registrations.
  const browserNotices=(await db.prepare(`SELECT n.* FROM work_notifications n WHERE n.push_enabled=1 AND n.read_at IS NULL AND n.created>? AND EXISTS(SELECT 1 FROM web_push_subscriptions s JOIN staff_sessions ss ON ss.token_hash=s.session_hash AND ss.user_id=s.user_id WHERE s.user_id=n.user_id AND ss.expires>? AND s.updated>? AND NOT EXISTS(SELECT 1 FROM web_push_deliveries d WHERE d.event_id='work:'||n.id AND d.subscription_id=s.id AND (d.sent IS NOT NULL OR d.attempts>=4))) ORDER BY n.created LIMIT 20`).bind(now-86400000,now,now-90*86400000).all<WorkNotice&{user_id:string}>()).results;
  const browserDeadline=Date.now()+20000;
  for(const row of browserNotices){
   if(Date.now()>browserDeadline)break;
   if(!await mayDeliver(row)){await db.prepare('UPDATE work_notifications SET push_enabled=0 WHERE id=?').bind(row.id).run();continue}
   await deliverWebPush({id:'work:'+row.id,href:noticeHref(row.target,row.target_id),kind:'work',ttl:3600},[row.user_id]);
  }
 }
 await db.prepare('DELETE FROM work_notification_deliveries WHERE NOT EXISTS(SELECT 1 FROM work_notifications n WHERE n.id=notification_id) OR (sent IS NOT NULL AND sent<?)').bind(now-30*86400000).run();
 return {examined:rows.length};
}
