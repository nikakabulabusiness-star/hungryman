import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
// Denial must happen before any private query or mutation, even if the caller
// has a valid login and general admin.view. Exercise actual route handlers.
let actor,queries=0;
const modules=new Map();
function load(file){
 if(modules.has(file))return modules.get(file);
 const exports={};modules.set(file,exports);
 const require=name=>{
  if(name==='cloudflare:workers')return {env:{}};
  if(name==='next/server')return {after:()=>{throw Error('Deferred work started before permission check')}};
  if(name==='@/lib/admin')return {getAdminAccess:async()=>actor,isAdmin:async()=>true,OWNER_EMAIL:'nikolozkabulashvili0@gmail.com'};
  if(name==='@/lib/staff-access'||name==='./staff-access')return {getStaffAccess:async()=>actor,listApprovedStaff:async()=>[]};
  if(name==='@/lib/staff-auth')return {getSessionUser:async()=>({userId:'staff',email:'staff@test.example',status:'approved'})};
  if(name==='@/lib/storage')return {storage:()=>{queries++;throw Error('Private storage reached before permission check')}};
  if(name==='@/lib/visitor')return {sameOrigin:()=>true};
  if(name.startsWith('@/')||name.startsWith('.')){const base=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);return load(base.endsWith('.ts')?base:base+'.ts')}
  throw Error('Unexpected import '+name);
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,Response,Request,URL,Headers,Date,Intl,crypto,console,TextEncoder,TextDecoder,Uint8Array});return exports;
}
const cases=[['admin/inbox','GET'],['admin/inbox','PATCH'],
 ['presence','GET'],['admin/analytics','GET'],['admin/applications','POST'],['admin/applications/[id]','PATCH'],['admin/applications/order','PATCH'],['admin/vacancies','PATCH'],['cv/[id]','GET'],
 ['mobile/admin/applications','GET'],['mobile/admin/employees','GET'],['admin/attendance','GET'],['admin/attendance','PATCH'],['team/cabinet','GET'],['workspace','PUT'],['shoots','GET'],['shoots/[id]','GET'],['shoots/[id]','DELETE'],['shoots/photo','GET'],['social','GET'],['social','PUT'],['admin/day-off-entitlement','PUT'],['time-off','POST'],['team/profile','PATCH'],
];
for(const permissions of [[],['workspace.view','admin.view']]){
 actor={userId:'staff',email:'staff@test.example',role:'Video Editor',status:'approved',isApproved:true,isApprovedStaff:true,isDeveloper:false,permissions};
 for(const [route,method] of cases){
  const before=queries,r=await load('app/api/'+route+'/route.ts')[method](new Request('https://work.example/api/'+route,{method,...(method==='GET'?{}:{headers:{'Content-Type':'application/json'},body:'{}'})}),{params:Promise.resolve({id:'test'})});
  assert.equal(r.status,403,route+' '+method+' denies without matching permission');assert.equal(queries,before,route+' performs no restricted queries');
 }
}
console.log(`PASS ${cases.length*2} route denial checks: general admin access cannot bypass section/action permissions.`);
actor={userId:'developer',email:'developer@test.example',role:'Developer',isApproved:true,isApprovedStaff:true,isDeveloper:true,features:{map:false,attendance:false}};
for(const [route,method] of [['workspace/map','GET'],['workspace/places','GET'],['workspace/places','POST'],['workspace/places/photo','GET'],['attendance','GET'],['attendance','POST'],['attendance/requests','GET'],['attendance/requests','POST'],['attendance/requests','PATCH'],['admin/attendance','GET']]){
 const before=queries,r=await load('app/api/'+route+'/route.ts')[method](new Request('https://work.example/api/'+route,{method,...(method==='GET'?{}:{headers:{'Content-Type':'application/json'},body:'{}'})}));assert.equal(r.status,403,route+' blocks removed module even for Developer');assert.equal(queries,before);
}
console.log('PASS removed map/attendance modules deny reads and writes before storage, including Developer.');
