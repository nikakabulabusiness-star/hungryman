import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

const sql=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
function statement(query,args=[]){return {bind(...next){assert.ok(next.length<=100,"D1 bound parameter limit");return statement(query,next)},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}})}}
const DB={prepare:statement,batch:async statements=>{sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}};
let request=new Request('https://test.example');
const modules=new Map(),bucket=new Map(),afterJobs=[],pushRequests=[];let bucketDown=false;
const BUCKET={put:async(key,bytes)=>{if(bucketDown)throw Error('storage unavailable');bucket.set(key,bytes)},head:async key=>bucket.has(key)?{size:bucket.get(key).byteLength}:null,get:async(key,options)=>bucket.has(key)?{size:bucket.get(key).byteLength,body:options?.range?bucket.get(key).slice(options.range.offset,options.range.offset+options.range.length):bucket.get(key)}:null,delete:async key=>bucket.delete(key)};
const fakeFetch=async(url,options)=>{assert.equal(url,'https://exp.host/--/api/v2/push/send');const body=JSON.parse(options.body);pushRequests.push(...body);return Response.json({data:body.map(()=>({status:'ok',id:crypto.randomUUID()}))})};
function load(file){
 if(modules.has(file))return modules.get(file);
 const exports={};modules.set(file,exports);
 function require(name){
  if(name==='cloudflare:workers')return {env:{}};
  if(name==='next/headers')return {headers:async()=>request.headers,cookies:async()=>({get:key=>{const value=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='))?.slice(key.length+1);return value?{value}:undefined}})};
  if(name==='next/server')return {after:task=>afterJobs.push(task)};
  if(name==='next/navigation')return {redirect:()=>{throw Error('Unexpected redirect')}};
  if(name==='@/lib/storage'||name==='./storage')return {storage:()=>({DB,BUCKET})};
  const base=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);
  if(name.startsWith('@/')||name.startsWith('.'))return load(base.endsWith('.ts')?base:base+'.ts');
  throw Error('Unknown module '+name);
 }
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require,fetch:fakeFetch,AbortSignal,URL,Response,Request,Headers,FormData,File,crypto,Uint8Array,TextEncoder,TextDecoder,Date,Intl,console,setTimeout,clearTimeout});
 return exports;
}
function req(path,{method='GET',body,token,headers={}}={}){request=new Request('https://test.example'+path,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});return request}

const auth=load('lib/staff-auth.ts'),register=load('app/api/mobile/auth/register/route.ts'),login=load('app/api/mobile/auth/login/route.ts'),me=load('app/api/mobile/me/route.ts'),admin=load('app/api/admin/users/route.ts'),mode=load('app/api/developer/mode/route.ts'),workspace=load('app/api/workspace/route.ts'),attendance=load('app/api/attendance/route.ts'),attendanceAdmin=load('app/api/admin/attendance/route.ts'),messages=load('app/api/chat/messages/route.ts'),reaction=load('app/api/chat/messages/[id]/reaction/route.ts'),cal=load('lib/attendance.ts');
async function account(email,role){const password='workspace-test-password';const id=crypto.randomUUID(),fixture=await auth.createPasswordRecord(password);sql.prepare("INSERT INTO team_members(user_id,email,full_name,status,password_hash,password_salt,email_verified_at,created,updated) VALUES(?,?,?,'pending',?,?,1,1,1)").run(id,email,email,fixture.hash,fixture.salt);if(role){sql.prepare("UPDATE team_members SET role=?,status='approved' WHERE user_id=?").run(role,id);sql.prepare("INSERT INTO admin_users (email,role,status,created,created_by) VALUES (?,?,'approved',1,'test') ON CONFLICT(email) DO UPDATE SET role=excluded.role,status='approved'").run(email,role)}const r=await login.POST(req('/api/mobile/auth/login',{method:'POST',body:{email,password}}));return {email,id,token:(await r.json()).token}}

const dev=await account('nikolozkabulashvili0@gmail.com','Owner'),hr=await account('hr@workflow.test','HR'),editor=await account('editor@workflow.test','Video Editor'),other=await account('other@workflow.test','Video Editor'),owner=await account('owner@workflow.test','Owner'),creator=await account('creator@workflow.test','Content Creator'),social=await account('social@workflow.test','სოციალური მედია'),writer=await account('writer@workflow.test','სცენარისტი');
const notes=load('app/api/calendar/notes/route.ts'),timeoff=load('app/api/time-off/route.ts'),cabinet=load('app/api/team/cabinet/route.ts'),entitlements=load('app/api/admin/day-off-entitlement/route.ts'),calendar=load('app/api/calendar/route.ts'),conversations=load('app/api/chat/conversations/route.ts'),updates=load('app/api/chat/updates/route.ts'),preferences=load('app/api/chat/preferences/route.ts'),settings=load('app/api/chat/settings/route.ts'),socialApi=load('app/api/social/route.ts');
async function json(response,status=200){assert.equal(response.status,status,await response.clone().text());return response.json()}
// Private notes remain scoped to the authenticated identity, even for privileged staff.
await json(await notes.PUT(req('/api/calendar/notes',{method:'PUT',token:editor.token,body:{date:'2026-11-02',body:'Private medical appointment',userId:other.id}})));
let data=await json(await notes.GET(req('/api/calendar/notes?from=2026-11-01&to=2026-11-30',{token:editor.token})));assert.equal(data.notes.length,1);
for(const a of [other,hr,dev]){data=await json(await notes.GET(req('/api/calendar/notes?from=2026-11-01&to=2026-11-30&userId='+editor.id,{token:a.token})));assert.equal(data.notes.length,0)}
await json(await notes.PUT(req('/api/calendar/notes',{method:'PUT',token:other.token,body:{date:'2026-11-02',body:'',userId:editor.id}})));
assert.equal(sql.prepare('SELECT body FROM private_calendar_notes WHERE user_id=?').get(editor.id).body,'Private medical appointment');
assert.equal((await notes.PUT(req('/api/calendar/notes',{method:'PUT',token:editor.token,body:{date:'2026-02-30',body:'invalid'}}))).status,400);
assert.equal((await notes.GET(req('/api/calendar/notes?from=2020-01-01&to=2030-12-31',{token:editor.token}))).status,400);
assert.equal((await notes.GET(req('/api/calendar/notes?from=2026-11-01&to=2026-11-30'))).status,403);
console.log('PASS private calendar notes: own-account isolation, privileged access rejection, forged identity and date validation.');
// Employee -> reviewer -> employee -> calendar/balances; decisions are atomic and cannot be applied twice.
const requestBody={kind:'leave',startDate:'2026-11-02',endDate:'2026-11-04',comment:'Family trip',email:other.email,userId:other.id};
let response=await timeoff.POST(req('/api/time-off',{method:'POST',token:editor.token,body:requestBody})),leaveId=(await json(response,201)).id;
assert.equal(sql.prepare('SELECT user_id FROM staff_time_off_requests WHERE id=?').get(leaveId).user_id,editor.id);
assert.equal((await timeoff.POST(req('/api/time-off',{method:'POST',token:editor.token,body:requestBody}))).status,409);
assert.equal((await timeoff.GET(req('/api/time-off?review=1',{token:editor.token}))).status,403);
assert.equal((await timeoff.PATCH(req('/api/time-off',{method:'PATCH',token:editor.token,body:{id:leaveId,action:'approved'}}))).status,403);
assert.equal((await json(await timeoff.GET(req('/api/time-off',{token:other.token})))).requests.length,0);
for(const a of [hr,owner,dev]){data=await json(await timeoff.GET(req('/api/time-off?review=1',{token:a.token})));assert.equal(data.pending,1);assert.equal(data.requests[0].comment,'Family trip');assert.equal(data.requests[0].decision_token,undefined)}
await json(await timeoff.PATCH(req('/api/time-off',{method:'PATCH',token:hr.token,body:{id:leaveId,action:'approved',response:'Approved. Enjoy your trip.'}})));
assert.equal((await timeoff.PATCH(req('/api/time-off',{method:'PATCH',token:owner.token,body:{id:leaveId,action:'rejected'}}))).status,409);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM staff_calendar_events WHERE id=?').get('request-'+leaveId).n,1);
assert.equal(sql.prepare('SELECT visibility FROM staff_calendar_events WHERE id=?').get('request-'+leaveId).visibility,'individual');
data=await json(await timeoff.GET(req('/api/time-off',{token:editor.token})));assert.equal(data.unread,1);assert.equal(data.requests[0].response,'Approved. Enjoy your trip.');
await json(await timeoff.PATCH(req('/api/time-off',{method:'PATCH',token:editor.token,body:{action:'seen'}})));
assert.equal((await json(await timeoff.GET(req('/api/time-off',{token:editor.token})))).unread,0);
data=await json(await calendar.GET(req('/api/calendar?from=2026-11-01&to=2026-11-30',{token:editor.token})));assert.ok(data.events.some(e=>e.id==='request-'+leaveId));
data=await json(await calendar.GET(req('/api/calendar?from=2026-11-01&to=2026-11-30',{token:other.token})));assert.ok(!data.events.some(e=>e.id==='request-'+leaveId));
let rejected=(await json(await timeoff.POST(req('/api/time-off',{method:'POST',token:editor.token,body:{kind:'sick',startDate:'2026-11-10',endDate:'2026-11-10'}})),201)).id;
await json(await timeoff.PATCH(req('/api/time-off',{method:'PATCH',token:owner.token,body:{id:rejected,action:'rejected',response:'Check the date'}})));
assert.equal(sql.prepare('SELECT COUNT(*) n FROM staff_calendar_events WHERE id=?').get('request-'+rejected).n,0);
assert.equal((await timeoff.POST(req('/api/time-off',{method:'POST',token:editor.token,body:{kind:'sick',startDate:'2026-02-30',endDate:'2026-03-01'}}))).status,400);
assert.equal((await entitlements.PUT(req('/api/admin/day-off-entitlement',{method:'PUT',token:editor.token,body:{email:editor.email,year:2026,days:5}}))).status,403);
await json(await entitlements.PUT(req('/api/admin/day-off-entitlement',{method:'PUT',token:hr.token,body:{email:editor.email,year:2026,days:5}})));
for(const body of [{kind:'day_off',startDate:'2026-11-05',endDate:'2026-11-05'},{kind:'sick',startDate:'2026-11-06',endDate:'2026-11-08'}]){const id=(await json(await timeoff.POST(req('/api/time-off',{method:'POST',token:editor.token,body})),201)).id;await json(await timeoff.PATCH(req('/api/time-off',{method:'PATCH',token:hr.token,body:{id,action:'approved'}})))}
data=await json(await cabinet.GET(req('/api/team/cabinet?month=2026-11',{token:editor.token})));assert.equal(data.leave.remaining,21);assert.equal(data.dayOff.remaining,4);assert.equal(data.sick.remaining,27);assert.equal(data.sick.allowance,30);
const domain=load('lib/cabinet.ts'),events=sql.prepare('SELECT * FROM staff_calendar_events').all();let balances=domain.calculateBalances(editor.email,2026,events,[],null,5,'2026-11-01');assert.equal(balances.leave.reserved,3);assert.equal(balances.sick.reserved,3);assert.equal(balances.sick.used,0);
balances=domain.calculateBalances(editor.email,2026,events,[],null,5,'2026-11-30');assert.equal(balances.sick.used,3);assert.equal(balances.sick.reserved,0);
const cross={...events[0],kind:'sick',start_date:'2026-12-31',end_date:'2027-01-02'};assert.equal(domain.calculateBalances(editor.email,2026,[cross],[],null,null,'2027-02-01').sick.used,1);assert.equal(domain.calculateBalances(editor.email,2027,[cross],[],null,null,'2027-02-01').sick.used,2);
assert.equal(domain.calculateBalances(editor.email,2026,[],[],null,null).dayOff.remaining,null);
const planned=load('lib/attendance.ts');assert.equal(planned.plannedDay('2026-11-06',editor.email,{events,patterns:[],shootDates:new Set(['2026-11-06'])}),'sick');assert.equal(planned.plannedDay('2026-11-05',editor.email,{events,patterns:[],shootDates:new Set(['2026-11-05'])}),'day_off');
const localToday=planned.localDate(),localMonth=localToday.slice(0,7);sql.prepare("INSERT INTO staff_attendance (user_id,email,work_date,mode,office_minutes,updated,source) VALUES (?,?,?,'office',120,?,'location')").run(editor.id,editor.email,localToday,Date.now());
let hoursData=await json(await cabinet.GET(req('/api/team/cabinet?month='+localMonth,{token:editor.token})));assert.equal(hoursData.workedHours,2);assert.ok(hoursData.workedDays<=Number(localToday.slice(-2)));
assert.equal((await notes.PUT(req('/api/calendar/notes',{method:'PUT',token:editor.token,body:null}))).status,400);
assert.equal((await timeoff.POST(req('/api/time-off',{method:'POST',token:editor.token,body:null}))).status,400);
console.log('PASS leave workflow: reviewer authorization, overlap protection, approve/reject replies, one-time private calendar insertion, annual balances and 30-day sick allowance.');
// Groups, direct chats, mentions, and media retain member-only authorization.
const group=(await json(await conversations.POST(req('/api/chat/conversations',{method:'POST',token:editor.token,body:{title:'Production',memberIds:[hr.id,writer.id]}})),201)).id;
await json(await conversations.PATCH(req('/api/chat/conversations',{method:'PATCH',token:editor.token,body:{id:group,title:'Production team',memberIds:[creator.id]}})));
assert.equal((await conversations.PATCH(req('/api/chat/conversations',{method:'PATCH',token:other.token,body:{id:group,title:'Stolen'}}))).status,404);
assert.equal((await conversations.GET(req('/api/chat/conversations?id='+group,{token:dev.token}))).status,404);
assert.equal((await settings.PATCH(req('/api/chat/settings',{method:'PATCH',token:other.token,body:{conversationId:group,emoji:'❤️'}}))).status,404);
for(const a of [editor,hr,writer,creator]){data=await json(await conversations.GET(req('/api/chat/conversations',{token:a.token})));assert.equal(data.conversations[0].id,'team');assert.ok(data.conversations.some(c=>c.id===group&&c.title==='Production team'))}
data=await json(await conversations.GET(req('/api/chat/conversations',{token:other.token})));assert.ok(!data.conversations.some(c=>c.id===group));
await json(await preferences.PATCH(req('/api/chat/preferences',{method:'PATCH',token:hr.token,body:{conversationId:group,muted:true}})));
await json(await preferences.PATCH(req('/api/chat/preferences',{method:'PATCH',token:writer.token,body:{conversationId:group,muted:true}})));
for(const a of [hr,writer,other])sql.prepare('INSERT INTO push_devices (token,user_id,updated) VALUES (?,?,?)').run('ExponentPushToken['+a.id+']',a.id,Date.now());
const message={id:crypto.randomUUID(),conversationId:group,body:'@everyone production update'};
await json(await messages.POST(req('/api/chat/messages',{method:'POST',token:editor.token,body:message})),201);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM chat_mentions WHERE message_id=?').get(message.id).n,3);
for(const a of [hr,writer]){data=await json(await updates.GET(req('/api/chat/updates?after=1',{token:a.token})));const found=data.messages.find(m=>m.id===message.id);assert.equal(found.muted,1);assert.equal(found.mentioned,1)}
data=await json(await updates.GET(req('/api/chat/updates?after=1',{token:other.token})));assert.ok(!data.messages.some(m=>m.id===message.id));
for(const job of afterJobs.splice(0))await job();const delivered=pushRequests.filter(p=>p.data.messageId===message.id);assert.equal(delivered.length,2);assert.ok(delivered.every(p=>p.to==='ExponentPushToken['+hr.id+']'||p.to==='ExponentPushToken['+writer.id+']'));
const plainId=crypto.randomUUID();await json(await messages.POST(req('/api/chat/messages',{method:'POST',token:editor.token,body:{id:plainId,conversationId:group,body:'regular update'}})),201);for(const job of afterJobs.splice(0))await job();assert.equal(pushRequests.filter(p=>p.data.messageId===plainId).length,0);
const roleId=crypto.randomUUID();await json(await messages.POST(req('/api/chat/messages',{method:'POST',token:editor.token,body:{id:roleId,conversationId:group,body:'@სცენარი please check'}})),201);assert.equal(sql.prepare('SELECT user_id FROM chat_mentions WHERE message_id=?').get(roleId).user_id,writer.id);
data=await json(await conversations.GET(req('/api/chat/conversations?id='+group,{token:hr.token})));const targetHandle=data.members.find(m=>m.userId===creator.id).handle;
const personalId=crypto.randomUUID();await json(await messages.POST(req('/api/chat/messages',{method:'POST',token:editor.token,body:{id:personalId,conversationId:group,body:'@'+targetHandle+' test',mentions:[other.id]}})),201);assert.equal(sql.prepare('SELECT user_id FROM chat_mentions WHERE message_id=?').get(personalId).user_id,creator.id);assert.equal(sql.prepare('SELECT COUNT(*) n FROM chat_mentions WHERE message_id=?').get(personalId).n,1);
assert.equal((await messages.POST(req('/api/chat/messages',{method:'POST',token:other.token,body:{...message,id:crypto.randomUUID()}}))).status,404);
console.log('PASS group chats: member access, participant additions, private metadata, @everyone/role/person mentions, muted-chat delivery override and non-member exclusion.');
// Social workspace remains role-scoped; personal links never become global links.
for(const a of [editor]){assert.equal((await socialApi.GET(req('/api/social',{token:a.token}))).status,403);assert.equal((await socialApi.PUT(req('/api/social',{method:'PUT',token:a.token,body:{action:'links',links:{instagram:'https://instagram.com/example',facebook:'',tiktok:''}}}))).status,403)}
for(const a of [creator,social,dev,hr,owner])assert.equal((await socialApi.GET(req('/api/social',{token:a.token}))).status,200);
assert.equal((await socialApi.GET(req('/api/social',{token:dev.token,headers:{'X-HMW-Preview-Role':'Video Editor'}}))).status,403);
await json(await socialApi.PUT(req('/api/social',{method:'PUT',token:creator.token,body:{action:'links',links:{instagram:'https://instagram.com/ourteam',facebook:'https://www.facebook.com/ourteam',tiktok:'https://www.tiktok.com/@ourteam'},userId:social.id}})));
assert.equal((await json(await socialApi.GET(req('/api/social',{token:social.token})))).links.instagram,'');assert.equal((await json(await socialApi.GET(req('/api/social',{token:creator.token})))).links.instagram,'https://instagram.com/ourteam');
for(const url of ['javascript:alert(1)','data:text/html,test','http://example.com','https://user:pass@example.com'])assert.equal((await socialApi.PUT(req('/api/social',{method:'PUT',token:creator.token,body:{action:'links',links:{instagram:url,facebook:'',tiktok:''}}}))).status,400);
const metrics={action:'metrics',platform:'instagram',month:'2026-10',followers:2500,views:125000,likes:5000,comments:250,shares:100,posts:12};
await json(await socialApi.PUT(req('/api/social',{method:'PUT',token:creator.token,body:metrics})));
data=await json(await socialApi.GET(req('/api/social?year=2026',{token:social.token})));assert.equal(data.metrics.length,1);assert.equal(data.metrics[0].views,125000);assert.equal(data.metrics[0].source,'manual');assert.equal(data.connection,'not_connected');
await json(await socialApi.PUT(req('/api/social',{method:'PUT',token:social.token,body:{...metrics,views:null}})));assert.equal((await json(await socialApi.GET(req('/api/social?year=2026',{token:creator.token})))).metrics[0].views,null);
assert.equal((await socialApi.PUT(req('/api/social',{method:'PUT',token:creator.token,body:{...metrics,views:-10}}))).status,400);assert.equal((await socialApi.PUT(req('/api/social',{method:'PUT',token:creator.token,body:{...metrics,month:'2026-13'}}))).status,400);
console.log('PASS social workspace: role/preview restrictions, personal HTTPS links, shared monthly metrics, missing vs zero values and explicit manual source.');
