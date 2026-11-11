import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

// Real SQLite schema/queries, isolated accounts and atomic D1-shaped batches.
const sql=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
let beforeBatch=null,dispatches=0;
function statement(query,args=[]){return {bind(...next){return statement(query,next)},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),execute(){const result=sql.prepare(query).run(...args);return {meta:{changes:Number(result.changes)}}},async run(){return this.execute()}}}
const DB={prepare:query=>statement(query),batch:async statements=>{const before=beforeBatch;beforeBatch=null;before?.();sql.exec('BEGIN');try{const results=statements.map(s=>s.execute());sql.exec('COMMIT');return results}catch(error){sql.exec('ROLLBACK');throw error}}};
const people=[
 ['writer','სცენარისტი'],['writer2','სცენარისტი'],['editor','Video Editor'],['editor2','Shorts Video Editor'],['senior','Senior Editor'],['senior2','Senior Editor'],['producer','პროდიუსერი'],['hr','HR'],['founder','Owner'],['developer','Developer'],['technical','ტექნიკური დირექტორი'],['social','Content Creator'],['lead','Video Editor']
].map(([userId,role])=>({userId,role,email:userId+'@example.test',fullName:'Name '+userId,hasAvatar:false,profileUpdated:0,lastSeen:0,isOwner:role==='Owner'||role==='Developer'}));
let active;
const modules=new Map();
function load(file){
 if(modules.has(file))return modules.get(file);
 const exports={};modules.set(file,exports);
 function require(name){
  if(name==='@/lib/storage')return {storage:()=>({DB,BUCKET:{}})};
  if(name==='@/lib/staff-access')return {getStaffAccess:async()=>active,listApprovedStaff:async()=>people};
  if(name==='@/lib/visitor')return {sameOrigin:req=>req.headers.get('Origin')===new URL(req.url).origin};
  if(name==='@/lib/notifications')return {dispatchNotices:()=>{dispatches++},noticeStatements:(ids,event,guard)=>[...new Set(ids.filter(Boolean))].map(userId=>DB.prepare('INSERT OR IGNORE INTO work_notifications (id,user_id,category,title,body,target,target_id,important,created,push_enabled) SELECT ?,?,?,?,?,?,?,?,?,1'+(guard?' WHERE '+guard.query:'')).bind(event.key+':'+userId,userId,event.category,event.title,event.body,event.target,event.targetId||'',event.important?1:0,event.created??Date.now(),...(guard?.values||[])))};
  const base=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);
  return load(fs.existsSync(base+'.ts')?base+'.ts':base+'.tsx');
 }
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports,require,crypto,Date,JSON,Map,Set,Number,URL,Request,Response,Headers,Object,Array,Math,console});return exports;
}
const permissionModule=load('lib/permissions.ts'),policy=load('lib/work-policy.ts'),tasks=load('lib/work-tasks.ts'),contacts=load('lib/work-contacts.ts');
function login(id,overrides={}){const p=people.find(p=>p.userId===id);active={userId:p.userId,email:p.email,fullName:p.fullName,role:p.role,isApproved:true,isDeveloper:p.role==='Developer',isOwner:p.role==='Owner'||p.role==='Developer',permissions:[...permissionModule.permissionKeys],features:{work:true},...overrides}}
async function context(id,overrides){login(id,overrides);return policy.getWorkContext()}
const listURL=(params='')=>new URL('https://test.example/api/work/tasks?'+params);
const rejects=async(promise,status)=>assert.rejects(promise,error=>error instanceof policy.WorkError&&error.status===status);

const writer=await context('writer');
const privateTask=await tasks.createWorkTask(writer,{scope:'private',title:'Only my draft',description:'Private body',checklist:[{id:'one',title:'First step',done:false}]});
assert.equal(privateTask.assigneeId,'writer');assert.equal(privateTask.progress,0);assert.equal(privateTask.permissions.edit,true);
assert.equal((await tasks.createWorkTask(writer,{id:privateTask.id,scope:'private',title:'Only my draft'})).id,privateTask.id,'a retried private create reuses its own record');
assert.equal(sql.prepare('SELECT count(*) n FROM work_notifications').get().n,0);assert.equal(dispatches,0);
for(const id of ['writer2','producer','hr','founder','developer']){
 const c=await context(id);await rejects(tasks.getWorkTask(c,privateTask.id),404);
 assert.equal((await tasks.listWorkTasks(c,listURL())).tasks.some(t=>t.id===privateTask.id),false,id+' cannot list another private task');
 await rejects(tasks.updateWorkTask(c,privateTask.id,{version:1,progress:100}),404);
 await rejects(tasks.deleteWorkTask(c,privateTask.id,{version:1}),404);
}
let completedPrivate=await tasks.updateWorkTask(writer,privateTask.id,{version:1,checklist:[{id:'one',title:'First step',done:true}]});
assert.equal(completedPrivate.progress,100);assert.equal(sql.prepare('SELECT count(*) n FROM work_notifications').get().n,0);assert.equal(dispatches,0);
await rejects(tasks.updateWorkTask(writer,privateTask.id,{version:2,scope:'assigned'}),400);
await rejects(tasks.createWorkTask(writer,{scope:'private',title:'Bad owner',assigneeId:'writer2'}),400);
await rejects(tasks.createWorkTask(writer,{scope:'assigned',title:'Not a manager',assigneeId:'writer2'}),403);
await rejects(tasks.createWorkTask(writer,{scope:'private',title:'Invalid date',dueDate:'2026-02-31'}),400);
await rejects(tasks.updateWorkTask(writer,privateTask.id,{version:2,progress:101}),400);
await rejects(tasks.updateWorkTask(writer,privateTask.id,{version:2,progress:1.5}),400);
await rejects(tasks.createWorkTask(writer,{scope:'private',title:'Injected owner',creatorId:'founder'}),400);

const senior=await context('senior'),seniorPeer=senior.people.find(p=>p.userId==='senior2'),junior=senior.people.find(p=>p.userId==='editor');
assert.equal(policy.canAssignWork(senior,seniorPeer),true);assert.equal(policy.canAssignWork(senior,junior),true);
assert.equal(policy.canAssignWork(senior,senior.people.find(p=>p.userId==='producer')),false);
const producerAtPeerLevel={...senior.people.find(p=>p.userId==='producer'),memberships:seniorPeer.memberships};
assert.equal(policy.canAssignWork(senior,producerAtPeerLevel),false,'A changed position level must not allow a Senior Editor to assign the producer');
assert.equal(policy.canAssignWork(senior,senior.people.find(p=>p.userId==='writer')),false);
assert.equal(senior.canContacts,false,'Senior editing supervisor is not automatically a department head');
const assigned=await tasks.createWorkTask(senior,{scope:'assigned',title:'Cut episode',assigneeId:'editor',priority:'high',dueDate:'2026-10-30',checklist:[{id:'a',title:'Rough cut',done:false},{id:'b',title:'Sound',done:false}]});
assert.equal(assigned.departmentId,'production');assert.equal(assigned.permissions.edit,true);
assert.equal(sql.prepare('SELECT count(*) n FROM work_notifications WHERE target_id=?').get(assigned.id).n,1);
assert.equal(sql.prepare('SELECT user_id FROM work_notifications WHERE target_id=?').get(assigned.id).user_id,'editor');
const editor=await context('editor'),editorView=await tasks.getWorkTask(editor,assigned.id);
assert.equal(editorView.permissions.edit,false);assert.equal(editorView.permissions.progress,true);
await rejects(tasks.updateWorkTask(editor,assigned.id,{version:1,title:'Cannot rename'}),400);
await rejects(tasks.updateWorkTask(editor,assigned.id,{version:1,checklist:[{id:'a',title:'Injected step',done:true}]}),403);
let half=await tasks.updateWorkTask(editor,assigned.id,{version:1,checklist:[{id:'a',title:'Rough cut',done:true},{id:'b',title:'Sound',done:false}]});assert.equal(half.progress,50);
const done=await tasks.updateWorkTask(editor,assigned.id,{version:half.version,progress:100});assert.ok(done.checklist.every(item=>item.done));
const completion=sql.prepare("SELECT user_id,target,body FROM work_notifications WHERE id LIKE 'work-task-completed:%' AND target_id=?").get(assigned.id);assert.equal(completion.user_id,'senior');assert.equal(completion.target,'work_task');assert.match(completion.body,/Cut episode/);
await rejects(tasks.updateWorkTask(editor,assigned.id,{version:half.version,progress:100}),409);
const again=await tasks.updateWorkTask(editor,assigned.id,{version:done.version,progress:100});
assert.equal(sql.prepare("SELECT count(*) n FROM work_notifications WHERE id LIKE 'work-task-completed:%' AND target_id=?").get(assigned.id).n,1,'completion is not repeated for another100%save');
const reopened=await tasks.updateWorkTask(editor,assigned.id,{version:again.version,progress:20});
await tasks.updateWorkTask(editor,assigned.id,{version:reopened.version,progress:100});
assert.equal(sql.prepare("SELECT count(*) n FROM work_notifications WHERE id LIKE 'work-task-completed:%' AND target_id=?").get(assigned.id).n,2,'a real new completion gets one new event');
await rejects(tasks.getWorkTask(await context('writer2'),assigned.id),404);
assert.equal((await tasks.getWorkTask(await context('producer'),assigned.id)).permissions.edit,true);
assert.equal((await tasks.getWorkTask(await context('hr'),assigned.id)).permissions.edit,true);
await rejects(tasks.deleteWorkTask(editor,assigned.id,{version:6}),403);

// Fresh hierarchy changes take effect without changing role names or cached sessions.
const oldSeniorMembership=sql.prepare("SELECT memberships_json FROM staff_positions WHERE name='Senior Editor'").get().memberships_json;
sql.prepare("UPDATE staff_positions SET memberships_json='[]' WHERE name='Senior Editor'").run();
const revokedSenior=await context('senior');assert.equal(policy.canAssignWork(revokedSenior,revokedSenior.people.find(p=>p.userId==='editor')),false,'membership removal revokes peer assignment');
sql.prepare("UPDATE staff_positions SET memberships_json=? WHERE name='Senior Editor'").run(oldSeniorMembership);
sql.prepare("UPDATE staff_departments SET director_user_id='lead' WHERE id='production'").run();
const configuredHead=await context('lead');assert.equal(configuredHead.canContacts,true);assert.equal(policy.canAssignWork(configuredHead,configuredHead.people.find(p=>p.userId==='editor')),true);assert.equal(policy.canAssignWork(configuredHead,configuredHead.people.find(p=>p.userId==='writer')),false);
sql.prepare("UPDATE staff_departments SET director_user_id=NULL WHERE id='production'").run();
assert.equal((await context('lead')).canContacts,false);

// A concurrent winner between read and batch must not emit a loser's notification/event.
const competing=await tasks.createWorkTask(await context('senior'),{scope:'assigned',title:'Concurrency',assigneeId:'editor'});
beforeBatch=()=>sql.prepare("UPDATE work_tasks SET progress=30,version=2,mutation_id='other-winner' WHERE id=?").run(competing.id);
await rejects(tasks.updateWorkTask(editor,competing.id,{version:1,progress:100}),409);
assert.equal(sql.prepare('SELECT progress FROM work_tasks WHERE id=?').get(competing.id).progress,30);
assert.equal(sql.prepare("SELECT count(*) n FROM work_notifications WHERE target_id=? AND id LIKE 'work-task-completed:%'").get(competing.id).n,0);
assert.equal(sql.prepare('SELECT count(*) n FROM work_task_events WHERE task_id=? AND version=2').get(competing.id).n,0);

const orphan=await tasks.createWorkTask(await context('senior'),{scope:'assigned',title:'Former employee work',assigneeId:'editor2'});
const removedPerson=people.splice(people.findIndex(person=>person.userId==='editor2'),1)[0];
const recovery=await context('hr');assert.ok((await tasks.listWorkTasks(recovery,listURL())).tasks.some(task=>task.id===orphan.id),'management can recover assigned work after assignee deactivation');
const reassigned=await tasks.updateWorkTask(recovery,orphan.id,{version:1,assigneeId:'editor'});assert.equal(reassigned.assigneeId,'editor');assert.equal(reassigned.progress,0);people.push(removedPerson);

// Ownership-safe pagination/search is done in SQL, before page limits.
await tasks.createWorkTask(writer,{scope:'private',title:'Literal 100%_ task'});
await tasks.createWorkTask(writer,{scope:'private',title:'Normal task'});
const searched=await tasks.listWorkTasks(writer,listURL('scope=private&q='+encodeURIComponent('100%_')));assert.equal(searched.tasks.length,1);assert.equal(searched.tasks[0].title,'Literal 100%_ task');
const first=await tasks.listWorkTasks(writer,listURL('scope=private&limit=1'));assert.ok(first.nextCursor);
const second=await tasks.listWorkTasks(writer,listURL('scope=private&limit=1&cursor='+encodeURIComponent(first.nextCursor)));assert.notEqual(second.tasks[0].id,first.tasks[0].id);
await tasks.deleteWorkTask(writer,privateTask.id,{version:completedPrivate.version});await rejects(tasks.getWorkTask(writer,privateTask.id),404);

const hr=await context('hr'),contactBody={company:'Studio One',category:'ტექნიკის ქირაობა',firstName:'Nino',lastName:'Test',position:'Manager',phone:'+995 555 123 456',email:'nino@example.test',notes:'Business hours 10:00–18:00'};
const contact=await contacts.createWorkContact(hr,contactBody);assert.equal(contact.version,1);assert.equal(contact.createdBy,'Name hr');assert.equal(contact.updated,contact.created);
for(const id of ['writer','editor','senior']){const c=await context(id);await rejects(contacts.listWorkContacts(c,new URL('https://test.example/api/work/contacts')),403);await rejects(contacts.getWorkContact(c,contact.id),403);await rejects(contacts.createWorkContact(c,contactBody),403)}
const changed=await contacts.updateWorkContact(await context('producer'),contact.id,{version:1,phone:'+995 555 999 888'});assert.equal(changed.version,2);assert.equal(changed.created,contact.created);assert.equal(changed.updatedBy,'Name producer');assert.equal(changed.firstName,'Nino');
await rejects(contacts.updateWorkContact(hr,contact.id,{version:1,phone:'111'}),409);
await rejects(contacts.updateWorkContact(hr,contact.id,{version:2,created:1}),400);
const contactsFound=await contacts.listWorkContacts(hr,new URL('https://test.example/api/work/contacts?q=999'));assert.equal(contactsFound.contacts[0].id,contact.id);
const auditCount=sql.prepare("SELECT count(*) n FROM workspace_audit WHERE action LIKE 'work.contact.%'").get().n;assert.equal(auditCount,2);
beforeBatch=()=>sql.prepare("UPDATE work_contacts SET phone='new-winner',version=3,mutation_id='winner' WHERE id=?").run(contact.id);
await rejects(contacts.updateWorkContact(hr,contact.id,{version:2,phone:'999'}),409);assert.equal(sql.prepare("SELECT count(*) n FROM workspace_audit WHERE action LIKE 'work.contact.%'").get().n,auditCount);
await contacts.deleteWorkContact(hr,contact.id,{version:3});await rejects(contacts.getWorkContact(hr,contact.id),404);

// Actual route boundary: auth, origin, hidden identifiers, version and body limits.
const taskRoute=load('app/api/work/tasks/route.ts'),detailRoute=load('app/api/work/tasks/[id]/route.ts'),contactRoute=load('app/api/work/contacts/route.ts');
const req=(method,body,origin='https://test.example')=>new Request('https://test.example/api/work/tasks',{method,headers:{Origin:origin,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
login('writer',{isApproved:false});assert.equal((await taskRoute.GET(req('GET'))).status,403);
login('writer',{permissions:[]});assert.equal((await taskRoute.GET(req('GET'))).status,403);
login('writer',{features:{work:false}});assert.equal((await taskRoute.GET(req('GET'))).status,403,'disabled Work module denies private and shared endpoints');
login('writer');assert.equal((await taskRoute.POST(req('POST',{scope:'private',title:'Origin attack'},'https://evil.example'))).status,403);
assert.equal((await taskRoute.POST(req('POST',{scope:'private',title:'Large',description:'x'.repeat(41000)}))).status,413);
assert.equal((await contactRoute.GET(new Request('https://test.example/api/work/contacts'))).status,403);
const good=await taskRoute.POST(req('POST',{scope:'private',title:'Route private'}));assert.equal(good.status,201);assert.equal(good.headers.get('Cache-Control'),'private, no-store');const routeTask=(await good.json()).task;
login('founder');const hidden=await detailRoute.GET(new Request('https://test.example'),{params:Promise.resolve({id:routeTask.id})});assert.equal(hidden.status,404);assert.equal((await hidden.json()).task,undefined);
login('writer');assert.equal((await detailRoute.PATCH(req('PATCH',{progress:100}),{params:Promise.resolve({id:routeTask.id})})).status,400);
console.log('PASS real SQL private isolation, role/head assignment, checklist/progress, idempotent completion, concurrent writers, contacts permissions/history, cursor search, auth/origin/version/body boundaries.');
