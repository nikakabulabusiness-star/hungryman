import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

const sql=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
function statement(query,args=[]){return {bind(...next){return statement(query,next)},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}})}}
const DB={prepare:statement,batch:async statements=>Promise.all(statements.map(s=>s.run()))};
let request=new Request('https://test.example');
const modules=new Map();
function load(file){
 if(modules.has(file))return modules.get(file);
 const exports={};modules.set(file,exports);
 function require(name){
  if(name==='cloudflare:workers')return {env:{}};
  if(name==='next/server')return {after:()=>{}};
  if(name==='next/headers')return {headers:async()=>request.headers,cookies:async()=>({get:key=>{const value=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='))?.slice(key.length+1);return value?{value}:undefined}})};
  if(name==='next/navigation')return {redirect:()=>{throw Error('Unexpected redirect')}};
  if(name==='@/lib/storage'||name==='./storage')return {storage:()=>({DB,BUCKET:{}})};
  const base=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);
  if(name.startsWith('@/')||name.startsWith('.'))return load(base.endsWith('.ts')?base:base+'.ts');
  throw Error('Unknown module '+name);
 }
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require,URL,Response,Request,Headers,FormData,File,crypto,Uint8Array,TextEncoder,TextDecoder,Date,Intl,console});
 return exports;
}
function req(path,{method='GET',body,token,headers={}}={}){request=new Request('https://test.example'+path,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});return request}
const native=load('lib/mobile-auth.ts'),auth=load('lib/staff-auth.ts'),login=load('app/api/mobile/auth/login/route.ts'),register=load('app/api/mobile/auth/register/route.ts'),me=load('app/api/mobile/me/route.ts'),calendar=load('app/api/calendar/route.ts'),accounts=load('app/api/mobile/admin/accounts/route.ts'),employees=load('app/api/mobile/admin/employees/route.ts'),adminUsers=load('app/api/admin/users/route.ts'),logout=load('app/api/auth/logout/route.ts');
const departments=load('app/api/mobile/departments/route.ts');
const email='native-test@example.test',password='native-test-password';
let response=await register.POST(req('/api/mobile/auth/register',{method:'POST',body:{email,password}}));assert.equal(response.status,400);
assert.equal(sql.prepare('SELECT count(*) n FROM team_members').get().n,0,'unverified legacy native registration is rejected');
const fixture=await auth.createPasswordRecord(password);sql.prepare("INSERT INTO team_members(user_id,email,full_name,status,password_hash,password_salt,email_verified_at,created,updated) VALUES('native-test',?,'Native Test','pending',?,?,1,1,1)").run(email,fixture.hash,fixture.salt);
assert.equal(sql.prepare('SELECT status FROM team_members WHERE email=?').get(email).status,'pending');
response=await login.POST(req('/api/mobile/auth/login',{method:'POST',body:{email,password}}));assert.equal(response.status,200);const {token}=await response.json();assert.match(token,/^hmw_[0-9a-f]{64}$/);assert.equal(response.headers.has('Set-Cookie'),false);assert.equal(response.headers.get('Cache-Control'),'no-store');
assert.equal(sql.prepare('SELECT token_hash FROM staff_sessions').get().token_hash,await auth.hashSessionToken(token));assert.notEqual(sql.prepare('SELECT token_hash FROM staff_sessions').get().token_hash,token);
req('/api/mobile/me',{token});let session=await(await me.GET()).json();assert.equal(session.permissions.isApprovedStaff,false);
assert.equal((await calendar.GET(req('/api/calendar?from=2026-10-01&to=2026-10-31',{token}))).status,403);
assert.equal((await accounts.GET()).status,403);assert.equal((await employees.GET()).status,403);assert.equal((await departments.GET()).status,403);
assert.equal((await login.POST(req('/api/mobile/auth/login',{method:'POST',body:{email,password},headers:{Origin:'https://attacker.example'}}))).status,403);
assert.equal((await register.POST(req('/api/mobile/auth/register',{method:'POST',body:{email,password},headers:{'Sec-Fetch-Site':'cross-site'}}))).status,403);
assert.equal(native.nativeAuthRequest(req('/api/auth/login',{method:'POST',body:{email,password}})),false);
response=await login.POST(req('/api/auth/login',{method:'POST',body:{email,password},headers:{Origin:'https://test.example'}}));assert.equal(response.status,200);assert.equal((await response.json()).token,undefined);const webToken=/hm_staff_session=([^;]+)/.exec(response.headers.get('Set-Cookie'))[1];
req('/api/mobile/me',{headers:{Cookie:`hm_staff_session=${webToken}`,Authorization:'Bearer invalid'}});assert.equal(await auth.getSessionUser(),null);
req('/api/mobile/me',{headers:{Cookie:`hm_staff_session=${webToken}`}});assert.equal((await auth.getSessionUser()).email,email);
req('/api/mobile/me',{token:'hmw_'+'a'.repeat(64)});assert.equal((await me.GET()).status,401);
const id=sql.prepare('SELECT user_id FROM team_members WHERE email=?').get(email).user_id;
sql.prepare("UPDATE team_members SET role='Video Editor',status='approved' WHERE email=?").run(email);
sql.prepare("INSERT INTO admin_users (email,role,status,created,created_by,can_create_shoots,can_edit_shoots) VALUES (?,'Video Editor','approved',1,'test',1,0)").run(email);
req('/api/mobile/me',{token});session=await(await me.GET()).json();assert.equal(session.permissions.isApprovedStaff,true);assert.equal(session.permissions.canAccessAdmin,false);
assert.equal((await calendar.GET(req('/api/calendar?from=2026-10-01&to=2026-10-31',{token}))).status,200);
assert.equal((await employees.GET()).status,403);
const departmentResponse=await departments.GET();assert.equal(departmentResponse.status,200);assert.equal(departmentResponse.headers.get('Cache-Control'),'private, no-store');
const directory=await departmentResponse.json();assert.ok(directory.departments.some(d=>d.id==='production'));assert.ok(directory.people.some(p=>p.userId===id&&p.departmentId==='production'));assert.ok(directory.people.every(p=>!('email' in p)&&!('birth_date' in p)&&!('personal_number' in p)));assert.ok(directory.positions.every(p=>!('permissions' in p)));
sql.prepare("UPDATE staff_positions SET is_active=0 WHERE name='Video Editor'").run();assert.equal((await departments.GET()).status,403);sql.prepare("UPDATE staff_positions SET is_active=1 WHERE name='Video Editor'").run();
const profile=load('app/api/team/profile/route.ts');assert.equal((await profile.PATCH(req('/api/team/profile',{method:'PATCH',token,body:{fullName:'Native Test'}}))).status,200);assert.equal(sql.prepare('SELECT full_name FROM team_members WHERE user_id=?').get(id).full_name,'Native Test');
assert.equal((await profile.PATCH(req('/api/team/profile',{method:'PATCH',token,headers:{Origin:'https://attacker.example'},body:{fullName:'Attacker'}}))).status,403);
sql.prepare("UPDATE admin_users SET role='HR' WHERE email=?").run(email);req('/api/mobile/me',{token});assert.equal((await accounts.GET()).status,200);assert.equal((await employees.GET()).status,200);
for(const [targetEmail,role,employeePosition] of [['owner-mobile@example.test','Owner','Video Editor'],['nikolozkabulashvili0@gmail.com','Developer','Video Editor'],[email,'HR','HR']]){
 if(targetEmail!==email)sql.prepare('INSERT INTO admin_users (email,role,status,created,created_by) VALUES (?,?,?,1,?)').run(targetEmail,role,'approved','seed');
 sql.prepare('INSERT INTO employees (id,full_name,birth_date,personal_number,email,phone,position,created,updated) VALUES (?,?,?,?,?,?,?,1,1)').run(targetEmail,'Test Person','2000-01-01','private-id',targetEmail,'555',employeePosition);
}
req('/api/mobile/admin/employees',{token});const employeeDirectory=await(await employees.GET()).json();assert.equal(employeeDirectory.employees.find(p=>p.email==='owner-mobile@example.test').canManage,false);assert.equal(employeeDirectory.employees.find(p=>p.email==='owner-mobile@example.test').departmentId,'leadership');assert.equal(employeeDirectory.employees.find(p=>p.email==='nikolozkabulashvili0@gmail.com').canManage,false);assert.equal(employeeDirectory.employees.find(p=>p.email===email).canManage,true);
assert.equal((await adminUsers.PATCH(req('/api/admin/users',{method:'PATCH',token,body:{email,role:'Owner',status:'approved'}}))).status,403);assert.equal(sql.prepare('SELECT role FROM admin_users WHERE email=?').get(email).role,'HR');
sql.prepare("UPDATE admin_users SET status='suspended' WHERE email=?").run(email);req('/api/mobile/me',{token});assert.equal((await(await me.GET()).json()).permissions.isApprovedStaff,false);assert.equal((await employees.GET()).status,403);
sql.prepare('UPDATE staff_sessions SET expires=0 WHERE token_hash=?').run(await auth.hashSessionToken(token));req('/api/mobile/me',{token});assert.equal((await me.GET()).status,401);
response=await login.POST(req('/api/mobile/auth/login',{method:'POST',body:{email,password}}));const newToken=(await response.json()).token;
assert.equal((await logout.POST(req('/api/auth/logout',{method:'POST',token:newToken,body:{}}))).status,200);req('/api/mobile/me',{token:newToken});assert.equal((await me.GET()).status,401);
const mobileSource=fs.readdirSync('mobile/src/app');assert.ok(mobileSource.includes('_layout.tsx'));assert.ok(!fs.readFileSync('mobile/src/app/_layout.tsx','utf8').includes('WebView')); // Only the embedded map uses a WebView; app navigation stays native.
console.log('PASS: native registration/login, token hashing, cookie isolation, CSRF, approval, roles, suspension, expiry and logout.');
sql.close();
