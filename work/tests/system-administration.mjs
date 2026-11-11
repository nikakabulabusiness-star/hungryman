import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const sql=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8').replaceAll('--> statement-breakpoint',''));
function stmt(query,args=[]){return {bind(...v){return stmt(query,v)},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}})}}
const DB={prepare:stmt,batch:async ss=>{sql.exec('BEGIN');try{const r=[];for(const s of ss)r.push(await s.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
const developer='nikolozkabulashvili0@gmail.com';let actor=null;
const cache=new Map();function load(file){if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const require=name=>{if(name==='@/lib/admin')return {getAdminAccess:async()=>actor,DEVELOPER_EMAIL:developer};if(name==='@/lib/staff-auth')return {OWNER_EMAIL:developer,getSessionUser:async()=>null,clearSessionCookie:()=>'',clearEmbeddedSessionCookie:()=>''};if(name==='@/lib/visitor')return {sameOrigin:r=>r.headers.get('origin')==='https://work.test'};if(name==='@/lib/storage'||name==='./storage')return {storage:()=>({DB,BUCKET:{delete:async()=>{}}})};if(name==='next/headers')return {headers:async()=>new Headers(),cookies:async()=>({get:()=>undefined})};const p=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);return load(p.endsWith('.ts')?p:p+'.ts')};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,URL,Request,Response,Headers,crypto,Date,JSON,console,TextEncoder,Uint8Array});return exports}
const controls=load('lib/site-controls.ts');
const permissions=load('lib/permissions.ts'),admin=load('lib/admin.ts'),grant=load('app/api/developer/administrators/route.ts'),accounts=load('app/api/developer/accounts/route.ts'),users=load('app/api/admin/users/route.ts');
function seed(email,role='Video Editor',status='approved'){sql.prepare('INSERT INTO team_members(user_id,email,full_name,phone,role,status,password_hash,password_salt,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)').run(email,email,'Test account','555',role,status,'NEVER_RETURN_HASH','NEVER_RETURN_SALT',Date.now(),Date.now());sql.prepare('INSERT INTO admin_users(email,role,status,created,created_by) VALUES(?,?,?,?,?)').run(email,role,status,Date.now(),developer)}
seed(developer,'Developer');seed('founder@test.local','Owner');seed('editor@test.local');seed('pending@test.local','Video Editor','pending');
const req=(body,origin='https://work.test')=>new Request('https://work.test/api/developer/administrators',{method:'PATCH',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
for(const candidate of [null,admin.rolePermissions('hr@test.local','HR',true),admin.rolePermissions('founder@test.local','Owner',true),admin.rolePermissions('editor@test.local','Video Editor',true,false,false,[],true)]){actor=candidate;assert.equal((await grant.PATCH(req({email:'editor@test.local',administrator:true,permissions:controls.systemPermissionKeys}))).status,403);assert.equal((await accounts.GET(new Request('https://work.test/api/developer/accounts'))).status,403);assert.equal((await accounts.GET(new Request('https://work.test/api/developer/accounts?id=editor@test.local'))).status,403)}
actor=admin.rolePermissions(developer,'Developer',true);
assert.equal((await grant.PATCH(req({email:developer,administrator:true}))).status,403);
assert.equal((await grant.PATCH(req({email:'editor@test.local',administrator:true,role:'Developer'}))).status,400);
assert.equal((await grant.PATCH(req({email:'editor@test.local',administrator:true,permissions:controls.systemPermissionKeys},'https://evil.test'))).status,403);
assert.equal((await grant.PATCH(req({email:'pending@test.local',administrator:true}))).status,409);
assert.equal((await grant.PATCH(req({email:'editor@test.local',administrator:true,permissions:controls.systemPermissionKeys}))).status,200);
assert.equal(sql.prepare('SELECT role FROM admin_users WHERE email=?').get('editor@test.local').role,'Video Editor');
let access=await admin.getAdminAccess({email:'editor@test.local'});assert.equal(access.isSiteAdmin,true);assert.equal(access.role,'Video Editor');assert.equal(access.systemRole,'Administrator');for(const key of controls.systemGrants(controls.systemPermissionKeys))assert.equal(permissions.hasPermission(access,key),true,key);
assert.equal(permissions.canManageRole(access,'Owner'),false);assert.equal(permissions.canManageRole(access,'Developer'),false);assert.equal(permissions.canDeleteAccount(access,'Owner','founder@test.local'),false);assert.equal(permissions.canDeleteAccount(access,'Developer',developer),false);
const listing=await accounts.GET(new Request('https://work.test/api/developer/accounts?filter=administrators'));assert.equal((await listing.json()).total,2);
const detail=await accounts.GET(new Request('https://work.test/api/developer/accounts?id=editor@test.local'));assert.equal(detail.status,200);const raw=await detail.text();assert.ok(!raw.includes('NEVER_RETURN'));assert.ok(!raw.includes('password_hash'));assert.ok(!raw.includes('password_salt'));
actor=access;for(const email of [developer,'founder@test.local']){assert.equal((await users.DELETE(new Request('https://work.test/api/admin/users',{method:'DELETE',headers:{origin:'https://work.test','Content-Type':'application/json'},body:JSON.stringify({email,confirmation:email})}))).status,403)}
assert.equal((await users.PATCH(req({email:'founder@test.local',role:'Video Editor',status:'approved'}))).status,403);
actor=admin.rolePermissions(developer,'Developer',true);assert.equal((await grant.PATCH(req({email:'editor@test.local',administrator:false}))).status,200);access=await admin.getAdminAccess({email:'editor@test.local'});assert.equal(access.isSiteAdmin,false);assert.equal(access.role,'Video Editor');assert.equal(permissions.hasPermission(access,'accounts.delete'),false);
// Even an administrator loses access when the account is suspended.
await grant.PATCH(req({email:'editor@test.local',administrator:true,permissions:controls.systemPermissionKeys}));sql.prepare("UPDATE admin_users SET status='suspended' WHERE email=?").run('editor@test.local');access=await admin.getAdminAccess({email:'editor@test.local'});assert.equal(access.isSiteAdmin,false);assert.equal(permissions.hasPermission(access,'admin.view'),false);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM team_members').get().n,4);
console.log('PASS developer-only list/details/grants; CSRF; singleton; no credential leakage; independent job; immediate revoke/suspend; founder/developer deletion and demotion blocked.');

const features=load('app/api/admin/features/route.ts'),status=load('app/api/admin/account-status/route.ts');
actor=admin.rolePermissions(developer,'Developer',true);
sql.prepare("UPDATE admin_users SET status='approved' WHERE email=?").run('editor@test.local');
await grant.PATCH(req({email:'editor@test.local',administrator:true,permissions:['features.calls','accounts.manage']}));
access=await admin.getAdminAccess({email:'editor@test.local'});actor=access;
assert.equal(controls.canControl(access,'features.calls'),true);
assert.equal(controls.canControl(access,'features.registration'),false);
assert.equal((await features.PATCH(req({key:'registration',enabled:false}))).status,403);
assert.equal((await features.PATCH(req({key:'calls',enabled:false},'https://evil.test'))).status,403);
assert.equal((await features.PATCH(req({key:'calls',enabled:false}))).status,200);
access=await admin.getAdminAccess({email:developer});assert.equal(permissions.hasPermission(access,'chat.call'),false);
actor=admin.rolePermissions('founder@test.local','Owner',true);assert.equal((await features.GET()).status,403);
actor=await admin.getAdminAccess({email:'editor@test.local'});
assert.equal((await status.PATCH(req({email:developer,status:'suspended'}))).status,403);
assert.equal((await status.PATCH(req({email:'founder@test.local',status:'suspended'}))).status,403);
actor=admin.rolePermissions(developer,'Developer',true);
assert.equal((await status.PATCH(req({email:'editor@test.local',status:'suspended'}))).status,200);
assert.equal((await admin.getAdminAccess({email:'editor@test.local'})).isApprovedStaff,false);
assert.equal((await status.PATCH(req({email:'editor@test.local',status:'approved'}))).status,200);
assert.equal((await admin.getAdminAccess({email:'editor@test.local'})).isApprovedStaff,true);
assert.equal(controls.threadEnabled('team',{teamChat:false}),false);
assert.equal(controls.threadEnabled('dm_123',{privateChats:false}),false);
assert.equal(controls.publicRole('Developer'),'თანამშრომელი');
console.log('PASS granular delegation, non-delegated denial, CSRF, global call disable for developer, founder isolation, protected status, deactivate/reactivate, hidden public role.');

// Removing functionality changes configuration, not employee data or role grants.
const functions=load('app/api/developer/functions/route.ts');
for(const other of [null,admin.rolePermissions('founder@test.local','Owner',true),await admin.getAdminAccess({email:'editor@test.local'})]){actor=other;assert.equal((await functions.GET()).status,403);assert.equal((await functions.PATCH(req({kind:'feature',key:'calls',removed:true}))).status,403)}
actor=await admin.getAdminAccess({email:developer});
assert.equal((await functions.PATCH(req({kind:'feature',key:'calls',removed:true},'https://evil.test'))).status,403);
for(const key of ['workspace.view','admin.view'])assert.equal((await functions.PATCH(req({kind:'permission',key,removed:true}))).status,403);
assert.equal((await functions.PATCH(req({kind:'permission',key:'nonexistent',removed:true}))).status,400);
const beforePeople=JSON.stringify(sql.prepare('SELECT * FROM team_members ORDER BY user_id').all());
assert.equal((await functions.PATCH(req({kind:'feature',key:'groups',removed:true}))).status,200);
assert.equal((await functions.PATCH(req({kind:'permission',key:'chat.view',removed:true}))).status,200);
let afterRemoval=await admin.getAdminAccess({email:developer});
for(const key of ['chat.view','chat.send','chat.call','chat.manage_group'])assert.equal(permissions.hasPermission(afterRemoval,key),false,key);
assert.equal(permissions.hasPermission(afterRemoval,'calendar.view'),true);
assert.equal(permissions.hasPermission(afterRemoval,'admin.view'),true);
assert.equal((await features.PATCH(req({key:'groups',enabled:true}))).status,409,'ordinary toggles cannot restore a removed function');
assert.equal((await functions.PATCH(req({kind:'permission',key:'chat.view',removed:false}))).status,200);
afterRemoval=await admin.getAdminAccess({email:developer});assert.equal(permissions.hasPermission(afterRemoval,'chat.send'),true);assert.equal(permissions.hasPermission(afterRemoval,'chat.call'),false,'restore must retain separately disabled calls');assert.equal(afterRemoval.features.groups,false);
assert.equal((await functions.PATCH(req({kind:'feature',key:'groups',removed:false}))).status,200);
assert.equal((await functions.PATCH(req({kind:'permission',key:'calendar.view',removed:true}))).status,200);
afterRemoval=await admin.getAdminAccess({email:developer});assert.equal(permissions.hasPermission(afterRemoval,'calendar.manage'),false);assert.equal(permissions.hasPermission(afterRemoval,'shoots.view'),true);
assert.equal((await functions.PATCH(req({kind:'permission',key:'calendar.view',removed:false}))).status,200);
assert.equal(JSON.stringify(sql.prepare('SELECT * FROM team_members ORDER BY user_id').all()),beforePeople);
const controlState=await (await functions.GET()).json();assert.equal(controlState.history.length,6);assert.equal(controlState.removedFeatures.length,0);assert.equal(controlState.removedPermissions.length,0);assert.ok(controlState.revision>0);
console.log('PASS developer-only one-click removal/restoration, core recovery protection, dependent permissions even for developer, independent settings retained, data preserved and persistent history.');
