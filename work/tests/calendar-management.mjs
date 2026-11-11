import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

const sql=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
function statement(query,args=[]){return {bind(...next){return statement(query,next)},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}})}}
const DB={prepare:statement,batch:async statements=>{sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}};
let actor=null,today='2026-10-23';const modules=new Map();
function load(file){
 if(modules.has(file))return modules.get(file);
 const exports={};modules.set(file,exports);
 function require(name){
  if(name==='@/lib/storage'||name==='./storage')return {storage:()=>({DB})};
  if(name==='@/lib/admin')return {getAdminAccess:async()=>actor};
  if(name==='@/lib/staff-access')return {getStaffAccess:async()=>actor,listApprovedStaff:async()=>[{email:'staff@example.test',fullName:'Staff',role:'Video Editor',userId:'staff'}]};
  if(name==='@/lib/attendance')return {localDate:()=>today};
  if(name==='@/lib/visitor')return {sameOrigin:req=>req.headers.get('Origin')===new URL(req.url).origin};
  const base=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);
  if(name.startsWith('@/')||name.startsWith('.'))return load(base.endsWith('.ts')?base:base+'.ts');
  throw Error('Unknown module '+name);
 }
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,URL,Response,Request,Headers,crypto,Date,Intl,console});
 return exports;
}
const domain=load('lib/staff-calendar.ts'),permissions=load('lib/permissions.ts'),payday=load('app/api/admin/calendar/payday/route.ts'),calendar=load('app/api/calendar/route.ts'),notes=load('app/api/calendar/notes/route.ts');
const request=(route,method='GET',body,origin='https://test.example')=>new Request('https://test.example'+route,{method,headers:{Origin:origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
const role=(name='HR',id='hr')=>({email:id+'@example.test',userId:id,fullName:id,role:name,isApproved:true,isApprovedStaff:true,canManageCalendar:name==='HR',canCreateShoots:name==='HR',permissions:permissions.defaultPermissions(name)});
const range='/api/calendar?from=2026-09-01&to=2026-11-30';
actor=role();
assert.equal((await payday.PUT(request('/api/admin/calendar/payday','PUT',{date:'2026-10-28'}))).status,200);
let data=await (await calendar.GET(request(range))).json();
assert.deepEqual(data.events.filter(e=>e.kind==='salary').map(e=>e.start_date),['2026-09-28','2026-10-28','2026-11-26']);
assert.equal(data.canManage,true);
assert.equal(data.people.length,1);
assert.equal((await payday.PUT(request('/api/admin/calendar/payday','PUT',{date:'2026-10-30'}))).status,200);
data=await (await calendar.GET(request(range))).json();
assert.deepEqual(data.events.filter(e=>e.kind==='salary').map(e=>e.start_date),['2026-09-28','2026-10-30','2026-11-26']);
assert.equal(sql.prepare("SELECT COUNT(*) n FROM workspace_settings WHERE key='salary-date:2026-10'").get().n,1);
assert.equal((await payday.PUT(request('/api/admin/calendar/payday','PUT',{date:'2026-09-30'}))).status,409);
assert.equal((await payday.PUT(request('/api/admin/calendar/payday','PUT',{date:'2026-10-22'}))).status,409);
assert.equal((await payday.PUT(request('/api/admin/calendar/payday','PUT',{date:'2026-02-30'}))).status,400);
assert.equal((await payday.PUT(request('/api/admin/calendar/payday','PUT',{date:'2026-11-27'},'https://evil.test'))).status,403);
today='2026-10-31';
assert.equal((await payday.PUT(request('/api/admin/calendar/payday','PUT',{date:'2026-10-31'}))).status,409);
assert.equal(sql.prepare("SELECT value FROM workspace_settings WHERE key='salary-date:2026-10'").get().value,'2026-10-30');
actor=role('Video Editor','staff');
assert.equal((await payday.PUT(request('/api/admin/calendar/payday','PUT',{date:'2026-11-27'}))).status,403);
data=await (await calendar.GET(request(range))).json();assert.equal(data.canManage,false);assert.equal(data.people.length,0);
assert.equal((await notes.PUT(request('/api/calendar/notes','PUT',{date:'2026-11-02',body:'ორი სიტყვა შემდეგ სრული პირადი ნოუთი',userId:'hr'}))).status,200);
actor=role();data=await (await notes.GET(request('/api/calendar/notes?from=2026-11-01&to=2026-11-30&userId=staff'))).json();assert.equal(data.notes.length,0);
actor=role('Video Editor','staff');data=await (await notes.GET(request('/api/calendar/notes?from=2026-11-01&to=2026-11-30'))).json();assert.equal(data.notes[0].body,'ორი სიტყვა შემდეგ სრული პირადი ნოუთი');
actor.permissions=actor.permissions.filter(key=>key!=='cabinet.notes');
assert.equal((await notes.GET(request('/api/calendar/notes?from=2026-11-01&to=2026-11-30'))).status,403);
assert.equal((await notes.PUT(request('/api/calendar/notes','PUT',{date:'2026-11-02',body:'forbidden'}))).status,403);
actor.permissions=actor.permissions.filter(key=>key!=='calendar.view');assert.equal((await calendar.GET(request(range))).status,403);
assert.equal(domain.canRescheduleSalary('2026-11-02','2026-10-30','2026-10-23'),false);
assert.equal(domain.virtualSalaryEvents('2026-11-01','2026-11-30',{'2026-11':'2026-12-01'})[0].start_date,'2026-11-26');
console.log('PASS calendar management: single monthly payday, replacement/history preservation, past-day and cross-origin denial, role gates, private note identity isolation.');
