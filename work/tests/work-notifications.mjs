import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

const sql=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
function statement(query,args=[]){return {bind(...values){assert.ok(values.length<=100);return statement(query,values)},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}})}}
let beforeBatch;
const DB={prepare:statement,batch:async statements=>{if(beforeBatch){const fn=beforeBatch;beforeBatch=undefined;fn()}sql.exec('BEGIN');try{const results=[];for(const item of statements)results.push(await item.run());sql.exec('COMMIT');return results}catch(error){sql.exec('ROLLBACK');throw error}}};
let now=Date.parse('2026-10-26T05:59:00Z'),actor=null,failToken='',received=[];
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
const env={},cache=new Map(),afterJobs=[],people=[{userId:'worker',email:'worker@test.example',fullName:'Worker',role:'Video Editor'},{userId:'hr',email:'hr@test.example',fullName:'HR',role:'HR'},{userId:'other',email:'other@test.example',fullName:'Other',role:'Video Editor'}];
const fetch=async(url,options)=>{if(url.endsWith('/getReceipts'))return Response.json({data:Object.fromEntries(JSON.parse(options.body).ids.map(id=>[id,{status:'ok'}]))});assert.equal(url,'https://exp.host/--/api/v2/push/send');const batch=JSON.parse(options.body);assert.ok(Array.isArray(batch));received.push(...batch);return Response.json({data:batch.map(item=>item.to===failToken?{status:'error',details:{error:'MessageRateExceeded'}}:{status:'ok',id:crypto.randomUUID()})})};
function load(file){if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);function require(name){
 if(name==='cloudflare:workers')return {env};
 if(name==='next/server')return {after:task=>afterJobs.push(task)};
 if(['@/lib/storage','./storage'].includes(name))return {storage:()=>({DB})};
 if(['@/lib/staff-access','./staff-access'].includes(name))return {getStaffAccess:async()=>actor,listApprovedStaff:async()=>people};
 if(name==='./chat-directory')return {conversationPeople:async thread=>thread==='team'?people:people.filter(p=>p.userId==='worker'||p.userId==='hr')};
 if(name==='@/lib/visitor')return {sameOrigin:req=>req.headers.get('origin')==='https://test.example'};
 if(name.startsWith('@/')||name.startsWith('.')){const base=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);return load(base.endsWith('.ts')?base:base+'.ts')}
 throw Error('Unexpected import '+name);
 }const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require,fetch,Date:Clock,Intl,crypto,TextEncoder,TextDecoder,Uint8Array,AbortSignal,URL,Request,Response,Headers,console});return exports}
const perms=load('lib/permissions.ts'),notices=load('lib/notifications.ts'),scheduled=load('lib/notification-reminders.ts'),requests=load('app/api/attendance/requests/route.ts'),inbox=load('app/api/notifications/route.ts'),dispatch=load('app/api/notifications/dispatch/route.ts'),push=load('lib/push.ts'),reminders=load('app/api/notifications/reminders/route.ts');
function as(id){const person=people.find(p=>p.userId===id);actor=person?{...person,isApproved:true,permissions:perms.defaultPermissions(person.role)}:null}
function req(route,body,method='POST'){return new Request('https://test.example'+route,{method:body===undefined?'GET':method,headers:{origin:'https://test.example','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})}
const count=(query,...args)=>sql.prepare(query).get(...args).n;
sql.prepare("INSERT INTO workspace_settings (key,value,updated,updated_by) VALUES ('salary-date:2026-10',?,1,'test')").run('2026-10-26');
sql.prepare("INSERT INTO workspace_settings (key,value,updated,updated_by) VALUES ('office',?,1,'test')").run(JSON.stringify({name:'Office',latitude:41.7,longitude:44.8,radius:300,checkInAfter:'12:00',reminderTime:'13:00'}));
for(const p of people)sql.prepare('INSERT INTO push_devices (token,user_id,updated) VALUES (?,?,?)').run('ExpoPushToken['+p.userId+'_device]',p.userId,now);
assert.equal((await scheduled.produceScheduledNotices()).created,0,'Not before 10:00');
now=Date.parse('2026-10-26T06:00:00Z');assert.equal((await scheduled.produceScheduledNotices()).created,3);
assert.equal((await scheduled.produceScheduledNotices()).created,0,'Repeated scheduled calls are idempotent');
assert.equal(count("SELECT COUNT(*) n FROM work_notifications WHERE category='attendance_prompt'"),0);
await notices.flushNotices();assert.equal(received.length,3);assert.ok(received.every(item=>item.data.recipientUserId));
await notices.flushNotices();assert.equal(received.length,3,'Accepted pushes are not replayed');
now=Date.parse('2026-10-26T09:00:00Z');await notices.flushNotices();assert.equal(count('SELECT COUNT(*) n FROM work_notification_deliveries WHERE receipt_checked IS NOT NULL'),3,'Expo provider receipts checked separately from acceptance');assert.equal((await scheduled.produceScheduledNotices()).created,3,'13:00 workday reminder');
// An arrival or request after production cancels stale attendance delivery.
sql.prepare("INSERT INTO staff_attendance (user_id,email,work_date,mode,first_arrival,updated,source) VALUES ('other','other@test.example','2026-10-26','office',?,?,'gps')").run(now,now);
as('worker');let response=await requests.POST(req('/api/attendance/requests',{answer:'remote'}));assert.equal(response.status,201);let requestId=(await response.json()).id;
assert.equal(count("SELECT COUNT(*) n FROM staff_attendance WHERE user_id='worker'"),0,'Remote not recorded before HR approval');
assert.equal((await requests.POST(req('/api/attendance/requests',{answer:'remote'}))).status,200,'Identical retry accepted');
assert.equal((await requests.POST(req('/api/attendance/requests',{answer:'absent'}))).status,409);
assert.equal((await requests.POST(req('/api/attendance/requests',{answer:'remote',date:'2026-10-25'}))).status,400);
await notices.flushNotices();assert.equal(received.filter(p=>p.data.attendance).length,1,'Only still-pending HR receives attendance reminder');
assert.equal((await requests.GET(req('/api/attendance/requests?review=1'))).status,403);
assert.equal((await requests.PATCH(req('/api/attendance/requests',{id:requestId,action:'approved'},'PATCH'))).status,403);
as('hr');response=await requests.PATCH(req('/api/attendance/requests',{id:requestId,action:'approved',response:'Confirmed'},'PATCH'));assert.equal(response.status,200);
assert.equal(sql.prepare("SELECT mode,source FROM staff_attendance WHERE user_id='worker'").get().mode,'remote');
assert.equal((await requests.PATCH(req('/api/attendance/requests',{id:requestId,action:'approved'},'PATCH'))).status,200);
assert.equal((await requests.PATCH(req('/api/attendance/requests',{id:requestId,action:'rejected'},'PATCH'))).status,409);
assert.equal(count("SELECT COUNT(*) n FROM work_notifications WHERE category='attendance' AND user_id='worker'"),1);
// A GPS arrival racing the review cannot be overwritten by a remote approval.
response=await requests.POST(req('/api/attendance/requests',{answer:'remote'}));assert.equal(response.status,201);const racedId=(await response.json()).id;
beforeBatch=()=>sql.prepare("INSERT INTO staff_attendance (user_id,email,work_date,mode,first_arrival,updated,source) VALUES ('hr','hr@test.example','2026-10-26','office',?,?,'gps')").run(now,now);
assert.equal((await requests.PATCH(req('/api/attendance/requests',{id:racedId,action:'approved'},'PATCH'))).status,409);
assert.equal(sql.prepare("SELECT mode FROM staff_attendance WHERE user_id='hr'").get().mode,'office');assert.equal(sql.prepare('SELECT status FROM attendance_requests WHERE id=?').get(racedId).status,'pending');
assert.equal(count("SELECT COUNT(*) n FROM work_notifications WHERE category='attendance' AND user_id='hr'"),0);
// Reviewer capability revocation hides private requests and forbids decisions.
actor.permissions=[];assert.equal((await requests.GET(req('/api/attendance/requests?review=1'))).status,403);
const hidden=await(await inbox.GET(req('/api/notifications'))).json();assert.ok(hidden.items.every(item=>item.target!=='requests'));
as('worker');const own=await(await inbox.GET(req('/api/notifications'))).json();assert.ok(own.items.every(item=>!item.id.endsWith(':hr')));const foreign=sql.prepare("SELECT id FROM work_notifications WHERE user_id='hr' LIMIT 1").get().id;
await inbox.PATCH(req('/api/notifications',{id:foreign},'PATCH'));assert.equal(sql.prepare('SELECT read_at FROM work_notifications WHERE id=?').get(foreign).read_at,null);
// Durable receipts skip a successfully accepted device when a sibling failed.
sql.prepare('INSERT INTO push_devices (token,user_id,updated) VALUES (?,?,?)').run('ExpoPushToken[worker_second]','worker',now);
failToken='ExpoPushToken[worker_second]';await notices.notifyUsers(['worker'],{key:'partial',category:'info',title:'Test',body:'Partial',target:'notifications'});await notices.flushNotices();
const firstCount=received.filter(item=>item.data.notificationId==='partial:worker'&&item.to==='ExpoPushToken[worker_device]').length;assert.equal(firstCount,1);
now+=61_000;failToken='';await notices.flushNotices();assert.equal(received.filter(item=>item.data.notificationId==='partial:worker'&&item.to==='ExpoPushToken[worker_device]').length,1);
// A token removed at logout cannot receive a pending work notice.
await notices.notifyUsers(['worker'],{key:'logout',category:'info',title:'Test',body:'Logout',target:'notifications'});sql.prepare("DELETE FROM push_devices WHERE user_id='worker'").run();await notices.flushNotices();assert.equal(received.filter(item=>item.data.notificationId==='logout:worker').length,0);
// Muted chat exceptions, deleted-history cutoff and partial push retries.
for(const id of ['worker','hr'])sql.prepare('INSERT OR REPLACE INTO push_devices (token,user_id,updated) VALUES (?,?,?)').run('ExpoPushToken['+id+'_device]',id,now);
sql.prepare("INSERT INTO chat_preferences (conversation_id,user_id,muted,updated) VALUES ('team','hr',1,?)").run(now);
await push.queuePush('plain','team','worker','Chat','Regular').run();await push.flushPush();assert.equal(received.filter(item=>item.data.messageId==='plain'&&item.to==='ExpoPushToken[hr_device]').length,0);
sql.prepare("INSERT INTO chat_mentions (message_id,user_id) VALUES ('mention','hr')").run();await push.queuePush('mention','team','worker','Chat','@everyone').run();await push.flushPush();assert.equal(received.filter(item=>item.data.messageId==='mention'&&item.to==='ExpoPushToken[hr_device]').length,1);
sql.prepare("INSERT INTO chat_hidden_threads (conversation_id,user_id,cleared_before,hidden) VALUES ('dm_test','hr',?,1)").run(now);await push.queuePush('hidden','dm_test','worker','Chat','Hidden').run();await push.flushPush();assert.equal(received.filter(item=>item.data.messageId==='hidden').length,0);
sql.prepare("INSERT INTO chat_deleted_conversations (id,deleted,deleted_by) VALUES ('grp_deleted',?,'worker')").run(now);await push.queuePush('deleted','grp_deleted','worker','Chat','Deleted').run();assert.equal(count("SELECT COUNT(*) n FROM push_outbox WHERE id='deleted'"),0);
sql.prepare("UPDATE chat_preferences SET muted=0 WHERE user_id='hr'").run();sql.prepare('INSERT INTO push_devices (token,user_id,updated) VALUES (?,?,?)').run('ExpoPushToken[hr_second]','hr',now);failToken='ExpoPushToken[hr_second]';await push.queuePush('chat-partial','team','worker','Chat','Partial').run();await push.flushPush();failToken='';await push.flushPush();assert.equal(received.filter(item=>item.data.messageId==='chat-partial'&&item.to==='ExpoPushToken[hr_device]').length,1);
// An in-flight token reassigned to another eligible account gets that identity's receipt.
sql.prepare('INSERT INTO push_devices (token,user_id,updated) VALUES (?,?,?)').run('ExpoPushToken[shared_device]','hr',now);failToken='ExpoPushToken[shared_device]';await push.queuePush('account-switch','team','worker','Chat','Switch').run();await push.flushPush();
sql.prepare("UPDATE push_devices SET user_id='other' WHERE token='ExpoPushToken[shared_device]'").run();failToken='';await push.flushPush();await push.flushPush();
const switched=received.filter(item=>item.data.messageId==='account-switch'&&item.to==='ExpoPushToken[shared_device]'&&item.data.recipientUserId==='other');assert.equal(switched.length,1);assert.equal(sql.prepare("SELECT user_id FROM push_deliveries WHERE message_id='account-switch' AND token='ExpoPushToken[shared_device]'").get().user_id,'other');
// Revoked chat permission suppresses pending messages even for existing members.
sql.prepare("UPDATE staff_positions SET permissions_json='[]' WHERE name='HR'").run();await push.queuePush('revoked','team','worker','Chat','Private').run();await push.flushPush();assert.equal(received.filter(item=>item.data.messageId==='revoked'&&item.data.recipientUserId==='hr').length,0);
// Scheduler endpoint fails closed without credential and does not accept account auth.
assert.equal((await dispatch.POST(req('/api/notifications/dispatch',{}))).status,401);env.WORK_NOTIFICATION_CRON_SECRET='x'.repeat(48);assert.equal((await dispatch.POST(req('/api/notifications/dispatch',{}))).status,401);
assert.equal((await dispatch.POST(new Request('https://test.example/api/notifications/dispatch',{method:'POST',headers:{authorization:'Bearer '+'x'.repeat(48)}}))).status,200);
as('worker');assert.equal((await(await reminders.GET()).json()).serverScheduling,false);env.WORK_NOTIFICATION_SCHEDULER_ENABLED='1';assert.equal((await(await reminders.GET()).json()).serverScheduling,true);
console.log('PASS: Tbilisi payday/attendance due windows, idempotency, HR approval, privacy/revocation, stale reminder cancellation, per-device retries, mute/mention override, logout, deleted chat cutoff, protected dispatch and scheduler readiness.');
