import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
function load(file,deps){const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in deps,'unhandled dependency '+name);return deps[name]},Response,URL,Date,crypto,console,setTimeout});return exports}
const sql=new DatabaseSync(':memory:');
sql.exec('CREATE TABLE chat_deleted_conversations(id TEXT);CREATE TABLE chat_threads(id TEXT,user_a TEXT,user_b TEXT);CREATE TABLE chat_group_members(conversation_id TEXT,user_id TEXT);');
sql.exec("INSERT INTO chat_threads VALUES('private','alice','bob');INSERT INTO chat_group_members VALUES('group','alice');");
let reads=0;
const DB={prepare:q=>({bind(...args){return {first:async()=>{reads++;return sql.prepare(q).get(...args)||null}}}})};
const chat=load('lib/chat.ts',{'./site-controls':{publicRole:role=>role,threadEnabled:()=>true},'./chat-lifecycle':{},'./staff-access':{},'./storage':{storage:()=>({DB})},'./permissions':{hasPermission:a=>a.permissions.includes('chat.view')}});
const approved={userId:'alice',isApproved:true,permissions:['chat.view']};
for(const [thread,allowed] of [['team',true],['private',true],['group',true],['missing',false]]){reads=0;assert.equal(await chat.threadAllowed(thread,approved),allowed);assert.equal(reads,1,'membership/tombstone must use one statement')}
assert.equal(await chat.threadAllowed('private',{...approved,userId:'outsider'}),false);
sql.exec("INSERT INTO chat_deleted_conversations VALUES('private');INSERT INTO chat_deleted_conversations VALUES('team')");
assert.equal(await chat.threadAllowed('private',approved),false);assert.equal(await chat.threadAllowed('team',approved),false);
reads=0;assert.equal(await chat.threadAllowed('group',{...approved,isApproved:false}),false);assert.equal(reads,0);
// Independent profile reads must start while fresh authorization is still pending.
let resolvePermissions,profileReads=0,permissionReads=0;
const accessModule=load('lib/staff-access.ts',{'./site-controls':{parseSystemPermissions:()=>[]},'@/app/chatgpt-auth':{},'@/lib/admin':{getAdminAccess:()=>{permissionReads++;return new Promise(r=>resolvePermissions=r)},OWNER_EMAIL:'owner'},'@/lib/staff-auth':{},'@/lib/storage':{storage:()=>({DB:{prepare:q=>({bind:()=>({first:async()=>{profileReads++;return q.includes('team_members')?{full_name:'Alice',last_seen:1}:null}})})}})},'next/navigation':{}});
const work=accessModule.getStaffAccess({userId:'alice',email:'alice@example.test',fullName:'Alice'});
await Promise.resolve();assert.equal(profileReads,2);assert.equal(permissionReads,1);
resolvePermissions({role:'Editor',status:'approved',isApprovedStaff:true,permissions:['chat.view']});assert.equal((await work).isApproved,true);
const second=accessModule.getStaffAccess({userId:'alice',email:'alice@example.test',fullName:'Alice'});resolvePermissions({role:'Editor',status:'suspended',isApprovedStaff:false,permissions:[]});assert.equal((await second).isApproved,false,'fresh revocation must win; no permission cache');assert.equal(permissionReads,2);
// Ordinary send must not hydrate the staff directory; mention sends still must.
let peopleReads=0,inserted=false;
const sendDB={prepare:q=>({bind:()=>({first:async()=>q.includes('COUNT(*)')?{count:0}:inserted?{id:'m',body:'sent',created:1}:null})}),batch:async()=>{inserted=true}};
const messages=load('app/api/chat/messages/route.ts',{'@/lib/chat-lifecycle':{historyStart:async()=>0},'@/lib/permissions':{hasPermission:()=>true},'@/lib/chat-directory':{conversationPeople:async()=>{peopleReads++;return []},mentionedUsers:()=>[]},'@/lib/push':{queuePush:()=>({}),dispatchPush:()=>{}},'@/lib/staff-access':{getStaffAccess:async()=>({...approved,email:'alice@example.test'})},'@/lib/storage':{storage:()=>({DB:sendDB})},'@/lib/visitor':{sameOrigin:()=>true},'@/lib/chat':{CHAT_COLUMNS:'id,body,created',threadAllowed:async()=>true,publicMessage:x=>x,bumpChat:()=>({})}});
for(const [body,expected] of [['hello',0],['@everyone hello',1],['hello (@Alice)',2]]){inserted=false;const response=await messages.POST({headers:new Headers(),json:async()=>({id:crypto.randomUUID(),body})});assert.equal(response.status,201);assert.equal(peopleReads,expected)}
console.log('PASS: one-query private authorization, fresh revocation with parallel profile reads, no staff-directory reads for ordinary sends.');
