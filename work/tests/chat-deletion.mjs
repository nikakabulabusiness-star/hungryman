import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

const sql=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
function statement(query,args=[]){return {bind(...next){assert.ok(next.length<=100);return statement(query,next)},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}})}}
let beforeBatch=null;
const DB={prepare:statement,batch:async statements=>{const hook=beforeBatch;beforeBatch=null;hook?.();sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}};
const people=[
 ['dev','Developer'],['hr','HR'],['owner','Owner'],['creative','კრეატიული დირექტორი'],['technical','ტექნიკური დირექტორი'],['technical2','ტექნიკური დირექტორი'],
 ['writer','სცენარისტი'],['producer','პროდიუსერი'],['editor','Video Editor'],['other','Video Editor'],['camera','ოპერატორი'],['social','სოციალური მედია'],
].map(([userId,role])=>({userId,role,email:userId+'@test.example',fullName:userId,hasAvatar:false,profileUpdated:0,lastSeen:0,isOwner:role==='Owner'}));
let current=null;const removedObjects=[];
const modules=new Map();
function load(file){
 if(modules.has(file))return modules.get(file);const exports={};modules.set(file,exports);
 const require=name=>{
  if(name==='@/lib/storage'||name==='./storage')return {storage:()=>({DB,BUCKET:{delete:async keys=>removedObjects.push(...keys),head:async()=>({size:3}),get:async()=>({body:new Uint8Array([1,2,3]),size:3})}})};
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
const media=load('app/api/chat/media/route.ts');
const conversations=load('app/api/chat/conversations/route.ts'),preferences=load('app/api/chat/preferences/route.ts'),messages=load('app/api/chat/messages/route.ts'),settings=load('app/api/chat/settings/route.ts'),reaction=load('app/api/chat/messages/[id]/reaction/route.ts'),pin=load('app/api/chat/messages/[id]/pin/route.ts'),calls=load('app/api/chat/calls/route.ts'),attachment=load('app/api/chat/attachments/route.ts'),updates=load('app/api/chat/updates/route.ts');


// A direct-conversation clear is private to the authenticated participant.
actor('editor');const dm=(await json(await conversations.POST(req('/api/chat/conversations','POST',{userId:'other'})))).id;
const oldId=crypto.randomUUID(),photoId=crypto.randomUUID();
sql.prepare("INSERT INTO chat_attachments(id,conversation_id,user_id,object_key,mime,name,created) VALUES (?,?,?,?,?,?,?)").run(photoId,dm,'other','chat/'+photoId,'image/jpeg','photo',1000);
sql.prepare("INSERT INTO staff_chat_messages(id,author_user_id,author_email,author_name,author_role,body,kind,conversation_id,attachment_id,created,pinned,pinned_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(oldId,'other','other@test.example','other','Video Editor','old https://example.com','image',dm,photoId,1001,1,1002);
assert.equal((await json(await messages.GET(req('/api/chat/messages?conversationId='+dm)))).messages.length,1);
assert.equal((await attachment.GET(req('/api/chat/attachments?id='+photoId))).status,200);
actor('writer');assert.equal((await conversations.DELETE(req('/api/chat/conversations','DELETE',{id:dm}))).status,403);
actor('editor');assert.equal((await json(await conversations.DELETE(req('/api/chat/conversations','DELETE',{id:dm})))).scope,'self');
const cutoff=sql.prepare('SELECT cleared_before FROM chat_hidden_threads WHERE conversation_id=? AND user_id=?').get(dm,'editor').cleared_before;
assert.ok(!(await json(await conversations.GET(req('/api/chat/conversations')))).conversations.some(c=>c.id===dm));
let history=await json(await messages.GET(req('/api/chat/messages?conversationId='+dm)));
assert.deepEqual(history.messages,[]);assert.deepEqual(history.pinned,[]);assert.equal(history.historyStart,cutoff);
assert.deepEqual((await json(await media.GET(req('/api/chat/media?conversationId='+dm+'&kind=images')))).items,[]);
assert.equal((await attachment.GET(req('/api/chat/attachments?id='+photoId))).status,404);
assert.equal((await reaction.POST(req('/api/chat/messages/'+oldId+'/reaction','POST',{emoji:'❤️'}),{params:Promise.resolve({id:oldId})})).status,404);
assert.deepEqual((await json(await updates.GET(req('/api/chat/updates?after=0')))).messages,[]);
assert.equal((await messages.POST(req('/api/chat/messages','POST',{id:crypto.randomUUID(),conversationId:dm,body:'reply',replyTo:oldId}))).status,400);
actor('other');assert.equal((await json(await messages.GET(req('/api/chat/messages?conversationId='+dm)))).messages.length,1);
assert.equal((await attachment.GET(req('/api/chat/attachments?id='+photoId))).status,200);
assert.ok((await json(await conversations.GET(req('/api/chat/conversations')))).conversations.some(c=>c.id===dm));
const freshId=crypto.randomUUID();
sql.prepare("INSERT INTO staff_chat_messages(id,author_user_id,author_email,author_name,author_role,body,kind,conversation_id,created) VALUES (?,?,?,?,?,?,?,?,?)").run(freshId,'other','other@test.example','other','Video Editor','new','message',dm,cutoff+20);
actor('editor');let directory=await json(await conversations.GET(req('/api/chat/conversations'))),restored=directory.conversations.find(c=>c.id===dm);
assert.equal(restored.last.body,'new');assert.equal(restored.unread,1);
assert.deepEqual((await json(await messages.GET(req('/api/chat/messages?conversationId='+dm)))).messages.map(m=>m.id),[freshId]);
assert.deepEqual((await json(await updates.GET(req('/api/chat/updates?after=0')))).messages.map(m=>m.id),[freshId]);
assert.equal((await json(await conversations.POST(req('/api/chat/conversations','POST',{userId:'other'})))).id,dm);
assert.equal(sql.prepare('SELECT cleared_before FROM chat_hidden_threads WHERE conversation_id=? AND user_id=?').get(dm,'editor').cleared_before,cutoff);
console.log('PASS DM delete isolation, no old messages/pins/media/reactions/replies/update-feed access, new-message revival and unchanged peer history.');

// Creator and granted moderators can delete group data for everyone.
async function group(creator='editor'){actor(creator);return (await json(await conversations.POST(req('/api/chat/conversations','POST',{title:'Disposable',memberIds:['other']})),201)).id}
let g=await group();actor('other');assert.equal((await conversations.DELETE(req('/api/chat/conversations','DELETE',{id:g}))).status,403);
actor('hr',policy.defaultPermissions('HR').filter(k=>k!=='chat.delete_group'));assert.equal((await conversations.DELETE(req('/api/chat/conversations','DELETE',{id:g}))).status,403);
const groupPhoto=crypto.randomUUID(),groupMessage=crypto.randomUUID();
sql.prepare("INSERT INTO chat_attachments(id,conversation_id,user_id,object_key,mime,name,created) VALUES (?,?,?,?,?,?,?)").run(groupPhoto,g,'editor','chat/'+groupPhoto,'image/jpeg','photo',1000);
sql.prepare("INSERT INTO staff_chat_messages(id,author_user_id,author_email,author_name,author_role,body,kind,conversation_id,attachment_id,created) VALUES (?,?,?,?,?,?,?,?,?,?)").run(groupMessage,'editor','editor@test.example','editor','Video Editor','group','image',g,groupPhoto,1001);
sql.prepare("INSERT INTO chat_reactions(message_id,user_id,emoji,created) VALUES (?,?,?,?)").run(groupMessage,'other','❤️',1002);
actor('editor');assert.equal((await json(await conversations.GET(req('/api/chat/conversations?id='+g)))).permissions.canDelete,true);
await json(await conversations.DELETE(req('/api/chat/conversations','DELETE',{id:g})));await json(await conversations.DELETE(req('/api/chat/conversations','DELETE',{id:g})));
assert.equal(sql.prepare('SELECT COUNT(*) n FROM staff_chat_messages WHERE conversation_id=?').get(g).n,0);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM chat_group_members WHERE conversation_id=?').get(g).n,0);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM chat_reactions WHERE message_id=?').get(groupMessage).n,0);
assert.ok(removedObjects.includes('chat/'+groupPhoto));
actor('other');assert.equal((await messages.GET(req('/api/chat/messages?conversationId='+g))).status,404);assert.equal((await attachment.GET(req('/api/chat/attachments?id='+groupPhoto))).status,404);
for(const roleId of ['hr','owner','producer','creative','dev']){g=await group();actor(roleId);await json(await conversations.DELETE(req('/api/chat/conversations','DELETE',{id:g})));}
assert.equal((await conversations.DELETE(new Request('https://test.example/api/chat/conversations',{method:'DELETE',headers:{origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({id:'team'})}))).status,403);
console.log('PASS group creator/moderator policy, explicit grant revocation, global cleanup, repeated deletion and CSRF guard.');

// Main chat is protected even from Owner and HR, but Developer can recreate it.
for(const roleId of ['owner','hr','creative','producer']){actor(roleId);assert.equal((await conversations.DELETE(req('/api/chat/conversations','DELETE',{id:'team'}))).status,403);}
actor('dev');await json(await conversations.DELETE(req('/api/chat/conversations','DELETE',{id:'team'})));
directory=await json(await conversations.GET(req('/api/chat/conversations')));assert.equal(directory.canRestoreTeam,true);assert.ok(!directory.conversations.some(c=>c.id==='team'));
assert.equal((await messages.POST(req('/api/chat/messages','POST',{id:crypto.randomUUID(),conversationId:'team',body:'deleted'}))).status,404);
actor('owner');assert.equal((await conversations.POST(req('/api/chat/conversations','POST',{restoreTeam:true}))).status,403);assert.equal((await json(await conversations.GET(req('/api/chat/conversations')))).canRestoreTeam,false);
actor('dev');await json(await conversations.POST(req('/api/chat/conversations','POST',{restoreTeam:true})));await json(await conversations.POST(req('/api/chat/conversations','POST',{restoreTeam:true})));
directory=await json(await conversations.GET(req('/api/chat/conversations')));assert.equal(directory.canRestoreTeam,false);assert.ok(directory.conversations.some(c=>c.id==='team'));
assert.deepEqual((await json(await messages.GET(req('/api/chat/messages?conversationId=team')))).messages,[]);
console.log('PASS main-chat protection, developer-only deletion/recreation and fresh empty history.');

// A delete racing a send cannot resurrect messages/mentions after the access check.
g=await group();const racedId=crypto.randomUUID();beforeBatch=()=>sql.prepare('INSERT INTO chat_deleted_conversations(id,deleted,deleted_by) VALUES (?,?,?)').run(g,Date.now(),'editor');
assert.equal((await messages.POST(req('/api/chat/messages','POST',{id:racedId,conversationId:g,body:'@everyone concurrent send'}))).status,404);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM staff_chat_messages WHERE id=?').get(racedId).n,0);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM chat_mentions WHERE message_id=?').get(racedId).n,0);
console.log('PASS tombstone guard prevents a concurrently deleted group from being resurrected by a send.');
