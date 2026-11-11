import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const sql=new DatabaseSync(':memory:');
for(const name of fs.readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+name,'utf8').replaceAll('--> statement-breakpoint',''));
function statement(query,args=[]){return {bind(...next){return statement(query,next)},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}})}}
const DB={prepare:statement,batch:async statements=>Promise.all(statements.map(statement=>statement.run()))};
let requestHeaders=new Headers();const jar=new Map();
const modules=new Map();
function load(file){
 if(modules.has(file))return modules.get(file);
 const exports={};modules.set(file,exports);
 function require(name){
  if(name==='next/headers')return {headers:async()=>requestHeaders,cookies:async()=>({get:key=>jar.has(key)?{value:jar.get(key)}:undefined})};
  if(name==='next/navigation')return {redirect:()=>{throw Error('unexpected redirect')}};
  if(name==='@/lib/storage'||name==='./storage')return {storage:()=>({DB,BUCKET:{}})};
  if(name.startsWith('@/')||name.startsWith('.')){const base=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);return load(base.endsWith('.ts')?base:base+'.ts')}
  throw Error('Unknown module '+name);
 }
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require,crypto,TextEncoder,TextDecoder,Uint8Array,Headers,URL,Date,Intl,console});return exports;
}
const permissions=load('lib/permissions.ts'),admin=load('lib/admin.ts'),positions=load('lib/positions.ts'),departments=load('lib/departments.ts');
function actor(role,email=role.toLowerCase()+'@test.example'){return admin.rolePermissions(email,role,true)}
const dev=actor('Developer',admin.DEVELOPER_EMAIL),owner=actor('Owner'),hr=actor('HR'),creative=actor('კრეატიული დირექტორი'),editor=actor('Video Editor');
assert.equal(dev.isDeveloper,true);for(const key of permissions.permissionKeys)assert.equal(permissions.hasPermission(dev,key),true,key);
assert.equal(actor('Developer').isApprovedStaff,false,'A role string must not impersonate Developer');
for(const role of ['HR','Owner','კრეატიული დირექტორი','პროდიუსერი','რეჟისორი'])assert.equal(actor(role).canCreateShoots,true,role);
for(const role of ['Senior Editor','Video Editor','სცენარისტი','ორგანიზატორი','ადმინისტრატორი','Content Creator','ტექნიკური დირექტორი'])assert.equal(actor(role).canCreateShoots,false,role);
assert.equal(admin.rolePermissions('editor@test.example','Video Editor',true,true,true).canCreateShoots,false,'Legacy individual shoot grants must not bypass role');
assert.equal(permissions.canManageRole(dev,'HR'),true);assert.equal(permissions.canManageRole(dev,'Owner'),true);assert.equal(permissions.canManageRole(dev,'Developer'),false);
assert.equal(permissions.canManageRole(owner,'HR'),true);assert.equal(permissions.canManageRole(hr,'Owner'),false);assert.equal(permissions.canManageRole(hr,'HR'),false);
for(const role of ['სცენარისტი','პროდიუსერის ასისტენტი','ორგანიზატორი','ოპერატორი'])assert.equal(permissions.canManageRole(creative,role),true);
for(const role of ['HR','Owner','Video Editor','კრეატიული დირექტორი','პროდიუსერი','რეჟისორი'])assert.equal(permissions.canManageRole(creative,role),false);
assert.equal(permissions.validatePermissionGrant(creative,'სცენარისტი',['workspace.view','chat.view','chat.send']),null);
assert.match(permissions.validatePermissionGrant(creative,'სცენარისტი',['workspace.view','admin.view','accounts.view']),/მხოლოდ/,'Creative director cannot delegate a privilege they lack');
assert.match(permissions.validatePermissionGrant(dev,'Video Editor',['chat.send']),/გვერდის/,'Actions require view permission');
assert.equal(permissions.hasPermission({permissions:['chat.send']},'chat.send'),false);
assert.equal(permissions.hasPermission({permissions:['positions.view','positions.manage']},'positions.manage'),false,'Admin view required');
for(const target of ['HR','Owner'])assert.equal(permissions.canDeleteAccount(dev,target),true);assert.equal(permissions.canDeleteAccount(dev,'Developer'),false,'Developer account is protected even from self-deletion');
assert.equal(permissions.canDeleteAccount(hr,'Owner'),false);assert.equal(permissions.canDeleteAccount(hr,'Developer'),false);assert.equal(permissions.canDeleteAccount(owner,'Developer'),false);assert.equal(permissions.canDeleteAccount(owner,'Owner'),false);assert.equal(permissions.canDeleteAccount(hr,'Video Editor'),true);assert.equal(permissions.canDeleteAccount(owner,'Video Editor',admin.DEVELOPER_EMAIL),false);
const user={userId:'editor-id',email:'staff@test.example',fullName:'Test Editor',phone:'',role:'Video Editor',status:'approved'};
sql.prepare("INSERT INTO admin_users (email,role,status,created,created_by) VALUES (?,?,'approved',1,'test')").run(user.email,user.role);
assert.equal((await admin.getAdminAccess(user)).canCreateShoots,false);
const grant=[...permissions.defaultPermissions('Video Editor'),'shoots.create'];
sql.prepare('UPDATE staff_positions SET permissions_json=? WHERE name=?').run(JSON.stringify(grant),'Video Editor');
assert.equal((await admin.getAdminAccess(user)).canCreateShoots,true,'Current role configuration is read on next request');
sql.prepare("UPDATE staff_positions SET is_active=0 WHERE name='Video Editor'").run();
let access=await admin.getAdminAccess(user);assert.equal(access.isApprovedStaff,false);assert.equal(access.status,'suspended');assert.equal(access.permissions.length,0);
sql.prepare("UPDATE staff_positions SET is_active=1,is_deleted=1 WHERE name='Video Editor'").run();
access=await admin.getAdminAccess(user);assert.equal(access.isApprovedStaff,false);assert.equal((await positions.getPositions()).some(position=>position.name==='Video Editor'),false);assert.equal((await positions.getPosition('Video Editor')).deleted,true);
sql.prepare("UPDATE staff_positions SET is_deleted=0,permissions_json='not-json' WHERE name='Video Editor'").run();
access=await admin.getAdminAccess(user);assert.equal(access.canCreateShoots,false);assert.equal(access.permissions.length,0,'Malformed permission data fails closed');
const devIdentity={...user,email:admin.DEVELOPER_EMAIL};requestHeaders=new Headers({authorization:'Bearer test','X-HMW-Preview-Role':encodeURIComponent('Video Editor')});
access=await admin.getAdminAccess(devIdentity);assert.equal(access.isDeveloper,false);assert.equal(access.permissions.length,0);assert.equal(access.previewRole,'Video Editor');
sql.prepare("UPDATE staff_positions SET is_active=0 WHERE name='Video Editor'").run();
access=await admin.getAdminAccess(devIdentity);assert.equal(access.isApprovedStaff,false,'Preview obeys role deactivation');
requestHeaders=new Headers({authorization:'Bearer test'});access=await admin.getAdminAccess(devIdentity);assert.equal(access.isDeveloper,true,'Developer can return from inactive preview');
requestHeaders=new Headers();
jar.set('hm_staff_session','first-session');
assert.equal((await admin.getAdminAccess(devIdentity)).role,'Senior Editor');
jar.set(admin.PREVIEW_COOKIE,await admin.developerSessionTag());
assert.equal((await admin.getAdminAccess(devIdentity)).isDeveloper,true);
assert.equal((await admin.getAdminAccess(user)).isDeveloper,false);
jar.set('hm_staff_session','next-login');
assert.equal((await admin.getAdminAccess(devIdentity)).isDeveloper,false);
assert.equal((await positions.getPositions()).some(position=>position.name==='Developer'),false);
assert.ok((await departments.getDepartments()).find(department=>department.id==='production'));
assert.equal(sql.prepare('SELECT COUNT(*) n FROM staff_departments WHERE head_user_id IS NOT NULL OR director_user_id IS NOT NULL').get().n,0,'Planned leadership never silently binds identities');
assert.equal(departments.reportsToForRole('Senior Editor'),'პროდიუსერი');assert.equal(departments.reportsToForRole('Video Editor'),'Senior Editor');assert.equal(departments.reportsToForRole('ოპერატორი'),'პროდიუსერის ასისტენტი');
console.log('PASS role permissions: defaults, hierarchy, delegation ceiling, dependency enforcement, deletion hierarchy, live role changes, deactivation, tombstones, fail-closed data, Developer preview and planned leadership.');
