import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';

// This suite uses an isolated in-memory database and never touches deployed accounts.
const sql=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
function statement(query,args=[]){return {bind(...next){return statement(query,next)},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>{const result=sql.prepare(query).run(...args);return {...result,meta:{changes:Number(result.changes)}}}}}
const DB={prepare:query=>statement(query),batch:async statements=>{sql.exec('BEGIN');try{const results=[];for(const item of statements)results.push(await item.run());sql.exec('COMMIT');return results}catch(error){sql.exec('ROLLBACK');throw error}}};
const objects=new Map(),BUCKET={put:async(key,value)=>objects.set(key,value),delete:async key=>objects.delete(key),get:async key=>objects.get(key)||null};
function load(path){const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};vm.runInNewContext(code,{exports,require:name=>{if(name==='./site-controls')return load('lib/site-controls.ts');if(name==='./department-directory')return load('lib/department-directory.ts');throw Error('Unexpected dependency '+name)},crypto,TextEncoder,Uint8Array,JSON,Date,console});return exports}

const deletion=load('app/api/admin/access/account-deletion.ts'),id='account-to-delete',email='delete-me@example.test',avatar=`staff-avatars/${id}/avatar`;
assert.equal(deletion.ownsAvatarKey(id,avatar),true);
assert.equal(deletion.ownsAvatarKey(id,`staff-avatars/other/avatar`),false);
assert.equal(deletion.ownsAvatarKey(id,`staff-avatars/${id}/../shared`),false);

const now=Date.now();
sql.prepare('INSERT INTO team_members (user_id,email,full_name,phone,role,status,avatar_key,password_hash,password_salt,last_seen,created,updated,approved_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,email,'Private Name','555123456','Video Editor','approved',avatar,'hash','salt',now,now,now,'owner@example.test');
sql.prepare('INSERT INTO admin_users (email,role,status,created,created_by) VALUES (?,?,?,?,?)').run(email,'Video Editor','approved',now,'owner@example.test');
sql.prepare('INSERT INTO employees (id,full_name,birth_date,personal_number,email,phone,position,created,updated) VALUES (?,?,?,?,?,?,?,?,?)').run('employee-delete','Private Name','2000-01-01','private-number',email,'555123456','Video Editor',now,now);
sql.prepare('INSERT INTO staff_sessions (token_hash,user_id,created,expires,last_seen) VALUES (?,?,?,?,?)').run('session',id,now,now+10000,now);
sql.prepare('INSERT INTO staff_chat_messages (id,author_user_id,author_email,author_name,author_role,body,conversation_id,created,pinned,pinned_by) VALUES (?,?,?,?,?,?,?,?,?,?)').run('message',id,email,'Private Name','Video Editor','Shared work','team',now,1,id);
sql.prepare('INSERT INTO chat_attachments (id,conversation_id,user_id,object_key,mime,name,created) VALUES (?,?,?,?,?,?,?)').run('attachment','team',id,'chat/shared','image/png','shared.png',now);
sql.prepare('INSERT INTO shoot_photos (id,user_id,object_key,mime,created) VALUES (?,?,?,?,?)').run('photo',id,'shoot-photos/shared','image/png',now);
sql.prepare('INSERT INTO staff_calendar_events (id,kind,title,start_date,end_date,employee_user_id,employee_email,employee_name,created,created_by,visibility,updated,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run('calendar','leave','Shared calendar history','2026-01-01','2026-01-01',id,email,'Private Name',now,email,'all',now,email);
sql.prepare('INSERT INTO private_calendar_notes (user_id,date,body,updated) VALUES (?,?,?,?)').run(id,'2026-01-01','Private note',now);
sql.prepare('INSERT INTO staff_attendance (user_id,email,work_date,mode,updated,source) VALUES (?,?,?,?,?,?)').run(id,email,'2026-01-01','office',now,'self');
sql.prepare('INSERT INTO workspace_audit (id,actor,action,target,details,created) VALUES (?,?,?,?,?,?)').run('old-audit',email,'test',email,'{}',now);
sql.prepare("UPDATE staff_departments SET head_user_id=?,updated_by=? WHERE id='production'").run(id,email);
function task(taskId,scope,creator,assignee,deleted=null){
 sql.prepare('INSERT INTO work_tasks (id,scope,title,description,creator_id,creator_name,assignee_id,assignee_name,department_id,progress,created,updated,updated_by,mutation_id,deleted) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(taskId,scope,'Retain only shared work','Task details',creator,creator===id?'Private Name':'Other Person',assignee,assignee===id?'Private Name':'Other Person','production',35,now,now,creator,'original-mutation',deleted);
 sql.prepare('INSERT INTO work_task_events (id,task_id,version,actor_id,kind,created) VALUES (?,?,?,?,?,?)').run(taskId+':1',taskId,1,creator,'created',now);
}
task('private-work','private',id,id);
task('deleted-private-work','private',id,id,now);
task('other-private-work','private','other-user','other-user');
task('assigned-by-deleted','assigned',id,'other-user');
task('assigned-to-deleted','assigned','other-user',id);
sql.prepare('INSERT INTO work_task_events (id,task_id,version,actor_id,kind,created) VALUES (?,?,?,?,?,?)').run('assigned-to-deleted:2','assigned-to-deleted',2,id,'updated',now);
sql.prepare("UPDATE work_tasks SET version=2,updated_by=? WHERE id='assigned-to-deleted'").run(id);
objects.set(avatar,new Uint8Array([1]));objects.set('chat/shared',new Uint8Array([2]));objects.set('shoot-photos/shared',new Uint8Array([3]));

const result=await deletion.deleteAccountData(DB,BUCKET,{user_id:id,email,avatar_key:avatar},email);
assert.match(result.anonymousEmail,/^deleted\+[0-9a-f]{16}@invalid\.local$/);
assert.equal(sql.prepare('SELECT user_id FROM team_members WHERE user_id=?').get(id),undefined);
assert.equal(sql.prepare('SELECT email FROM admin_users WHERE email=?').get(email),undefined);
assert.equal(sql.prepare('SELECT id FROM employees WHERE email=?').get(email),undefined);
assert.equal(sql.prepare('SELECT token_hash FROM staff_sessions WHERE user_id=?').get(id),undefined);
assert.equal(sql.prepare('SELECT body FROM private_calendar_notes WHERE user_id=?').get(id),undefined);
assert.equal(sql.prepare('SELECT user_id FROM staff_attendance WHERE user_id=?').get(id),undefined);
assert.equal(sql.prepare("SELECT count(*) n FROM work_tasks WHERE id IN ('private-work','deleted-private-work')").get().n,0,'Erasure removes live and soft-deleted creator-only tasks');
assert.equal(sql.prepare("SELECT count(*) n FROM work_task_events WHERE task_id IN ('private-work','deleted-private-work')").get().n,0,'Erasure removes private task history');
assert.equal(sql.prepare("SELECT creator_id FROM work_tasks WHERE id='other-private-work'").get().creator_id,'other-user','Another creator’s private task is unchanged');
assert.equal(sql.prepare("SELECT actor_id FROM work_task_events WHERE task_id='other-private-work'").get().actor_id,'other-user');
const sharedCreated=sql.prepare("SELECT * FROM work_tasks WHERE id='assigned-by-deleted'").get(),sharedAssigned=sql.prepare("SELECT * FROM work_tasks WHERE id='assigned-to-deleted'").get();
assert.equal(sharedCreated.creator_id,result.anonymousUserId);assert.equal(sharedCreated.creator_name,'წაშლილი ანგარიში');assert.equal(sharedCreated.assignee_id,'other-user');
assert.equal(sharedAssigned.assignee_id,result.anonymousUserId);assert.equal(sharedAssigned.assignee_name,'წაშლილი ანგარიში');assert.equal(sharedAssigned.creator_id,'other-user');
for(const row of [sharedCreated,sharedAssigned]){assert.equal(row.updated_by,result.anonymousUserId);assert.equal(row.department_id,'production');assert.equal(row.description,'Task details');assert.equal(row.progress,35);assert.equal(row.deleted,null);assert.notEqual(row.mutation_id,'original-mutation')}
assert.equal(sharedCreated.version,2);assert.equal(sharedAssigned.version,3,'Erasure invalidates stale task revisions');
assert.equal(sql.prepare('SELECT count(*) n FROM work_task_events WHERE actor_id=?').get(id).n,0,'Shared event authors are anonymized');
assert.equal(sql.prepare("SELECT actor_id FROM work_task_events WHERE id='assigned-to-deleted:2'").get().actor_id,result.anonymousUserId);
assert.equal(sql.prepare("UPDATE work_tasks SET assignee_id=?,assignee_name='Private Name' WHERE id='assigned-to-deleted' AND version=2").run(id).changes,0,'A pre-erasure edit cannot restore the deleted identity');

const message=sql.prepare("SELECT author_user_id,author_email,author_name,body,pinned_by FROM staff_chat_messages WHERE id='message'").get();
assert.equal(message.body,'Shared work');assert.equal(message.author_name,'წაშლილი ანგარიში');assert.equal(message.author_email,result.anonymousEmail);assert.equal(message.pinned_by,result.anonymousUserId);
const calendar=sql.prepare("SELECT employee_user_id,employee_email,employee_name,created_by,updated_by FROM staff_calendar_events WHERE id='calendar'").get();
assert.equal(calendar.employee_name,'წაშლილი ანგარიში');assert.equal(calendar.employee_email,result.anonymousEmail);assert.equal(calendar.created_by,result.anonymousEmail);assert.equal(calendar.updated_by,result.anonymousEmail);
assert.equal(sql.prepare("SELECT head_user_id FROM staff_departments WHERE id='production'").get().head_user_id,null);
const audit=sql.prepare("SELECT actor,target FROM workspace_audit WHERE action='account.deleted'").get();assert.equal(audit.actor,result.anonymousEmail);assert.equal(audit.target,result.anonymousEmail);

assert.equal(objects.has(avatar),false,'Only the owned avatar is removed');
assert.equal(objects.has('chat/shared'),true,'Shared chat attachment must remain');
assert.equal(objects.has('shoot-photos/shared'),true,'Shared shoot photo must remain');
assert.equal(sql.prepare("SELECT object_key FROM chat_attachments WHERE id='attachment'").get().object_key,'chat/shared');
assert.equal(sql.prepare("SELECT object_key FROM shoot_photos WHERE id='photo'").get().object_key,'shoot-photos/shared');

// Exercise the public admin endpoint with the same isolated database. No deployed account is touched.
const permissions=load('lib/permissions.ts');let accessOverride=null;
function loadRoute(){
 const code=ts.transpileModule(fs.readFileSync('app/api/admin/users/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};
 const require=name=>name==='@/lib/admin'?{DEVELOPER_EMAIL:'nikolozkabulashvili0@gmail.com',getAdminAccess:async()=>accessOverride}:name==='@/lib/permissions'?permissions:name==='@/lib/positions'?{getAssignablePositions:async()=>['HR','Video Editor','სცენარისტი']}:name==='@/lib/staff-auth'?{clearSessionCookie:()=> 'hm_staff_session=; Max-Age=0',clearEmbeddedSessionCookie:()=> '__Host-hm_staff_session_embed=; Max-Age=0'}:name==='@/lib/storage'?{storage:()=>({DB,BUCKET})}:name==='@/lib/visitor'?{sameOrigin:()=>true}:name==='../access/account-deletion'?deletion:null;
 vm.runInNewContext(code,{exports,require,crypto,TextEncoder,Uint8Array,JSON,Date,console,Headers,Request,Response});return exports;
}
function account(userId,accountEmail,role,status='approved'){sql.prepare('INSERT INTO team_members (user_id,email,full_name,phone,role,status,password_hash,password_salt,last_seen,created,updated,approved_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(userId,accountEmail,'Test Account','',role,status,'hash','salt',0,now,now,null);if(role)sql.prepare('INSERT INTO admin_users (email,role,status,created,created_by) VALUES (?,?,?,?,?)').run(accountEmail,role,status,now,'seed')}
// D1 batch is transactional: a later failure must not partially erase private task
// history or leave a retained shared task half-anonymized.
account('rollback-user','rollback@example.test','Video Editor');
task('rollback-private','private','rollback-user','rollback-user');
task('rollback-shared','assigned','rollback-user','other-user');
sql.exec("CREATE TRIGGER fail_account_erasure BEFORE UPDATE ON work_tasks WHEN old.id='rollback-shared' BEGIN SELECT RAISE(ABORT,'simulated erasure failure'); END;");
await assert.rejects(deletion.deleteAccountData(DB,BUCKET,{user_id:'rollback-user',email:'rollback@example.test',avatar_key:null},'hr@example.test'),/simulated erasure failure/);
assert.ok(sql.prepare("SELECT user_id FROM team_members WHERE user_id='rollback-user'").get());
assert.equal(sql.prepare("SELECT creator_id FROM work_tasks WHERE id='rollback-private'").get().creator_id,'rollback-user');
assert.equal(sql.prepare("SELECT actor_id FROM work_task_events WHERE task_id='rollback-private'").get().actor_id,'rollback-user');
assert.equal(sql.prepare("SELECT creator_id FROM work_tasks WHERE id='rollback-shared'").get().creator_id,'rollback-user');
sql.exec('DROP TRIGGER fail_account_erasure');
const accountRoute=loadRoute(),allPermissions=[...permissions.permissionKeys];
const removeRequest=(targetEmail,confirmation=targetEmail)=>new Request('https://test.example/api/admin/users',{method:'DELETE',headers:{Origin:'https://test.example','Content-Type':'application/json'},body:JSON.stringify({email:targetEmail,confirmation})});

account('owner-target','owner-target@example.test','Owner');
accessOverride={email:'hr@example.test',role:'HR',isApprovedStaff:true,isOwner:false,isDeveloper:false,permissions:allPermissions};
assert.equal((await accountRoute.DELETE(removeRequest('owner-target@example.test'))).status,403,'HR must not delete an Owner');
assert.ok(sql.prepare("SELECT user_id FROM team_members WHERE user_id='owner-target'").get());

account('developer-target','nikolozkabulashvili0@gmail.com',null,'pending');
accessOverride={email:'owner@example.test',role:'Owner',isApprovedStaff:true,isOwner:true,isDeveloper:false,permissions:allPermissions};
assert.equal((await accountRoute.DELETE(removeRequest('nikolozkabulashvili0@gmail.com'))).status,403,'Owner must not delete Developer');
assert.ok(sql.prepare("SELECT user_id FROM team_members WHERE user_id='developer-target'").get());

accessOverride={email:'nikolozkabulashvili0@gmail.com',role:'Developer',isApprovedStaff:true,isOwner:true,isDeveloper:true,permissions:allPermissions};
assert.equal((await accountRoute.DELETE(removeRequest('nikolozkabulashvili0@gmail.com',''))).status,400,'Server confirmation is required');
const selfDelete=await accountRoute.DELETE(removeRequest('nikolozkabulashvili0@gmail.com'));
assert.equal(selfDelete.status,403,'The singleton developer identity cannot be erased');assert.ok(sql.prepare("SELECT user_id FROM team_members WHERE user_id='developer-target'").get());

account('hr-normal-target','normal@example.test','Video Editor');
accessOverride={email:'hr@example.test',role:'HR',isApprovedStaff:true,isOwner:false,isDeveloper:false,permissions:allPermissions};
assert.equal((await accountRoute.DELETE(removeRequest('normal@example.test'))).status,200,'HR may delete a non-Owner account');
assert.equal(sql.prepare("SELECT user_id FROM team_members WHERE user_id='hr-normal-target'").get(),undefined);

console.log('PASS: account erasure and server hierarchy preserve shared work, remove private identity, and require explicit confirmation.');
