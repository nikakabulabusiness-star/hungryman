import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

const sql=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
function statement(query,args=[]){return {query,isRead:/^\s*(SELECT|WITH)\b/i.test(query),bind(...next){assert.ok(next.length<=100,"D1 bound parameter limit");return statement(query,next)},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}})}}
let beforeBatch=null,afterBatch=null;
const DB={prepare:statement,batch:async statements=>{if(beforeBatch)await beforeBatch(statements);sql.exec('BEGIN');let rows;try{rows=await Promise.all(statements.map(s=>s.isRead?s.all():s.run()));sql.exec('COMMIT')}catch(error){sql.exec('ROLLBACK');throw error}if(afterBatch)await afterBatch(statements);return rows}};
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
const dev=await account('nikolozkabulashvili0@gmail.com','Owner'),hr=await account('hr@example.test','HR'),editor=await account('editor@example.test','Video Editor'),other=await account('owner@example.test','Video Editor');
req('/api/mobile/me',{token:dev.token});let session=await(await me.GET()).json();assert.equal(session.user.role,'Developer');assert.equal(session.permissions.canGrantOwner,true);assert.equal(session.developer.available,true);
for(const role of ['HR','Owner','Video Editor','სცენარისტი']){req('/api/mobile/me',{token:dev.token,headers:{'X-HMW-Preview-Role':encodeURIComponent(role)}});session=await(await me.GET()).json();assert.equal(session.user.role,role);assert.equal(session.permissions.canGrantOwner,false);assert.equal(session.developer.available,true);assert.equal(session.permissions.canAccessAdmin,['HR','Owner'].includes(role))}
req('/api/mobile/me',{token:editor.token,headers:{'X-HMW-Preview-Role':'Developer'}});assert.equal((await(await me.GET()).json()).permissions.canAccessAdmin,false);assert.equal((await mode.GET()).status,403);
assert.equal((await mode.POST(req('/api/developer/mode',{method:'POST',token:editor.token,body:{role:'Developer'}}))).status,403);
let r=await mode.POST(req('/api/developer/mode',{method:'POST',token:dev.token,body:{role:'Video Editor'}}));assert.equal(r.status,200);assert.match(r.headers.get('Set-Cookie'),/HttpOnly/);
const input={email:other.email,role:'Owner',status:'approved',canCreateShoots:true,canEditShoots:true};
assert.equal((await admin.PATCH(req('/api/admin/users',{method:'PATCH',token:hr.token,body:input}))).status,403);
assert.equal((await admin.PATCH(req('/api/admin/users',{method:'PATCH',token:dev.token,body:input}))).status,200);
assert.equal((await admin.PATCH(req('/api/admin/users',{method:'PATCH',token:other.token,body:{...input,email:editor.email}}))).status,403);
assert.equal((await admin.PATCH(req('/api/admin/users',{method:'PATCH',token:hr.token,body:{...input,role:'Video Editor'}}))).status,403);
assert.equal((await admin.PATCH(req('/api/admin/users',{method:'PATCH',token:dev.token,body:{...input,role:'Developer'}}))).status,400);
assert.equal((await admin.DELETE(req('/api/admin/users',{method:'DELETE',token:dev.token,body:{email:dev.email}}))).status,400);
const office={name:'TEST OFFICE',latitude:41.7151,longitude:44.8271,radius:300,checkInAfter:'12:00',reminderTime:'13:00'};
assert.equal((await workspace.PUT(req('/api/workspace',{method:'PUT',token:editor.token,body:office}))).status,403);
assert.equal((await workspace.PUT(req('/api/workspace',{method:'PUT',token:dev.token,body:{...office,radius:0}}))).status,400);
assert.equal((await workspace.PUT(req('/api/workspace',{method:'PUT',token:dev.token,body:office}))).status,200);
const sample={latitude:office.latitude,longitude:office.longitude,accuracy:5,observedAt:Date.now()};
assert.equal((await attendance.POST(req('/api/attendance',{method:'POST',token:editor.token,body:{...sample,observedAt:0}}))).status,422);
assert.equal((await attendance.POST(req('/api/attendance',{method:'POST',token:editor.token,body:{...sample,accuracy:999}}))).status,422);
assert.equal((await attendance.POST(req('/api/attendance',{method:'POST',token:editor.token,body:sample}))).status,200);
req('/api/attendance',{token:editor.token});let data=await(await attendance.GET(request)).json();assert.equal(data.today.mode,'office');assert.equal(data.askRemote,false);
const row=sql.prepare('SELECT * FROM staff_attendance WHERE user_id=?').get(editor.id);assert.equal('latitude' in row,false);assert.equal('longitude' in row,false);
assert.equal((await attendance.POST(req('/api/attendance',{method:'POST',token:editor.token,body:{mode:'remote'}}))).status,409);
assert.equal((await attendance.POST(req('/api/attendance',{method:'POST',token:editor.token,body:{outside:true,observedAt:Date.now()}}))).status,200);assert.equal(sql.prepare('SELECT open_since FROM staff_attendance WHERE user_id=?').get(editor.id).open_since,null);
assert.equal((await attendanceAdmin.GET(req('/api/admin/attendance',{token:editor.token}))).status,403);
const today=cal.localDate(),empty={events:[],patterns:[],shootDates:new Set()};
assert.equal(cal.plannedDay('2026-10-24',editor.email,empty),'rest');
assert.equal(cal.plannedDay('2026-10-23',editor.email,{...empty,shootDates:new Set(['2026-10-23'])}),'shoot');
assert.equal(cal.plannedDay('2026-10-23',editor.email,{...empty,events:[{kind:'holiday',start_date:'2025-10-23',end_date:'2025-10-23',recurring_yearly:1}]}),'rest');
assert.equal(cal.plannedDay('2026-10-23',editor.email,{...empty,events:[{kind:'leave',start_date:'2026-10-20',end_date:'2026-10-25',recurring_yearly:0,employee_email:editor.email}]}),'leave');
assert.equal(cal.plannedDay('2026-10-23',editor.email,{...empty,events:[{kind:'day_off',start_date:'2026-10-23',end_date:'2026-10-23',recurring_yearly:0,employee_email:'someone-else@example.test'}]}),'work');
assert.equal(cal.localDate(Date.parse('2026-10-22T21:00:00Z')),'2026-10-23');
const correction={email:editor.email,date:today,mode:'day_off',reason:'test correction'};assert.equal((await attendanceAdmin.PATCH(req('/api/admin/attendance',{method:'PATCH',token:hr.token,body:correction}))).status,200);req('/api/attendance',{token:editor.token});data=await(await attendance.GET(request)).json();assert.equal(data.today.mode,'day_off');
const message={id:crypto.randomUUID(),body:'test message'};
r=await messages.POST(req('/api/chat/messages',{method:'POST',token:editor.token,body:message}));assert.equal(r.status,201);const posted=(await r.json()).message;
assert.equal((await messages.POST(req('/api/chat/messages',{method:'POST',token:editor.token,body:message}))).status,200);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM staff_chat_messages WHERE id=?').get(message.id).n,1);
assert.equal((await messages.POST(req('/api/chat/messages',{method:'POST',token:hr.token,body:message}))).status,409);
for(let count=1;count>=0;count--){assert.equal((await reaction.POST(req('/api/chat/messages/'+message.id+'/reaction',{method:'POST',token:hr.token,body:{emoji:'❤️'}}),{params:Promise.resolve({id:message.id})})).status,200);r=await messages.GET(req('/api/chat/messages?afterCreated='+posted.created+'&afterId='+posted.id,{token:editor.token}));const payload=await r.json();assert.equal(payload.reactionState.length,count);assert.ok(payload.reactionScope.includes(message.id))}
assert.equal((await reaction.POST(req('/api/chat/messages/'+message.id+'/reaction',{method:'POST',token:hr.token,body:{emoji:'INVALID'}}),{params:Promise.resolve({id:message.id})})).status,400);
assert.ok(sql.prepare('SELECT COUNT(*) AS n FROM workspace_audit').get().n>=3);
console.log('PASS: protected Developer, preview permissions, Owner grants, HR boundaries, office validation, private location records, calendar exceptions, attendance correction, chat retries and reaction toggles.');

// Direct conversations remain private even from HR and Developer accounts.
const conversations=load('app/api/chat/conversations/route.ts'),activity=load('app/api/chat/activity/route.ts'),calls=load('app/api/chat/calls/route.ts'),pin=load('app/api/chat/messages/[id]/pin/route.ts'),attachment=load('app/api/chat/attachments/route.ts');
r=await conversations.POST(req('/api/chat/conversations',{method:'POST',token:editor.token,body:{userId:hr.id}}));assert.equal(r.status,200);const thread=(await r.json()).id;
assert.equal((await(await conversations.POST(req('/api/chat/conversations',{method:'POST',token:hr.token,body:{userId:editor.id}}))).json()).id,thread);
const dm={id:crypto.randomUUID(),conversationId:thread,body:'private message'};assert.equal((await messages.POST(req('/api/chat/messages',{method:'POST',token:editor.token,body:dm}))).status,201);
let privateData=await(await messages.GET(req('/api/chat/messages?conversationId='+thread,{token:hr.token}))).json();assert.equal(privateData.messages.length,1);assert.equal(privateData.messages[0].body,dm.body);
assert.equal((await messages.GET(req('/api/chat/messages?conversationId='+thread,{token:dev.token}))).status,404);
assert.equal((await messages.POST(req('/api/chat/messages',{method:'POST',token:dev.token,body:{...dm,id:crypto.randomUUID()}}))).status,404);
const teamData=await(await messages.GET(req('/api/chat/messages',{token:dev.token}))).json();assert.ok(!teamData.messages.some(m=>m.id===dm.id));
assert.equal((await reaction.POST(req('/api/chat/messages/'+dm.id+'/reaction',{method:'POST',token:dev.token,body:{emoji:'❤️'}}),{params:Promise.resolve({id:dm.id})})).status,404);
assert.equal((await pin.PATCH(req('/api/chat/messages/'+dm.id+'/pin',{method:'PATCH',token:dev.token,body:{pinned:true}}),{params:Promise.resolve({id:dm.id})})).status,404);
assert.equal((await activity.POST(req('/api/chat/activity',{method:'POST',token:dev.token,body:{conversationId:thread,typing:true}}))).status,404);
assert.equal((await activity.POST(req('/api/chat/activity',{method:'POST',token:hr.token,body:{conversationId:thread,typing:true,readAt:privateData.messages[0].created}}))).status,200);
privateData=await(await messages.GET(req('/api/chat/messages?conversationId='+thread,{token:editor.token}))).json();assert.ok(privateData.activity.some(p=>p.user_id===hr.id&&p.last_read>=privateData.messages[0].created&&p.typing_until>Date.now()));
assert.equal((await messages.POST(req('/api/chat/messages',{method:'POST',token:hr.token,body:{id:crypto.randomUUID(),body:'cross-thread reply',replyTo:dm.id}}))).status,400);
const replyMessage={id:crypto.randomUUID(),conversationId:thread,body:'reply',replyTo:dm.id};assert.equal((await messages.POST(req('/api/chat/messages',{method:'POST',token:hr.token,body:replyMessage}))).status,201);
privateData=await(await messages.GET(req('/api/chat/messages?conversationId='+thread,{token:editor.token}))).json();assert.equal(privateData.messages.find(m=>m.id===replyMessage.id).reply.body,dm.body);
sql.prepare('INSERT INTO chat_attachments (id,conversation_id,user_id,object_key,mime,name,created) VALUES (?,?,?,?,?,?,?)').run('private-image',thread,editor.id,'private-key','image/jpeg','photo',Date.now());
assert.equal((await attachment.GET(req('/api/chat/attachments?id=private-image',{token:dev.token}))).status,404);
assert.equal((await messages.POST(req('/api/chat/messages',{method:'POST',token:editor.token,body:{id:crypto.randomUUID(),body:'wrong-thread',attachmentId:'private-image'}}))).status,400);
assert.equal((await calls.POST(req('/api/chat/calls',{method:'POST',token:dev.token,body:{conversationId:thread}}))).status,404);
r=await calls.POST(req('/api/chat/calls',{method:'POST',token:editor.token,body:{conversationId:thread}}));assert.equal(r.status,201);const call=(await r.json()).call;assert.equal(call.mode,'video');assert.equal(call.url,undefined);
assert.equal((await calls.GET(req('/api/chat/calls?id='+call.id,{token:dev.token}))).status,404);assert.equal((await(await calls.GET(req('/api/chat/calls',{token:dev.token}))).json()).calls.length,0);
assert.equal((await calls.PATCH(req('/api/chat/calls',{method:'PATCH',token:hr.token,body:{id:call.id,action:'end'}}))).status,200);
assert.equal((await calls.PATCH(req('/api/chat/calls',{method:'PATCH',token:hr.token,body:{id:call.id,action:'declined'}}))).status,200);assert.equal((await(await calls.GET(req('/api/chat/calls',{token:hr.token}))).json()).calls.length,0);
assert.equal((await calls.PATCH(req('/api/chat/calls',{method:'PATCH',token:editor.token,body:{id:call.id,action:'end'}}))).status,200);
// Keyset pagination handles equal timestamps without skipping or repeating messages.
for(let n=0;n<70;n++)sql.prepare('INSERT INTO staff_chat_messages (id,author_user_id,author_email,author_name,author_role,body,conversation_id,created) VALUES (?,?,?,?,?,?,?,?)').run('page_'+String(n).padStart(3,'0'),editor.id,editor.email,'Test','Editor','page',thread,Date.now()+5000);
const page1=await(await messages.GET(req('/api/chat/messages?conversationId='+thread,{token:editor.token}))).json();assert.equal(page1.messages.length,50);assert.equal(page1.hasMore,true);const first=page1.messages[0];
const page2=await(await messages.GET(req('/api/chat/messages?conversationId='+thread+'&beforeCreated='+first.created+'&beforeId='+first.id,{token:editor.token}))).json();assert.ok(page2.messages.length>0);assert.ok(page2.messages.every(m=>!page1.messages.some(x=>x.id===m.id)));
for(let n=0;n<120;n++)sql.prepare('INSERT INTO staff_chat_messages (id,author_user_id,author_email,author_name,author_role,body,conversation_id,created) VALUES (?,?,?,?,?,?,?,?)').run('scope_'+n,editor.id,editor.email,'Test','Editor','scope',thread,Date.now()+10000);
assert.equal((await messages.GET(req('/api/chat/messages?conversationId='+thread+'&afterCreated='+first.created+'&afterId='+first.id,{token:editor.token}))).status,200);
console.log('PASS: direct message isolation, idempotent conversations, private reactions/pins/photos, read receipts, typing, scoped replies, call invites and pagination.');

// File-backed native uploads and legacy multipart requests both remain scoped and retryable.
const uploadId=crypto.randomUUID(),jpeg=new Uint8Array([255,216,255,224,1,2,3,4]);
function rawUpload(token,id=uploadId,conversation=thread,bytes=jpeg){request=new Request('https://test.example/api/chat/attachments?conversationId='+conversation+'&id='+id,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'image/jpeg'},body:bytes});return request}
assert.equal((await attachment.POST(rawUpload(dev.token))).status,404);
assert.equal((await attachment.POST(rawUpload(editor.token))).status,201);
assert.equal((await attachment.POST(rawUpload(editor.token))).status,200);
assert.equal(bucket.size,1,'An upload retry reuses the stored object');
assert.equal((await attachment.POST(rawUpload(hr.token))).status,409);
assert.equal((await attachment.POST(rawUpload(editor.token,crypto.randomUUID(),thread,new Uint8Array([0,0,0,0])))).status,400);
assert.equal((await attachment.GET(req('/api/chat/attachments?id='+uploadId,{token:hr.token}))).status,200);
assert.equal((await attachment.GET(req('/api/chat/attachments?id='+uploadId,{token:dev.token}))).status,404);
bucketDown=true;assert.equal((await attachment.POST(rawUpload(editor.token,crypto.randomUUID()))).status,503);bucketDown=false;
const form=new FormData();form.set('conversationId',thread);form.set('file',new File([jpeg],'image.jpg',{type:'image/jpeg'}));request=new Request('https://test.example/api/chat/attachments',{method:'POST',headers:{Authorization:'Bearer '+editor.token},body:form});assert.equal((await attachment.POST(request)).status,201);
const settings=load('app/api/chat/settings/route.ts'),media=load('app/api/chat/media/route.ts'),updates=load('app/api/chat/updates/route.ts');
assert.equal((await settings.PATCH(req('/api/chat/settings',{method:'PATCH',token:dev.token,body:{conversationId:thread,emoji:'🔥'}}))).status,404);
assert.equal((await settings.PATCH(req('/api/chat/settings',{method:'PATCH',token:editor.token,body:{conversationId:thread,emoji:'bad'}}))).status,400);
assert.equal((await settings.PATCH(req('/api/chat/settings',{method:'PATCH',token:editor.token,body:{conversationId:thread,emoji:'🔥',photoId:uploadId}}))).status,200);
assert.equal((await(await settings.GET(req('/api/chat/settings?conversationId='+thread,{token:hr.token}))).json()).settings.photoId,uploadId);
req('/api/chat/conversations',{token:hr.token});const inbox=await(await conversations.GET(request)).json();assert.equal(inbox.conversations[0].id,'team');assert.equal(inbox.conversations.find(t=>t.id===thread).settings.emoji,'🔥');
const stamp=Date.now();for(let i=0;i<34;i++)sql.prepare('INSERT INTO staff_chat_messages (id,author_user_id,author_email,author_name,author_role,body,conversation_id,attachment_id,created) VALUES (?,?,?,?,?,?,?,?,?)').run('media_'+String(i).padStart(3,'0'),editor.id,editor.email,'Editor','Video Editor','https://example.test/item',thread,uploadId,stamp);
const media1=await(await media.GET(req('/api/chat/media?conversationId='+thread,{token:hr.token}))).json();assert.equal(media1.items.length,30);assert.equal(media1.hasMore,true);const last=media1.items.at(-1),media2=await(await media.GET(req('/api/chat/media?conversationId='+thread+'&before='+last.created+'&beforeId='+last.id,{token:hr.token}))).json();assert.equal(media2.items.length,4);assert.ok(media2.items.every(i=>!media1.items.some(j=>i.id===j.id)));assert.equal((await media.GET(req('/api/chat/media?conversationId='+thread,{token:dev.token}))).status,404);
assert.equal((await(await updates.GET(req('/api/chat/updates?after=1',{token:dev.token}))).json()).messages.some(m=>m.conversationId===thread),false);
assert.ok((await(await updates.GET(req('/api/chat/updates?after=1',{token:hr.token}))).json()).messages.some(m=>m.conversationId===thread));
console.log('PASS: binary and multipart photo upload, retries, storage error feedback, shared settings, pinned main conversation, full media pagination, private notification feed.');
const rtc=load('app/api/chat/calls/session/route.ts');
const audio=(await(await calls.POST(req('/api/chat/calls',{method:'POST',token:hr.token,body:{conversationId:thread,mode:'audio'}}))).json()).call;assert.equal(audio.mode,'audio');
const hrSession=crypto.randomUUID(),editorSession=crypto.randomUUID();
const join=(who,sessionId,id=audio.id)=>rtc.POST(req('/api/chat/calls/session',{method:'POST',token:who.token,body:{id,sessionId,action:'join'}}));
assert.equal((await join(dev,crypto.randomUUID())).status,404);
assert.equal((await join(hr,hrSession)).status,200);assert.equal((await join(editor,editorSession)).status,200);
const payload={id:audio.id,sessionId:hrSession,action:'signal',target:editor.id,targetSession:editorSession,signalId:crypto.randomUUID(),payload:{type:'offer',sdp:'test'}};
assert.equal((await rtc.POST(req('/api/chat/calls/session',{method:'POST',token:hr.token,body:payload}))).status,200);assert.equal((await rtc.POST(req('/api/chat/calls/session',{method:'POST',token:hr.token,body:payload}))).status,200);
const poll=async(who,sessionId)=>rtc.GET(req('/api/chat/calls/session?id='+audio.id+'&sessionId='+sessionId,{token:who.token}));
const signalData=await(await poll(editor,editorSession)).json();assert.equal(signalData.signals.length,1);assert.equal(signalData.signals[0].sender,hr.id);assert.equal(signalData.peers.length,1);assert.equal((await poll(dev,crypto.randomUUID())).status,404);
assert.equal((await rtc.POST(req('/api/chat/calls/session',{method:'POST',token:hr.token,body:{...payload,signalId:crypto.randomUUID(),target:dev.id}}))).status,409);
// A brief signaling gap must not end healthy media or reject a still-current device.
sql.prepare('UPDATE chat_calls SET created=? WHERE id=?').run(Date.now()-180000,audio.id);
sql.prepare('UPDATE call_members SET seen=? WHERE call_id=?').run(Date.now()-60000,audio.id);
await calls.GET(req('/api/chat/calls',{token:hr.token}));assert.equal(sql.prepare('SELECT ended FROM chat_calls WHERE id=?').get(audio.id).ended,null,'60s signaling gap does not expire an active call');
const recovering=await(await poll(editor,editorSession)).json();assert.equal(recovering.peers.length,1,'peer stays discoverable through a brief polling interruption');
const mediaSignal={...payload,signalId:crypto.randomUUID(),payload:{type:'media',camera:false}};
assert.equal((await rtc.POST(req('/api/chat/calls/session',{method:'POST',token:hr.token,body:mediaSignal}))).status,200);
const mediaState=(await(await poll(editor,editorSession)).json()).signals.find(s=>s.payload.type==='media');assert.equal(mediaState.payload.camera,false);assert.equal(mediaState.payload.sessionId,hrSession);
for(const invalid of [{type:'media',camera:'false'},{type:'media',camera:true,sdp:'unexpected'},{type:'media',camera:true,sessionId:'spoof'}])assert.equal((await rtc.POST(req('/api/chat/calls/session',{method:'POST',token:hr.token,body:{...mediaSignal,signalId:crypto.randomUUID(),payload:invalid}}))).status,400,'media signal accepts boolean state only');
assert.equal((await rtc.POST(req('/api/chat/calls/session',{method:'POST',token:dev.token,body:mediaSignal}))).status,404,'nonmember cannot relay media state');
const replaced=crypto.randomUUID();assert.equal((await join(editor,replaced)).status,200);assert.equal((await poll(editor,editorSession)).status,409);assert.equal((await(await poll(editor,replaced)).json()).signals.length,0,'Old device signals must not replay to a replacement device');
assert.equal((await rtc.POST(req('/api/chat/calls/session',{method:'POST',token:editor.token,body:{id:audio.id,sessionId:editorSession,action:'leave'}}))).status,200);assert.equal(sql.prepare('SELECT ended FROM chat_calls WHERE id=?').get(audio.id).ended,null,'Old device leave cannot end replacement call');
sql.prepare('UPDATE call_members SET seen=? WHERE call_id=? AND user_id=?').run(Date.now()-95000,audio.id,hr.id);
assert.equal((await rtc.POST(req('/api/chat/calls/session',{method:'POST',token:hr.token,body:{...mediaSignal,signalId:crypto.randomUUID()}}))).status,410,'direct call ends when peer is stale beyond grace');
assert.equal((await(await poll(editor,replaced)).json()).ended,true);
assert.equal((await calls.PATCH(req('/api/chat/calls',{method:'PATCH',token:hr.token,body:{id:audio.id,action:'end'}}))).status,200);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM call_signals WHERE call_id=?').get(audio.id).n,0);
// Six-person mesh limit is enforced on the server, not just hidden in the UI.
const groupId=crypto.randomUUID();sql.prepare("INSERT INTO chat_calls (id,conversation_id,created_by,creator_name,room,mode,created) VALUES (?,'team',?,'test','room','video',?)").run(groupId,dev.id,Date.now());
for(let n=0;n<6;n++)sql.prepare('INSERT INTO call_members (call_id,user_id,session_id,name,seen) VALUES (?,?,?,?,?)').run(groupId,'member_'+n,crypto.randomUUID(),'Test',Date.now());
assert.equal((await join(dev,crypto.randomUUID(),groupId)).status,409);
sql.prepare('UPDATE call_members SET seen=0 WHERE call_id=? AND user_id=?').run(groupId,'member_0');assert.equal((await join(dev,crypto.randomUUID(),groupId)).status,200);
const abandoned=crypto.randomUUID();sql.prepare("INSERT INTO chat_calls (id,conversation_id,created_by,creator_name,room,mode,created) VALUES (?,'team',?,'test','room','audio',?)").run(abandoned,dev.id,Date.now()-120000);await calls.GET(req('/api/chat/calls',{token:dev.token}));assert.ok(sql.prepare('SELECT ended FROM chat_calls WHERE id=?').get(abandoned).ended,'Abandoned calls expire after the invitation window');
console.log('PASS: internal audio/video call authorization, joined-only signaling, idempotent signals, recipient sessions, device replacement, end cleanup.');
// Direct/group lifecycle: authoritative answer time, caller summary, bilateral end,30s no-answer deadline.
const audioSummary=sql.prepare('SELECT author_user_id,body,duration_ms FROM staff_chat_messages WHERE id=?').get('call:'+audio.id);assert.equal(audioSummary.author_user_id,hr.id);assert.match(audioSummary.body,/აუდიოზარი.*ხანგრძლივობა/);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM staff_chat_messages WHERE id=?').get('call:'+audio.id).n,1);
const lifecycle=load('lib/call-lifecycle.ts');
const directNew=(await(await calls.POST(req('/api/chat/calls',{method:'POST',token:editor.token,body:{conversationId:thread,mode:'video'}}))).json()).call;assert.equal(directNew.isGroup,false);assert.equal(directNew.ringUntil-directNew.created,30000);
const directCaller=crypto.randomUUID(),directCallee=crypto.randomUUID();assert.equal((await join(editor,directCaller,directNew.id)).status,200);const answerData=await(await join(hr,directCallee,directNew.id)).json();assert.ok(answerData.answeredAt);assert.equal(answerData.maxParticipants,2);
sql.prepare('UPDATE workspace_settings SET value=? WHERE key=?').run(String(Date.now()-65000),'call_answered:'+directNew.id);
assert.equal((await calls.PATCH(req('/api/chat/calls',{method:'PATCH',token:hr.token,body:{id:directNew.id,action:'left'}}))).status,200);assert.ok((await(await calls.GET(req('/api/chat/calls?id='+directNew.id,{token:editor.token}))).json()).call.ended);
const summary=sql.prepare('SELECT author_user_id,body FROM staff_chat_messages WHERE id=?').get('call:'+directNew.id);assert.equal(summary.author_user_id,editor.id);assert.match(summary.body,/ვიდეოზარი.*1:05/);await calls.PATCH(req('/api/chat/calls',{method:'PATCH',token:editor.token,body:{id:directNew.id,action:'left'}}));assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM staff_chat_messages WHERE id=?').get('call:'+directNew.id).n,1);
const noAnswer=crypto.randomUUID();sql.prepare("INSERT INTO chat_calls (id,conversation_id,created_by,creator_name,room,mode,created) VALUES (?,?,?,'Caller','room','audio',?)").run(noAnswer,thread,editor.id,Date.now()-31000);sql.prepare('INSERT INTO call_members (call_id,user_id,session_id,name,seen) VALUES (?,?,?,?,?)').run(noAnswer,editor.id,crypto.randomUUID(),'Caller',Date.now());
assert.equal((await join(hr,crypto.randomUUID(),noAnswer)).status,410,'late answer cannot revive unanswered call');assert.match(sql.prepare('SELECT body FROM staff_chat_messages WHERE id=?').get('call:'+noAnswer).body,/უპასუხოდ/);
const continued=crypto.randomUUID();sql.prepare("INSERT INTO chat_calls (id,conversation_id,created_by,creator_name,room,mode,created) VALUES (?,'team',?,'Group caller','room','video',?)").run(continued,dev.id,Date.now());
const groupCreator=crypto.randomUUID(),groupPeer=crypto.randomUUID(),groupPeer2=crypto.randomUUID();await join(dev,groupCreator,continued);await join(editor,groupPeer,continued);await join(hr,groupPeer2,continued);
assert.equal((await calls.PATCH(req('/api/chat/calls',{method:'PATCH',token:dev.token,body:{id:continued,action:'end'}}))).status,200);assert.equal(sql.prepare('SELECT ended FROM chat_calls WHERE id=?').get(continued).ended,null,'group creator leaves without ending peers');assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM call_members WHERE call_id=?').get(continued).n,2);
await rtc.POST(req('/api/chat/calls/session',{method:'POST',token:editor.token,body:{id:continued,sessionId:groupPeer,action:'leave'}}));assert.equal(sql.prepare('SELECT ended FROM chat_calls WHERE id=?').get(continued).ended,null,'group continues with one remaining participant');
await rtc.POST(req('/api/chat/calls/session',{method:'POST',token:hr.token,body:{id:continued,sessionId:groupPeer2,action:'leave'}}));assert.ok(sql.prepare('SELECT ended FROM chat_calls WHERE id=?').get(continued).ended);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM staff_chat_messages WHERE id=?').get('call:'+continued).n,1);
const cancelledGroup=crypto.randomUUID();sql.prepare("INSERT INTO chat_calls (id,conversation_id,created_by,creator_name,room,mode,created) VALUES (?,'team',?,'Caller','room','audio',?)").run(cancelledGroup,dev.id,Date.now()-31000);sql.prepare('INSERT INTO call_members (call_id,user_id,session_id,name,seen) VALUES (?,?,?,?,?)').run(cancelledGroup,dev.id,crypto.randomUUID(),'Caller',Date.now());await calls.GET(req('/api/chat/calls',{token:dev.token}));assert.ok(sql.prepare('SELECT ended FROM chat_calls WHERE id=?').get(cancelledGroup).ended,'group invitation times out even while caller is connected alone');
// Interleave replacement precisely at the direct end transaction, after access read.
const raceId=crypto.randomUUID(),oldSession=crypto.randomUUID(),newSession=crypto.randomUUID();
sql.prepare("INSERT INTO chat_calls (id,conversation_id,created_by,creator_name,room,mode,created) VALUES (?,?,?,'Caller','room','audio',?)").run(raceId,thread,editor.id,Date.now());sql.prepare('INSERT INTO call_members (call_id,user_id,session_id,name,seen) VALUES (?,?,?,?,?)').run(raceId,editor.id,oldSession,'Caller',Date.now());
let replacementInterleaved=false;beforeBatch=async statements=>{if(statements.some(s=>s.query.startsWith('UPDATE chat_calls AS c SET ended='))){beforeBatch=null;replacementInterleaved=true;sql.prepare('INSERT INTO call_members (call_id,user_id,session_id,name,seen) VALUES (?,?,?,?,?) ON CONFLICT(call_id,user_id) DO UPDATE SET session_id=excluded.session_id').run(raceId,editor.id,newSession,'Caller',Date.now())}};
await rtc.POST(req('/api/chat/calls/session',{method:'POST',token:editor.token,body:{id:raceId,sessionId:oldSession,action:'leave'}}));assert.ok(replacementInterleaved);assert.equal(sql.prepare('SELECT ended FROM chat_calls WHERE id=?').get(raceId).ended,null,'replacement inserted just before leave commit survives');assert.equal(sql.prepare('SELECT session_id FROM call_members WHERE call_id=?').get(raceId).session_id,newSession);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM staff_chat_messages WHERE id=?').get('call:'+raceId).n,0);
// An expiry poll immediately after a last-millisecond join sees answeredAt atomically.
const originalNow=Date.now;let clock=originalNow(),deadlineInterleaved=false;Date.now=()=>clock;
try{const deadlineId=crypto.randomUUID();sql.prepare("INSERT INTO chat_calls (id,conversation_id,created_by,creator_name,room,mode,created) VALUES (?,?,?,'Caller','room','audio',?)").run(deadlineId,thread,editor.id,clock-29999);sql.prepare('INSERT INTO call_members (call_id,user_id,session_id,name,seen) VALUES (?,?,?,?,?)').run(deadlineId,editor.id,crypto.randomUUID(),'Caller',clock);
 afterBatch=async statements=>{if(statements.some(s=>s.query.startsWith('INSERT INTO call_members'))){afterBatch=null;deadlineInterleaved=true;clock+=2;await lifecycle.expireCalls(deadlineId)}};
 const nearDeadline=await join(hr,crypto.randomUUID(),deadlineId);assert.equal(nearDeadline.status,200);assert.ok(deadlineInterleaved);assert.ok((await nearDeadline.json()).answeredAt);assert.equal(sql.prepare('SELECT ended FROM chat_calls WHERE id=?').get(deadlineId).ended,null,'join committed before deadline cannot be expired between member/answer writes');
}finally{Date.now=originalNow;beforeBatch=null;afterBatch=null}
console.log('PASS direct bilateral end, caller-authored idempotent duration summary,30s unanswered expiry, atomic deadline answer and replacement leave, group creator/last-member leave.');
const push=load('app/api/mobile/push/route.ts');
for(const [who,label] of [[hr,'hr'],[dev,'developer'],[editor,'editor']])assert.equal((await push.POST(req('/api/mobile/push',{method:'POST',token:who.token,body:{token:'ExpoPushToken[testing_'+label+'_device]'}}))).status,200);
for(const job of afterJobs)await job();
const dmPush=pushRequests.filter(p=>p.data.conversationId===thread&&!p.data.callId);assert.ok(dmPush.length>0);assert.ok(dmPush.every(p=>{const author=sql.prepare('SELECT author_user_id FROM staff_chat_messages WHERE id=?').get(p.data.messageId).author_user_id;return p.to===(author===editor.id?'ExpoPushToken[testing_hr_device]':'ExpoPushToken[testing_editor_device]')}),'Private messages must only notify the other participant');assert.ok(dmPush.every(p=>p.data.messageId));
const beforeJobs=pushRequests.length;for(const job of afterJobs)await job();assert.equal(pushRequests.length,beforeJobs,'Delivered jobs do not send again');
assert.equal((await push.DELETE(req('/api/mobile/push',{method:'DELETE',token:dev.token,body:{token:'ExpoPushToken[testing_hr_device]'}}))).status,200);assert.ok(sql.prepare('SELECT token FROM push_devices WHERE user_id=?').get(hr.id));
assert.equal((await push.DELETE(req('/api/mobile/push',{method:'DELETE',token:hr.token,body:{token:'ExpoPushToken[testing_hr_device]'}}))).status,200);assert.equal(sql.prepare('SELECT token FROM push_devices WHERE user_id=?').get(hr.id),undefined);
console.log('PASS: push recipients, private routing, durable jobs, repeat suppression and owned device removal (network mocked).');

// Voice files use the same private scope and idempotency as images.
const voiceId=crypto.randomUUID(),voiceBytes=new Uint8Array(128);voiceBytes.set(new TextEncoder().encode('RIFF'),0);voiceBytes.set(new TextEncoder().encode('WAVE'),8);
function voiceUpload(token,id=voiceId,duration=1800,bytes=voiceBytes){request=new Request('https://test.example/api/chat/attachments?conversationId='+thread+'&id='+id+'&durationMs='+duration,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'audio/wav'},body:bytes});return request}
assert.equal((await attachment.POST(voiceUpload(hr.token))).status,201);
assert.equal((await attachment.POST(voiceUpload(hr.token))).status,200);
assert.equal((await attachment.POST(voiceUpload(dev.token))).status,404);
assert.equal((await attachment.POST(voiceUpload(hr.token,crypto.randomUUID(),300001))).status,400);
assert.equal((await attachment.POST(voiceUpload(hr.token,crypto.randomUUID(),1800,jpeg))).status,400);
const voiceMessageId=crypto.randomUUID();r=await messages.POST(req('/api/chat/messages',{method:'POST',token:hr.token,body:{id:voiceMessageId,body:'',conversationId:thread,attachmentId:voiceId,kind:'image',durationMs:999999}}));assert.equal(r.status,201);const voiceMessage=(await r.json()).message;assert.equal(voiceMessage.kind,'audio');assert.equal(voiceMessage.durationMs,1800);
assert.equal((await settings.PATCH(req('/api/chat/settings',{method:'PATCH',token:hr.token,body:{conversationId:thread,photoId:voiceId}}))).status,400);
const voicePage=await(await media.GET(req('/api/chat/media?conversationId='+thread+'&kind=audio',{token:editor.token}))).json();assert.equal(voicePage.items.length,1);assert.equal(voicePage.items[0].attachmentId,voiceId);
assert.ok(!(await(await media.GET(req('/api/chat/media?conversationId='+thread,{token:editor.token}))).json()).items.some(m=>m.attachmentId===voiceId));
r=await attachment.GET(req('/api/chat/attachments?id='+voiceId,{token:editor.token,headers:{Range:'bytes=4-15'}}));assert.equal(r.status,206);assert.equal(r.headers.get('Content-Type'),'audio/wav');assert.equal((await r.arrayBuffer()).byteLength,12);
assert.equal((await attachment.GET(req('/api/chat/attachments?id='+voiceId,{token:dev.token,headers:{Range:'bytes=0-10'}}))).status,404);
assert.equal((await attachment.GET(req('/api/chat/attachments?id='+voiceId,{token:hr.token,headers:{Range:'bytes=900-1000'}}))).status,416);
console.log('PASS: voice upload/retry, MIME validation, bounded duration, server-derived kind, audio gallery, authenticated range streaming.');

const preferences=load('app/api/chat/preferences/route.ts');
assert.equal((await preferences.PATCH(req('/api/chat/preferences',{method:'PATCH',token:dev.token,body:{conversationId:thread,muted:true}}))).status,404);
assert.equal((await preferences.PATCH(req('/api/chat/preferences',{method:'PATCH',token:hr.token,body:{conversationId:thread,muted:'yes'}}))).status,400);
assert.equal((await preferences.PATCH(req('/api/chat/preferences',{method:'PATCH',token:editor.token,body:{conversationId:thread,muted:true,userId:hr.id}}))).status,200);
req('/api/chat/preferences',{token:hr.token});assert.deepEqual(Array.from((await(await preferences.GET()).json()).mutedIds),[]);
const mutedFeed=await(await updates.GET(req('/api/chat/updates?after=1',{token:editor.token}))).json();assert.ok(mutedFeed.messages.some(m=>m.id===voiceMessageId&&m.muted===1),'Muted messages advance the cursor but do not alert');
const pushLib=load('lib/push.ts'),silentJob=crypto.randomUUID();await pushLib.queuePush(silentJob,thread,hr.id,'Test','muted voice').run();const pushBefore=pushRequests.length;pushLib.dispatchPush();await afterJobs.at(-1)();assert.ok(!pushRequests.slice(pushBefore).some(p=>p.data.messageId===silentJob),'Mute is checked at push delivery');
assert.equal((await preferences.PATCH(req('/api/chat/preferences',{method:'PATCH',token:editor.token,body:{conversationId:thread,muted:false}}))).status,200);const audibleJob=crypto.randomUUID();await pushLib.queuePush(audibleJob,thread,hr.id,'Test','unmuted').run();pushLib.dispatchPush();await afterJobs.at(-1)();assert.ok(pushRequests.some(p=>p.data.messageId===audibleJob&&p.to==='ExpoPushToken[testing_editor_device]'));
console.log('PASS: account-scoped mute, inaccessible-thread rejection, cursor continuity and push suppression/unmute.');

const birthdays=load('lib/birthdays.ts'),calendarRoute=load('app/api/calendar/route.ts');
const birthdayPeople=[{id:'leap',full_name:'Leap Person',birth_date:'2000-02-29'},{id:'january',full_name:'New Year',birth_date:'1991-01-02'},{id:'invalid',full_name:'Invalid',birth_date:'2000-02-30'}];
assert.equal(birthdays.birthdayEvents(birthdayPeople,'2027-02-01','2027-02-28')[0].start_date,'2027-02-28');assert.equal(birthdays.birthdayEvents(birthdayPeople,'2028-02-01','2028-02-29')[0].start_date,'2028-02-29');assert.equal(birthdays.birthdayEvents(birthdayPeople,'2026-12-28','2027-01-03')[0].title,'New Year — დაბადების დღე');
sql.prepare('INSERT INTO employees (id,full_name,birth_date,personal_number,email,phone,position,created,updated) VALUES (?,?,?,?,?,?,?,?,?)').run('birthday-test','Test Birthday','1994-10-25','PRIVATE-ID','birthday@example.test','PRIVATE-PHONE','Editor',1,1);
const calendarPayload=await(await calendarRoute.GET(req('/api/calendar?from=2026-10-23&to=2026-10-29',{token:editor.token}))).json();const birthday=calendarPayload.events.find(e=>e.id.startsWith('birthday-'));assert.equal(birthday.employee_name,'Test Birthday');assert.equal(birthday.start_date,'2026-10-25');assert.ok(!JSON.stringify(birthday).includes('1994'));assert.ok(!JSON.stringify(birthday).includes('PRIVATE'));assert.equal(birthday.employee_email,null);
sql.prepare('UPDATE employees SET birth_date=? WHERE id=?').run('1994-11-01','birthday-test');assert.ok(!(await(await calendarRoute.GET(req('/api/calendar?from=2026-10-23&to=2026-10-29',{token:editor.token}))).json()).events.some(e=>e.kind==='birthday'));
console.log('PASS: birthdays recur across years, leap day observed on Feb 28, live employee edits, no birth year/private profile exposure.');

const shootPhoto=load('app/api/shoots/photo/route.ts'),shootRoute=load('app/api/shoots/route.ts'),singleShoot=load('app/api/shoots/[id]/route.ts'),shootPhotoId=crypto.randomUUID();
function uploadShoot(token,id=shootPhotoId){request=new Request('https://test.example/api/shoots/photo?id='+id,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'image/jpeg'},body:jpeg});return request}
assert.equal((await shootPhoto.POST(uploadShoot(hr.token))).status,201);assert.equal((await shootPhoto.POST(uploadShoot(hr.token))).status,200);
assert.equal((await shootPhoto.GET(req('/api/shoots/photo?id='+shootPhotoId,{token:editor.token}))).status,404,'Unattached upload is private to its author');
const newShoot={title:'Photo test',shootDate:'2026-11-04',startTime:'12:00',endTime:'13:00',locationName:'Office',locationUrl:'',details:'Photo details',status:'planned',assignments:[],photoId:shootPhotoId};
assert.equal((await shootRoute.POST(req('/api/shoots',{method:'POST',token:dev.token,body:newShoot}))).status,400,'Cannot attach another user’s unassigned photo');
r=await shootRoute.POST(req('/api/shoots',{method:'POST',token:hr.token,body:newShoot}));assert.equal(r.status,200);const shoot=(await r.json()).shoot;assert.equal(shoot.photo_id,shootPhotoId);
assert.equal((await shootPhoto.GET(req('/api/shoots/photo?id='+shootPhotoId,{token:editor.token}))).status,200);
assert.equal((await shootPhoto.GET(req('/api/shoots/photo?id='+shootPhotoId))).status,403);
const {photoId,...legacyShoot}=newShoot;r=await singleShoot.PATCH(req('/api/shoots/'+shoot.id,{method:'PATCH',token:hr.token,body:legacyShoot}),{params:Promise.resolve({id:shoot.id})});assert.equal(r.status,200);assert.equal((await r.json()).shoot.photo_id,photoId,'Older clients preserve attachments');
r=await singleShoot.PATCH(req('/api/shoots/'+shoot.id,{method:'PATCH',token:hr.token,body:{...newShoot,photoId:null}}),{params:Promise.resolve({id:shoot.id})});assert.equal(r.status,200);assert.equal((await r.json()).shoot.photo_id,null);
console.log('PASS: shoot photo retry/authorization, create/edit/remove, private drafts, staff visibility and older-client compatibility.');
// Historical map locations remain available after their scheduled day.
const mapRoute=load('app/api/workspace/map/route.ts'),shortsRoute=load('app/api/mobile/shorts/route.ts');
assert.equal((await mapRoute.GET(req('/api/workspace/map'))).status,403);
for(let i=0;i<105;i++)sql.prepare("INSERT INTO shoots (id,title,shoot_date,start_time,end_time,location_name,details,status,created,updated,created_by,updated_by,latitude,longitude) VALUES (?,?,?,'12:00','13:00','Office','','planned',1,1,'test','test',41.7,44.8)").run('history_'+String(i).padStart(3,'0'),'Historic shoot '+i,'2020-01-10');
sql.prepare("UPDATE shoots SET status='cancelled' WHERE id='history_000'").run();
sql.prepare("INSERT INTO shoots (id,title,shoot_date,start_time,end_time,location_name,details,status,created,updated,created_by,updated_by) VALUES ('completed-today','Today',?,'09:00','10:00','Office','','completed',1,1,'test','test')").run(today);
const mapFirst=await(await mapRoute.GET(req('/api/workspace/map',{token:editor.token}))).json();assert.equal(mapFirst.history.length,100);assert.ok(mapFirst.historyCursor);assert.ok(mapFirst.history.some(s=>s.id==='completed-today'));assert.ok(mapFirst.shoots.every(s=>s.shoot_date>=today&&s.status==='planned'));
const hc=mapFirst.historyCursor,mapSecond=await(await mapRoute.GET(req('/api/workspace/map?beforeDate='+hc.date+'&beforeId='+hc.id,{token:editor.token}))).json();assert.ok(mapSecond.history.length>0);assert.equal(mapSecond.historyCursor,null);const allHistory=[...mapFirst.history,...mapSecond.history];assert.equal(new Set(allHistory.map(s=>s.id)).size,allHistory.length);assert.equal(allHistory.filter(s=>s.id.startsWith('history_')).length,104);assert.ok(!allHistory.some(s=>s.id==='history_000'));assert.ok(allHistory.find(s=>s.id==='history_001').latitude===41.7);
assert.equal((await mapRoute.GET(req('/api/workspace/map?beforeDate=bad',{token:editor.token}))).status,400);
assert.equal((await shortsRoute.GET(req('/api/mobile/shorts'))).status,403);
req('/api/mobile/shorts',{token:editor.token});let shorts=await(await shortsRoute.GET()).json();assert.equal(shorts.canManage,false);assert.equal(shorts.sources.youtube.url,'https://www.youtube.com/@hungrymantv/shorts');assert.equal(shorts.sources.tiktok.handle,'hungryman.ge');
const handles={youtube:'hungrymantv',instagram:'hungrymantv',tiktok:'hungryman.ge'};
for(const staff of [editor,hr])assert.equal((await shortsRoute.PUT(req('/api/mobile/shorts',{method:'PUT',token:staff.token,body:handles}))).status,403);
assert.equal((await shortsRoute.PUT(req('/api/mobile/shorts',{method:'PUT',token:dev.token,headers:{'X-HMW-Preview-Role':'HR'},body:handles}))).status,403);
for(const value of ['https://evil.example','../../admin','someone?url=evil','x'])assert.equal((await shortsRoute.PUT(req('/api/mobile/shorts',{method:'PUT',token:dev.token,body:{...handles,tiktok:value}}))).status,400);
assert.equal((await shortsRoute.PUT(req('/api/mobile/shorts',{method:'PUT',token:dev.token,body:{...handles,tiktok:'@hungryman.ge'}}))).status,200);req('/api/mobile/shorts',{token:dev.token});shorts=await(await shortsRoute.GET()).json();assert.equal(shorts.canManage,true);assert.equal(shorts.sources.tiktok.url,'https://www.tiktok.com/@hungryman.ge');
r=await attachment.GET(req('/api/chat/attachments?id='+voiceId,{token:editor.token}));assert.equal(r.status,200);assert.equal(r.headers.get('Content-Length'),String(voiceBytes.byteLength));assert.match(r.headers.get('Content-Disposition'),/\.wav/);assert.equal((await r.arrayBuffer()).byteLength,voiceBytes.byteLength);
console.log('PASS: authenticated map history, stable pagination, cancelled exclusion, preserved coordinates, owner-only mobile Shorts sources, strict handles and audio length headers.');
sql.close();
