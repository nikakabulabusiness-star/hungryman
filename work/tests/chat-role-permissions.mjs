import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

const sql=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
function statement(query,args=[]){return {bind(...next){assert.ok(next.length<=100);return statement(query,next)},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}})}}
const DB={prepare:statement,batch:async statements=>{sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}};
const people=[
 ['dev','Developer'],['hr','HR'],['owner','Owner'],['creative','კრეატიული დირექტორი'],['technical','ტექნიკური დირექტორი'],['technical2','ტექნიკური დირექტორი'],
 ['writer','სცენარისტი'],['producer','პროდიუსერი'],['editor','Video Editor'],['other','Video Editor'],['camera','ოპერატორი'],['social','სოციალური მედია'],
].map(([userId,role])=>({userId,role,email:userId+'@test.example',fullName:userId,hasAvatar:false,profileUpdated:0,lastSeen:0,isOwner:role==='Owner'}));
let current=null;
const modules=new Map();
function load(file){
 if(modules.has(file))return modules.get(file);const exports={};modules.set(file,exports);
 const require=name=>{
  if(name==='@/lib/storage'||name==='./storage')return {storage:()=>({DB,BUCKET:{}})};
  if(name==='@/lib/staff-access'||name==='./staff-access')return {getStaffAccess:async()=>current,listApprovedStaff:async()=>people,syncStaffProfile:async a=>a};
  if(name==='@/lib/visitor')return {sameOrigin:r=>!r.headers.get('origin')||r.headers.get('origin')==='https://test.example'};
  if(name==='@/lib/push')return {queuePush:()=>statement('SELECT 1'),dispatchPush:()=>{}};
  if(name.startsWith('@/')||name.startsWith('.')){const base=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);return load(base.endsWith('.ts')?base:base+'.ts')}
  throw Error('Unexpected module '+name);
 };
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require,URL,Response,Request,Headers,FormData,File,crypto,Uint8Array,TextEncoder,TextDecoder,Date,Intl,console,setTimeout,clearTimeout});return exports;
}
const policy=load('lib/permissions.ts');
function actor(id,permissions){const p=people.find(p=>p.userId===id);current={...p,isApproved:true,isDeveloper:p.role==='Developer',permissions:permissions??policy.defaultPermissions(p.role)};return current}
function req(route,method='GET',body){return new Request('https://test.example'+route,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})}
async function json(result,status=200){assert.equal(result.status,status,await result.clone().text());return result.json()}
const conversations=load('app/api/chat/conversations/route.ts'),preferences=load('app/api/chat/preferences/route.ts'),messages=load('app/api/chat/messages/route.ts'),settings=load('app/api/chat/settings/route.ts'),reaction=load('app/api/chat/messages/[id]/reaction/route.ts'),pin=load('app/api/chat/messages/[id]/pin/route.ts'),calls=load('app/api/chat/calls/route.ts'),attachment=load('app/api/chat/attachments/route.ts'),updates=load('app/api/chat/updates/route.ts');

actor('creative');let directory=await json(await conversations.GET(req('/api/chat/conversations')));
assert.deepEqual(directory.departments.map(d=>d.id),['story','preproduction']);assert.equal(directory.permissions.canSelectDepartments,true);
assert.equal(directory.people.find(p=>p.userId==='editor').departmentId,'production');
const story=(await json(await conversations.POST(req('/api/chat/conversations','POST',{title:'Story planning',memberIds:[],departmentIds:['story']})),201)).id;
assert.deepEqual(sql.prepare('SELECT user_id FROM chat_group_members WHERE conversation_id=? ORDER BY user_id').all(story).map(m=>m.user_id),['creative','producer','writer']);
assert.equal((await conversations.POST(req('/api/chat/conversations','POST',{title:'Wrong department',departmentIds:['production']}))).status,403);
assert.equal((await conversations.PATCH(req('/api/chat/conversations','PATCH',{id:story,departmentIds:['social']}))).status,403);
actor('technical');directory=await json(await conversations.GET(req('/api/chat/conversations')));assert.deepEqual(directory.departments.map(d=>d.id),['technical']);
const prep=(await json(await conversations.POST(req('/api/chat/conversations','POST',{title:'Preproduction planning',departmentIds:['technical']})),201)).id;
assert.deepEqual(sql.prepare('SELECT user_id FROM chat_group_members WHERE conversation_id=? ORDER BY user_id').all(prep).map(m=>m.user_id),['technical','technical2']);
actor('creative');const multiple=(await json(await conversations.POST(req('/api/chat/conversations','POST',{title:'Combined planning',departmentIds:['story','preproduction']})),201)).id;
assert.deepEqual(sql.prepare('SELECT user_id FROM chat_group_members WHERE conversation_id=? ORDER BY user_id').all(multiple).map(m=>m.user_id),['camera','creative','producer','writer']);
actor('hr');directory=await json(await conversations.GET(req('/api/chat/conversations')));assert.ok(directory.departments.some(d=>d.id==='story')&&directory.departments.some(d=>d.id==='production'));
console.log('PASS department audiences: hierarchy scope, current active member expansion, forged/foreign department rejection.');

actor('editor');const group=(await json(await conversations.POST(req('/api/chat/conversations','POST',{title:'Editing',memberIds:['other','other','editor']})),201)).id;
assert.equal(sql.prepare('SELECT COUNT(*) n FROM chat_group_members WHERE conversation_id=?').get(group).n,2);
assert.equal((await conversations.POST(req('/api/chat/conversations','POST',{title:'Forged department',memberIds:['other'],departmentIds:['production']}))).status,403);
assert.equal((await conversations.POST(req('/api/chat/conversations','POST',{title:'Missing member',memberIds:['does-not-exist']}))).status,400);
assert.equal((await conversations.POST(req('/api/chat/conversations','POST',null))).status,400);
assert.equal((await conversations.PATCH(req('/api/chat/conversations','PATCH',{id:'team',title:'Replace main chat'}))).status,404);
await json(await preferences.PATCH(req('/api/chat/preferences','PATCH',{conversationId:group,muted:true})));
assert.ok((await json(await preferences.GET())).mutedIds.includes(group));
await json(await preferences.PATCH(req('/api/chat/preferences','PATCH',{conversationId:group,muted:false})));
assert.ok(!(await json(await preferences.GET())).mutedIds.includes(group));
const dm=(await json(await conversations.POST(req('/api/chat/conversations','POST',{userId:'other'})))).id;
actor('other');assert.equal((await json(await conversations.POST(req('/api/chat/conversations','POST',{userId:'editor'})))).id,dm);
actor('dev');assert.equal((await conversations.GET(req('/api/chat/conversations?id='+group))).status,404);
actor('writer');assert.equal((await conversations.PATCH(req('/api/chat/conversations','PATCH',{id:group,title:'Take over'}))).status,404);
console.log('PASS group privacy, deduplication, immutable main chat, deterministic direct chats and group mute persistence.');

const base=policy.defaultPermissions('Video Editor');actor('editor',base.filter(p=>p!=='chat.send'));
assert.equal((await conversations.POST(req('/api/chat/conversations','POST',{userId:'other'}))).status,403);
assert.equal((await messages.POST(req('/api/chat/messages','POST',{id:crypto.randomUUID(),body:'blocked',conversationId:'team'}))).status,403);
assert.equal((await reaction.POST(req('/api/chat/messages/id/reaction','POST',{emoji:'❤️'}),{params:Promise.resolve({id:'id'})})).status,403);
actor('editor',base.filter(p=>p!=='chat.create_group'));
assert.equal((await conversations.POST(req('/api/chat/conversations','POST',{title:'Blocked',memberIds:['other']}))).status,403);
actor('editor',base.filter(p=>p!=='chat.manage_group'));
assert.equal((await conversations.PATCH(req('/api/chat/conversations','PATCH',{id:group,title:'Blocked'}))).status,403);
assert.equal((await settings.PATCH(req('/api/chat/settings','PATCH',{conversationId:group,emoji:'❤️'}))).status,403);
actor('editor',base.filter(p=>p!=='chat.call'));assert.equal((await calls.POST(req('/api/chat/calls','POST',{conversationId:'team'}))).status,403);
actor('editor',base.filter(p=>p!=='chat.attach'));assert.equal((await attachment.POST(req('/api/chat/attachments','POST',{}))).status,403);
actor('editor',base);assert.equal((await pin.PATCH(req('/api/chat/messages/id/pin','PATCH',{pinned:true}),{params:Promise.resolve({id:'id'})})).status,403);
actor('editor',base.filter(p=>p!=='chat.view'));
assert.equal((await messages.GET(req('/api/chat/messages'))).status,403);assert.equal((await conversations.GET(req('/api/chat/conversations'))).status,403);assert.equal((await updates.GET(req('/api/chat/updates'))).status,403);
assert.equal((await preferences.GET()).status,403);
console.log('PASS server-enforced granular chat permissions: read/send/DM/react/group/settings/call/attachment/pin.');
