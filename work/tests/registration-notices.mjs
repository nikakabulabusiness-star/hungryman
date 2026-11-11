import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const sql=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8').replaceAll('--> statement-breakpoint',''));
function statement(query,args=[]){return {bind(...next){return statement(query,next)},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}})}}
const DB={prepare:statement,batch:async list=>{sql.exec('BEGIN');try{const results=[];for(const item of list)results.push(await item.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}};
const people=[{userId:'hr',email:'hr@test.example',fullName:'HR',role:'HR'},{userId:'owner',email:'owner@test.example',fullName:'Owner',role:'Owner'},{userId:'dev',email:'dev@test.example',fullName:'Developer',role:'Developer'},{userId:'worker',email:'worker@test.example',fullName:'Worker',role:'Video Editor'}];
let actor=null;const cache=new Map();function load(file){if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);function require(name){
 if(name==='next/server')return {after:()=>{}};if(name==='cloudflare:workers')return {env:{}};
 if(['@/lib/storage','./storage'].includes(name))return {storage:()=>({DB})};
 if(['@/lib/staff-access','./staff-access'].includes(name))return {listApprovedStaff:async()=>people,getStaffAccess:async()=>actor};
 if(name==='@/lib/staff-auth')return {hashSessionToken:async token=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex'),newSessionToken:()=>crypto.randomUUID().replaceAll('-','').repeat(2),consumeAuthRateLimit:async()=>true,createPasswordRecord:async()=>({hash:'safe-test-hash',salt:'salt'}),normalizeEmail:x=>String(x).toLowerCase(),validEmail:x=>x.includes('@'),validPassword:x=>x.length>=8};
 if(name==='@/lib/mobile-auth')return {nativeAuthRequest:()=>false};if(name==='@/lib/visitor')return {sameOrigin:req=>req.headers.get('origin')==='https://test.example'};
 if(name.startsWith('@/')||name.startsWith('.')){const p=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);return load(p.endsWith('.ts')?p:p+'.ts')}
 throw Error(name);
 }vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{require,exports,Date,Intl,crypto,Response,Request,URL,Headers,AbortSignal,TextEncoder,TextDecoder,Uint8Array,console});return exports}
const register=load('app/api/auth/register/route.ts'),inbox=load('app/api/notifications/route.ts'),policy=load('lib/notification-policy.ts'),perms=load('lib/permissions.ts');
// Only a verified grant reaches registration. OTP validation is tested separately.
const grants=new Map();
async function post(email){let grant=grants.get(email);if(!grant){grant=crypto.randomUUID().replaceAll('-','').repeat(2);grants.set(email,grant);const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(grant))).toString('hex');sql.prepare("INSERT INTO auth_email_challenges(email,purpose,challenge_id,code_hash,expires,updated,verified_at,grant_hash,grant_expires) VALUES(?,'register',?,'test-digest',?,?,?,?,?)").run(email,crypto.randomUUID(),Date.now()+120000,Date.now(),Date.now(),hash,Date.now()+600000)}return new Request('https://test.example/api/auth/register',{method:'POST',headers:{origin:'https://test.example','Content-Type':'application/json'},body:JSON.stringify({email,password:'test-password-only',passwordConfirmation:'test-password-only',grant})})};
assert.equal((await register.POST(await post('new@example.test'))).status,200);
const rows=sql.prepare('SELECT user_id,target,target_id FROM work_notifications').all();assert.deepEqual(rows.map(r=>r.user_id).sort(),['dev','hr','owner']);assert.ok(rows.every(r=>r.target==='accounts'));
assert.equal(policy.noticeHref('accounts','any'),'/admin/access');
assert.equal((await register.POST(await post('new@example.test'))).status,400);assert.equal(sql.prepare('SELECT COUNT(*) n FROM work_notifications').get().n,3,'Duplicate registration does not spam reviewers');
actor={...people[0],isApproved:true,permissions:perms.defaultPermissions('HR')};assert.equal((await(await inbox.GET(new Request('https://test.example/api/notifications'))).json()).items.length,1);
actor.permissions=[];const revoked=await(await inbox.GET(new Request('https://test.example/api/notifications'))).json();assert.equal(revoked.items.length,0);assert.equal(revoked.unread,0,'Account notice hidden immediately when review permission revoked');
assert.equal(policy.canReviewAccounts({role:'Video Editor',permissions:perms.defaultPermissions('HR')}),false,'Broad permissions alone do not make ordinary staff account reviewers');
sql.prepare("UPDATE staff_positions SET permissions_json='[]' WHERE name='HR'").run();await register.POST(await post('second@example.test'));assert.equal(sql.prepare("SELECT COUNT(*) n FROM work_notifications WHERE user_id='hr'").get().n,1,'Revoked HR excluded from new events');
console.log('PASS: pending registration notices are atomic, deduplicated, only authorized reviewers, role+permission gating, hidden on revocation, accounts deep link.');
