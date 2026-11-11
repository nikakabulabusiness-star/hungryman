import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8').replaceAll('--> statement-breakpoint',''));
let beforeBatch=null;
function statement(query,args=[]){return {query,args,bind(...next){return statement(query,next)},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}})}}
const DB={prepare:statement,batch:async ss=>{beforeBatch?.();beforeBatch=null;sql.exec('BEGIN');try{const r=[];for(const s of ss)r.push(await s.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
let now=Date.now(),req,deliveryFails=false,configuration=true,ip=0;const sent=[],background=[];
class Clock extends Date{static now(){return now}}
const env={WORK_AUTH_EMAIL_FROM:'security@example.test',WORK_AUTH_RESEND_API_KEY:'test-only-never-real',WORK_AUTH_CODE_SECRET:'test-only-secret-not-for-production-123456'};
const modules=new Map();
function load(file){if(modules.has(file))return modules.get(file);const exports={};modules.set(file,exports);function require(name){
 if(name==='cloudflare:workers')return {env:new Proxy(env,{get:(target,key)=>configuration?target[key]:undefined})};
 if(name==='next/server')return {after:fn=>background.push(fn)};
 if(name==='next/headers')return {headers:async()=>req?.headers||new Headers(),cookies:async()=>({get:()=>undefined})};
 if(name==='next/navigation')return {redirect:()=>{throw Error('Unexpected redirect')}};
 if(name==='@/lib/storage'||name==='./storage')return {storage:()=>({DB,BUCKET:{}})};
 const base=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);return load(base.endsWith('.ts')?base:base+'.ts');
 }
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require,URL,Response,Request,Headers,FormData,File,crypto,Uint8Array,Uint32Array,TextEncoder,TextDecoder,Date:Clock,Intl,console,AbortSignal,Error,fetch:async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');assert.match(options.headers['Idempotency-Key'],/^work-auth-/);if(deliveryFails)return Response.json({error:'not sent'},{status:503});sent.push(JSON.parse(options.body));return Response.json({id:crypto.randomUUID()})}});return exports;
}
const auth=load('lib/staff-auth.ts');
const routes={request:load('app/api/auth/email-code/request/route.ts'),verify:load('app/api/auth/email-code/verify/route.ts'),reset:load('app/api/auth/password-reset/route.ts'),register:load('app/api/auth/register/route.ts'),login:load('app/api/auth/login/route.ts')};
function limits(){sql.exec('DELETE FROM auth_rate_limits');ip++}
async function post(action,body,options={}){const route=action==='request'?'email-code/request':action==='verify'?'email-code/verify':action==='reset'?'password-reset':action;const prefix=options.native?'/api/mobile/auth/':'/api/auth/';req=new Request('https://test.example'+prefix+route,{method:'POST',headers:{'Content-Type':'application/json','cf-connecting-ip':'test-ip-'+ip,...(options.native?{}:{Origin:'https://test.example'}),...options.headers},body:JSON.stringify(body)});const response=await routes[action].POST(req);assert.match(response.headers.get('Cache-Control')||'',/no-store/);return {status:response.status,body:await response.json(),response}}
const lastCode=()=>sent.at(-1)?.text.match(/: (\d{6})/)?.[1];
async function challenge(email,purpose='reset',options={}){const r=await post('request',{email,purpose},options);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.expiresAt-r.body.serverNow,120000);assert.equal(r.body.code,undefined);return {...r.body,email,purpose,code:lastCode()}}
async function verified(c){const r=await post('verify',c);assert.equal(r.status,200,JSON.stringify(r.body));assert.match(r.body.grant,/^[a-f0-9]{64}$/);return r.body.grant}
const password='Original-Password-123',newPassword='New-Password-456';
async function member(email,status='approved'){const p=await auth.createPasswordRecord(password),id=crypto.randomUUID();sql.prepare('INSERT INTO team_members(user_id,email,full_name,status,role,password_hash,password_salt,created,updated) VALUES(?,?,?,?,?,?,?,?,?)').run(id,email,'Test',status,'Video Editor',p.hash,p.salt,now,now);return id}
function complete(email,grant,changes={}){return {email,grant,password:newPassword,passwordConfirmation:newPassword,...changes}}

// Migration preserves existing accounts as unverified instead of claiming proof.
const email='member@example.test',id=await member(email);assert.equal(sql.prepare('SELECT email_verified_at FROM team_members WHERE user_id=?').get(id).email_verified_at,null);
configuration=false;assert.equal((await post('request',{email,purpose:'reset'})).status,503);assert.equal(sent.length,0);configuration=true;
assert.equal((await post('register',{email:'unverified@example.test',password,newPassword})).status,400);assert.equal(sql.prepare("SELECT count(*) n FROM team_members WHERE email='unverified@example.test'").get().n,0);
assert.equal((await post('request',{email,purpose:'reset'},{headers:{Origin:'https://bad.test'}})).status,403);
assert.equal((await post('request',{email,purpose:'reset'},{native:true,headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
assert.equal((await post('request',{email:'not-an-address',purpose:'reset'})).status,400);

// Native and browser share the protocol; server never sends the code/hash back.
let c=await challenge(email,'reset',{native:true});const stored=sql.prepare('SELECT * FROM auth_email_challenges WHERE email=?').get(email);assert.notEqual(stored.code_hash,c.code);assert.equal(stored.code_hash.length,64);assert.equal((await post('request',{email,purpose:'reset'})).status,429);
assert.equal((await post('verify',{...c,purpose:'register'})).status,400);
assert.equal((await post('verify',{...c,email:'other@example.test'})).status,400);
assert.equal((await post('verify',{...c,code:c.code==='000000'?'000001':'000000'})).status,400);
let grant=await verified(c);assert.equal((await post('verify',c)).status,400);
assert.equal((await post('reset',complete(email,grant,{passwordConfirmation:'different'}))).status,400);
assert.equal((await post('register',complete(email,grant))).status,400,'grants are purpose bound');
assert.equal((await post('reset',complete('other@example.test',grant))).status,400,'grants are mailbox bound');
// Existing browser + mobile sessions, including attached web-push state.
const t1='a'.repeat(64),t2='hmw_'+'b'.repeat(64);for(const t of [t1,t2])sql.prepare('INSERT INTO staff_sessions VALUES(?,?,?,?,?)').run(await auth.hashSessionToken(t),id,now,now+86400000,now);
sql.prepare('INSERT INTO push_devices VALUES(?,?,?)').run('old-device',id,now);
sql.prepare('INSERT INTO web_push_subscriptions VALUES(?,?,?,?,?,?,?)').run('sub','https://push.example.test',id,await auth.hashSessionToken(t1),'public','auth',now);
assert.equal((await post('reset',complete(email,grant))).status,200);
assert.equal(sql.prepare('SELECT count(*) n FROM staff_sessions WHERE user_id=?').get(id).n,0);assert.equal(sql.prepare('SELECT count(*) n FROM push_devices WHERE user_id=?').get(id).n,0);assert.equal(sql.prepare('SELECT count(*) n FROM web_push_subscriptions').get().n,0);
assert.equal((await post('reset',complete(email,grant))).status,400);assert.equal((await post('login',{email,password})).status,401);assert.equal((await post('login',{email,password:newPassword},{native:true})).status,200);
assert.equal(sql.prepare('SELECT status FROM team_members WHERE user_id=?').get(id).status,'approved');
assert.ok(sql.prepare('SELECT email_verified_at FROM team_members WHERE user_id=?').get(id).email_verified_at);

// Exact server expiry, including a correct code after 2 minutes.
limits();c=await challenge('expires@example.test','register');now=c.expiresAt;assert.equal((await post('verify',c)).status,400);
// Five attempts exhaust this challenge, even when the sixth is correct.
limits();c=await challenge('attempts@example.test','register');for(let i=0;i<5;i++)assert.equal((await post('verify',{...c,code:c.code==='123456'?'654321':'123456'})).status,400);assert.equal((await post('verify',c)).status,400);
// Successful resend invalidates both the old code and an already verified grant.
limits();c=await challenge('resend@example.test','register');grant=await verified(c);now+=61000;const replacement=await challenge(c.email,'register');assert.notEqual(replacement.challengeId,c.challengeId);assert.equal((await post('verify',c)).status,400);assert.equal((await post('register',complete(c.email,grant))).status,400);grant=await verified(replacement);assert.equal((await post('register',complete(c.email,grant))).status,200);assert.equal(sql.prepare('SELECT status FROM team_members WHERE email=?').get(c.email).status,'pending');assert.equal((await post('register',complete(c.email,grant))).status,400);
// Unknown reset addresses receive the same request shape; cannot create an account.
limits();c=await challenge('unknown@example.test');assert.equal((await post('verify',c)).status,400);assert.equal(sql.prepare('SELECT count(*) n FROM team_members WHERE email=?').get(c.email).n,0);
// Existing registration cannot overwrite passwords after mailbox verification.
limits();now+=61000;c=await challenge(email,'register');grant=await verified(c);assert.equal((await post('register',complete(email,grant))).status,409);
// Failed delivery deletes the challenge, never reports a successful send.
limits();deliveryFails=true;assert.equal((await post('request',{email:'failure@example.test',purpose:'register'})).status,503);assert.equal(sql.prepare("SELECT count(*) n FROM auth_email_challenges WHERE email='failure@example.test'").get().n,0);deliveryFails=false;
// An expired verified grant cannot update the password.
limits();c=await challenge('grant-expiry@example.test','register');grant=await verified(c);now+=600001;assert.equal((await post('register',complete(c.email,grant))).status,400);
// Deactivated accounts stay deactivated after recovery.
limits();const blocked=await member('blocked@example.test','blocked');c=await challenge('blocked@example.test');grant=await verified(c);assert.equal((await post('reset',complete(c.email,grant))).status,200);assert.equal(sql.prepare('SELECT status FROM team_members WHERE user_id=?').get(blocked).status,'blocked');
// Concurrent completions consume the grant exactly once.
limits();c=await challenge('race@example.test','register');grant=await verified(c);const raced=await Promise.all([post('register',complete(c.email,grant)),post('register',complete(c.email,grant))]);assert.deepEqual(raced.map(x=>x.status).sort(),[200,400]);
// Deletion/recreation or a password change between read/transaction cannot be undone.
limits();now+=61000;c=await challenge(email);grant=await verified(c);beforeBatch=()=>sql.prepare("UPDATE team_members SET password_hash='changed-concurrently' WHERE user_id=?").run(id);assert.equal((await post('reset',complete(email,grant))).status,400);assert.equal(sql.prepare('SELECT password_hash FROM team_members WHERE user_id=?').get(id).password_hash,'changed-concurrently');
// A login started with an old password cannot create a post-reset session.
limits();const lateEmail='late-login@example.test',lateId=await member(lateEmail);beforeBatch=()=>sql.prepare("UPDATE team_members SET password_hash='reset-won' WHERE user_id=?").run(lateId);assert.equal((await post('login',{email:lateEmail,password},{native:true})).status,401);assert.equal(sql.prepare('SELECT count(*) n FROM staff_sessions WHERE user_id=?').get(lateId).n,0);
// Repeated requests cannot bypass per-address limits by changing IP or User-Agent.
limits();const limited='limited@example.test';for(let i=0;i<5;i++){ip++;now+=61000;assert.equal((await post('request',{email:limited,purpose:'register'},{headers:{'User-Agent':'different-'+i}})).status,200)}ip++;now+=61000;assert.equal((await post('request',{email:limited,purpose:'reset'},{headers:{'User-Agent':'new-agent'}})).status,429);
// Registration feature controls are checked again at completion.
limits();c=await challenge('feature-off@example.test','register');grant=await verified(c);sql.prepare("INSERT OR REPLACE INTO workspace_settings VALUES('site_features','{\"registration\":false}',?,'test')").run(now);assert.equal((await post('register',complete(c.email,grant))).status,403);
console.log('Email auth: verified registration, 120s expiry, single use, replay/race/attempt/rate limits, recovery and session/push revocation passed. No real email sent.');
