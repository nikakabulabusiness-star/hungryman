import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const sql=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(`drizzle/${file}`,'utf8').replaceAll('--> statement-breakpoint',''));
function statement(query,args=[]){return {bind(...values){return statement(query,values)},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>{const result=sql.prepare(query).run(...args);return {meta:{changes:Number(result.changes)}}}}}
const DB={prepare:query=>statement(query),batch:async statements=>{sql.exec('BEGIN');try{const result=[];for(const item of statements)result.push(await item.run());sql.exec('COMMIT');return result}catch(error){sql.exec('ROLLBACK');throw error}}};
let actor=null;
const people=[{userId:'owner-id',fullName:'Verified Owner',role:'Owner',email:'owner@test.local'},{userId:'writer-id',fullName:'Writer',role:'სცენარისტი',email:'writer@test.local'},{userId:'creative-id',fullName:'Creative',role:'კრეატიული დირექტორი',email:'creative@test.local'},{userId:'producer-id',fullName:'Producer',role:'პროდიუსერი',email:'producer@test.local'}];
const cache=new Map();
function load(path){if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,require:name=>name==='cloudflare:workers'?{env:{}}:name==='@/app/chatgpt-auth'?{getChatGPTUser:async()=>null}:name==='next/headers'?{headers:async()=>new Headers(),cookies:async()=>({get:()=>undefined})}:name==='@/lib/admin'?{getAdminAccess:async()=>actor}:name==='@/lib/storage'?{storage:()=>({DB})}:name==='@/lib/staff-access'?{listApprovedStaff:async()=>people}:name==='./site-controls'?load('lib/site-controls.ts'):name==='./department-directory'?load('lib/department-directory.ts'):name.startsWith('@/')?load(name.slice(2)+'.ts'):(()=>{throw Error(`Unexpected import ${name}`)})(),Date,JSON,crypto,Response,Request,URL,console:{error(){}}});return exports;}
const permission=load('lib/permissions.ts'),positions=load('lib/positions.ts'),api=load('app/api/admin/positions/route.ts'),departments=load('app/api/admin/departments/route.ts');
const setActor=role=>{actor={email:role==='Developer'?'nikolozkabulashvili0@gmail.com':`${role}@test.local`,role,isDeveloper:role==='Developer',isOwner:role==='Developer'||role==='Owner',isApprovedStaff:true,permissions:permission.defaultPermissions(role)}};
const request=(method,body,origin='https://test.local',path='positions')=>new Request(`https://test.local/api/admin/${path}`,{method,headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
assert.equal((await api.GET()).status,403);
setActor('სცენარისტი');assert.equal((await api.POST(request('POST',{name:'Denied role'}))).status,403);
setActor('HR');assert.equal((await api.PATCH(request('PATCH',{name:'Owner',permissions:[]}))).status,403);assert.equal((await api.DELETE(request('DELETE',{name:'HR'}))).status,403);assert.equal((await api.POST(request('POST',{name:'New role'},'https://attacker.local'))).status,403);
setActor('Owner');const hr=await positions.getPosition('HR');assert.equal((await api.PATCH(request('PATCH',{name:'HR',permissions:hr.permissions}))).status,200);assert.equal((await api.DELETE(request('DELETE',{name:'Owner'}))).status,403);assert.equal((await api.DELETE(request('DELETE',{name:'HR'}))).status,403);assert.equal((await api.PATCH(request('PATCH',{currentName:'HR',name:'Renamed HR'}))).status,403);
setActor('კრეატიული დირექტორი');const writer=await positions.getPosition('სცენარისტი');assert.equal((await api.PATCH(request('PATCH',{name:writer.name,permissions:writer.permissions}))).status,200);assert.equal((await api.PATCH(request('PATCH',{name:writer.name,departmentId:'leadership',rank:0}))).status,403);assert.equal((await api.PATCH(request('PATCH',{name:writer.name,permissions:[...writer.permissions,'accounts.manage']}))).status,403);assert.equal((await api.PATCH(request('PATCH',{name:'Video Editor',permissions:[]}))).status,403);
setActor('Developer');assert.equal((await api.PATCH(request('PATCH',{name:'Developer',permissions:[]}))).status,403);assert.equal((await api.PATCH(request('PATCH',{name:'Video Editor',permissions:['chat.send']}))).status,403);assert.equal((await api.PATCH(request('PATCH',{name:'Video Editor',permissions:['invented.permission']}))).status,400);
assert.equal((await api.DELETE(request('DELETE',{name:'HR'}))).status,200);assert.equal((await positions.getPositions()).some(p=>p.name==='HR'),false);assert.equal((await positions.getPosition('HR')).active,false);assert.equal((await api.POST(request('POST',{name:'HR',departmentId:'hr',permissions:permission.defaultPermissions('HR')}))).status,200);
assert.equal((await api.POST(request('POST',{name:'Motion Artist',departmentId:'production',permissions:['workspace.view','chat.view']}))).status,200);assert.equal((await api.POST(request('POST',{name:'motion artist',permissions:[]}))).status,409);
const now=Date.now();sql.prepare('INSERT INTO admin_users (email,role,status,created,created_by) VALUES (?,?,?,?,?)').run('motion@test.local','Motion Artist','approved',now,'developer');sql.prepare('INSERT INTO team_members (user_id,email,full_name,role,status,created,updated) VALUES (?,?,?,?,?,?,?)').run('motion','motion@test.local','Motion','Motion Artist','approved',now,now);
assert.equal((await api.PATCH(request('PATCH',{currentName:'Motion Artist',name:'Motion Designer',departmentId:'production',permissions:['workspace.view','chat.view']}))).status,200);assert.equal(sql.prepare('SELECT role FROM admin_users WHERE email=?').get('motion@test.local').role,'Motion Designer');assert.equal(sql.prepare('SELECT role FROM team_members WHERE user_id=?').get('motion').role,'Motion Designer');assert.equal((await positions.getPosition('Motion Artist')).deleted,true);
assert.equal((await api.PATCH(request('PATCH',{name:'Motion Designer',active:false}))).status,200);assert.equal((await positions.getAssignablePositions()).includes('Motion Designer'),false);
setActor('სცენარისტი');assert.equal((await departments.GET()).status,200);assert.equal((await departments.PATCH(request('PATCH',{id:'story',headName:'No'},'https://test.local','departments'))).status,403);
setActor('Developer');assert.equal((await departments.PATCH(request('PATCH',{id:'story',headUserId:'writer-id'},'https://test.local','departments'))).status,400);assert.equal((await departments.PATCH(request('PATCH',{id:'story',directorUserId:'owner-id'},'https://test.local','departments'))).status,400);assert.equal((await departments.PATCH(request('PATCH',{id:'story',headUserId:'owner-id',directorUserId:'producer-id'},'https://test.local','departments'))).status,200);const linked=sql.prepare('SELECT head_name,head_user_id,director_user_id FROM staff_departments WHERE id=?').get('story');assert.equal(linked.head_name,'დამფუძნებელი');assert.equal(linked.head_user_id,'owner-id');assert.equal(linked.director_user_id,'producer-id');

// New multi-department form cannot create zero-level staff, duplicate assignments or reporting cycles.
const producer=await positions.getPosition('პროდიუსერი');
assert.equal(producer.memberships.length,3);
assert.equal((await api.PATCH(request('PATCH',{name:'პროდიუსერი',memberships:[{departmentId:'story',level:0,reportsTo:'Owner'}]}))).status,400);
assert.equal((await api.PATCH(request('PATCH',{name:'პროდიუსერი',memberships:[producer.memberships[0],producer.memberships[0]]}))).status,400);
const senior=await positions.getPosition('Senior Editor');
assert.equal((await api.PATCH(request('PATCH',{name:'Senior Editor',memberships:[{departmentId:'production',level:2,reportsTo:'Video Editor'}]}))).status,400);
assert.equal((await api.PATCH(request('PATCH',{name:'Owner',memberships:[{departmentId:'production',level:1,reportsTo:'Owner'}]}))).status,400);
const editor=await positions.getPosition('Video Editor');
assert.equal((await api.PATCH(request('PATCH',{name:'Video Editor',memberships:[...editor.memberships,{departmentId:'preproduction',level:5,reportsTo:'ოპერატორი'}]}))).status,200);
assert.equal((await positions.getPosition('Video Editor')).memberships.length,2);
assert.equal((await api.PATCH(request('PATCH',{name:'Video Editor',memberships:editor.memberships}))).status,200);
setActor('კრეატიული დირექტორი');assert.equal((await api.PATCH(request('PATCH',{name:'პროდიუსერი',permissions:producer.permissions}))).status,403);
assert.equal((await api.PATCH(request('PATCH',{name:'სცენარისტი',memberships:[]}))).status,403);
setActor('Developer');
assert.ok(sql.prepare('SELECT count(*) AS n FROM workspace_audit').get().n>5);
console.log('Role management and department authorization checks passed.');
