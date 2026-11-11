import {feedbackCategories} from '../public/content.js';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../dist/server/index.js';
const sql=new DatabaseSync(':memory:');for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
const DB={prepare(query){let params=[];const stmt={bind(...p){params=p;return stmt},async first(){return sql.prepare(query).get(...params)||null},async all(){return {results:sql.prepare(query).all(...params)}},async run(){return sql.prepare(query).run(...params)}};return stmt},async batch(statements){sql.exec('BEGIN');try{const rs=await Promise.all(statements.map(s=>s.run()));sql.exec('COMMIT');return rs}catch(e){sql.exec('ROLLBACK');throw e}}};
const blobs=new Map(),env={DB,ADMIN_EMAIL:'admin@example.test',TRACKING_SECRET:'test-only-secret',ASSETS:{fetch:()=>new Response('asset')},BUCKET:{put:async(k,b,meta)=>blobs.set(k,{body:b,...meta}),head:async k=>blobs.get(k),get:async k=>blobs.get(k)}};
const origin='https://hungryman-official.hungryman.chatgpt.site';let cookie='';
async function call(path,{method='GET',data,admin=false,email='admin@example.test',originHeader=origin,headers={}}={}){const h={...headers};if(admin){h['oai-authenticated-user-id']='test-admin-id';h['oai-authenticated-user-email']=email}if(method!=='GET')h.origin=originHeader;if(cookie)h.cookie=cookie;if(data){h['content-type']='application/json'}const r=await worker.fetch(new Request(origin+path,{method,headers:h,body:data?JSON.stringify(data):undefined}),env,{});let d;try{d=await r.clone().json()}catch{}return {r,d}}
assert.equal((await call('/api/admin/summary')).r.status,401);
assert.equal((await call('/admin/')).r.status,302);
assert.equal((await call('/api/admin/summary',{admin:true,email:'attacker@example.test'})).r.status,403);
assert.equal((await call('/api/admin/sponsors',{method:'POST',data:{name:'invalid'},admin:true,originHeader:'https://evil.test'})).r.status,403);
let {d:summary}=await call('/api/admin/summary',{admin:true});assert.equal(summary.sponsors.length,3);assert.equal(summary.sales,0);
await call('/api/admin/sponsors/initial-2',{method:'DELETE',admin:true});assert.equal((await call('/api/admin/summary',{admin:true})).d.sponsors.length,2,'deleted seeded sponsors stay deleted');
const feedback={submissionId:crypto.randomUUID(),name:'Test',email:'test@example.test',category:'ვიდეოს იდეა',message:'<script>unsafe</script>'};
assert.equal((await call('/api/feedback',{method:'POST',data:feedback})).r.status,201);await call('/api/feedback',{method:'POST',data:feedback});assert.equal(sql.prepare('SELECT COUNT(*) n FROM feedback').get().n,1,'idempotent feedback');
const media=crypto.randomUUID()+'.jpg';blobs.set(media,{body:new Uint8Array(),httpMetadata:{contentType:'image/jpeg'}});
const casting={title:'Test casting',description:'Test description',cover:'/media/'+media,questions:[{id:'why',label:'რატომ?',type:'text',required:true}],active:true};
const created=await call('/api/admin/castings',{method:'POST',data:casting,admin:true});assert.equal(created.r.status,200);const id=created.d.id;assert.equal((await call('/api/castings')).d.length,1);
const application={submissionId:crypto.randomUUID(),name:'Test Person',email:'person@example.test',phone:'+995555123456',consent:true,answers:{}};
assert.equal((await call('/api/castings/'+id+'/apply',{method:'POST',data:application})).r.status,400);application.answers.why='Test answer';assert.equal((await call('/api/castings/'+id+'/apply',{method:'POST',data:application})).r.status,201);await call('/api/castings/'+id+'/apply',{method:'POST',data:application});assert.equal(sql.prepare('SELECT COUNT(*) n FROM applications').get().n,1);
await call('/api/admin/castings/'+id,{method:'PUT',data:{...casting,active:false},admin:true});assert.equal((await call('/api/castings')).d.length,0);assert.equal((await call('/api/castings/'+id+'/apply',{method:'POST',data:application})).r.status,409);assert.equal((await call('/api/admin/applications',{admin:true})).d.rows[0].answers[0].value,'Test answer');
let visit=await call('/api/track',{method:'POST',data:{type:'pageview',path:'/business/',eventId:crypto.randomUUID()}});assert.equal(visit.r.status,200);cookie=visit.r.headers.get('set-cookie').split(';')[0];const eventId=crypto.randomUUID();for(let i=0;i<2;i++)await call('/api/track',{method:'POST',data:{type:'business_email',path:'/business/',eventId}});assert.equal(sql.prepare('SELECT COUNT(*) n FROM visitors').get().n,1);assert.equal(sql.prepare("SELECT COUNT(*) n FROM events WHERE type='business_email'").get().n,1);await call('/api/track',{method:'POST',data:{type:'heartbeat',path:'/'},admin:true});assert.equal(sql.prepare('SELECT COUNT(*) n FROM visitors').get().n,1);
const sale=await call('/api/admin/sales',{method:'POST',data:{productId:'original-tee',quantity:2,unitPrice:69},admin:true});summary=(await call('/api/admin/summary',{admin:true})).d;assert.equal(summary.sales,2);assert.equal(summary.revenue,13800);await call('/api/admin/sales/'+sale.d.id,{method:'PATCH',data:{status:'cancelled'},admin:true});assert.equal((await call('/api/admin/summary',{admin:true})).d.sales,0);
assert.equal((await call('/api/admin/mail-sync',{method:'POST',data:{},admin:true})).r.status,409,'disconnected mail is explicit');
console.log('PASS: admin access / CSRF, durable sponsor deletion, idempotent feedback & applications, casting validation / deactivation, anonymous visitor cookie & click deduplication, admin exclusion, sales totals / cancellation, disconnected mailbox.');

// Delegation is restricted to the owner and revocation affects the next request.
assert.equal((await call('/api/admin/administrators',{admin:true})).r.status,200);
assert.equal((await call('/api/admin/administrators',{admin:true,method:'POST',data:{email:'ADMIN@example.test'}})).r.status,409);
assert.equal((await call('/api/admin/administrators',{admin:true,method:'POST',data:{email:'not-an-email'}})).r.status,400);
assert.equal((await call('/api/admin/administrators',{admin:true,method:'POST',data:{email:' Member@Example.Test '}})).r.status,201);
assert.equal((await call('/api/session',{admin:true,email:'member@example.test'})).d.admin,true);
assert.equal((await call('/api/admin/summary',{admin:true,email:'member@example.test'})).r.status,200);
assert.equal((await call('/api/admin/summary',{admin:true,email:'member@example.test'})).d.canManageAdmins,false);
assert.equal((await call('/api/admin/administrators',{admin:true,email:'member@example.test',method:'POST',data:{email:'extra@example.test'}})).r.status,403);
const delegated=(await call('/api/admin/administrators',{admin:true})).d.administrators[0];
assert.equal((await call('/api/admin/administrators/'+delegated.id,{admin:true,email:'member@example.test',method:'DELETE'})).r.status,403);
assert.equal((await call('/api/admin/administrators/'+delegated.id,{admin:true,method:'DELETE'})).r.status,200);
assert.equal((await call('/api/admin/summary',{admin:true,email:'member@example.test'})).r.status,403);
assert.equal((await call('/api/session',{admin:true,email:'member@example.test'})).d.admin,false);
console.log('PASS: owner-only delegation, email normalization, protected owner, delegated access, no onward delegation and immediate revocation.');

// External-channel authorization is owner-only and independent of Site sign-in.
cookie='';
let snapshotData=(await call('/api/analytics')).d;
assert.equal(snapshotData.source,'snapshot');assert.equal(snapshotData.periodViews,2860551);
for(const field of ['georgiaViewsPercent','age18To44ViewsPercent','averageViewDurationLongFormSeconds'])assert.equal(field in snapshotData,false);
assert.equal((await call('/api/admin/youtube/status')).r.status,401);
assert.equal((await call('/api/admin/youtube/status',{admin:true})).d.connected,false);
assert.equal((await call('/api/admin/youtube/connect',{admin:true,method:'POST'})).r.status,409);
assert.equal((await call('/api/admin/youtube/config',{admin:true,method:'POST',data:{clientId:'bad',clientSecret:'bad'}})).r.status,400);
await call('/api/admin/administrators',{admin:true,method:'POST',data:{email:'member@example.test'}});
assert.equal((await call('/api/admin/youtube/status',{admin:true,email:'member@example.test'})).r.status,403);
const config={clientId:'test.apps.googleusercontent.com',clientSecret:'test-only-client-secret'};
assert.equal((await call('/api/admin/youtube/config',{admin:true,method:'POST',data:config,originHeader:'https://evil.test'})).r.status,403);
assert.equal((await call('/api/admin/youtube/config',{admin:true,method:'POST',data:config})).r.status,200);
assert(!sql.prepare("SELECT value FROM settings WHERE key='yt_config'").get().value.includes(config.clientSecret));
const start=await call('/api/admin/youtube/connect',{admin:true,method:'POST'}),auth=new URL(start.r.headers.get('location'));
assert.equal(auth.origin,'https://accounts.google.com');assert.equal(auth.searchParams.get('code_challenge_method'),'S256');assert(auth.searchParams.get('scope').split(' ').every(s=>s.endsWith('.readonly')));
const state=auth.searchParams.get('state');cookie=start.r.headers.get('set-cookie').split(';')[0];
assert.equal((await call('/api/youtube/oauth-callback?state=bad&code=test',{admin:true})).r.status,403);
const realFetch=globalThis.fetch;let fetchCount=0;
const report={columnHeaders:[{name:'day'},{name:'creatorContentType'},{name:'views'}],rows:Array.from({length:40},(_,i)=>{const day=new Date(Date.UTC(2026,7,3+i)).toISOString().slice(0,10);return [[day,'VIDEO_ON_DEMAND',100],[day,'SHORTS',50]]}).flat()};
globalThis.fetch=async (input,options)=>{fetchCount++;const url=new URL(input);if(url.pathname==='/token')return Response.json({access_token:'test-access-token',refresh_token:'test-refresh-token'});if(url.pathname==='/revoke')return new Response();if(url.hostname==='youtubeanalytics.googleapis.com')return Response.json(report);if(url.pathname==='/youtube/v3/channels')return Response.json({items:[{id:'UCWGUvLISUIa5QciKrZY0jyw',statistics:{subscriberCount:'616000',viewCount:'165621642',hiddenSubscriberCount:false}}]});throw Error('Unexpected Google request')};
try{
 const cb=await call('/api/youtube/oauth-callback?state='+state+'&code=test',{admin:true});assert.equal(cb.r.status,303);assert(cb.r.headers.get('location').includes('youtube=connected'));
 assert.equal(cb.r.headers.get('referrer-policy'),'no-referrer');
 assert.equal((await call('/api/youtube/oauth-callback?state='+state+'&code=test',{admin:true})).r.status,403,'single-use state');
 const status=(await call('/api/admin/youtube/status',{admin:true})).d;assert.equal(status.connected,true);assert(status.lastSync);assert(!JSON.stringify(status).includes('test-refresh-token'));
 assert(!sql.prepare("SELECT value FROM settings WHERE key='yt_tokens'").get().value.includes('test-refresh-token'));
 const count=fetchCount,live=(await call('/api/analytics')).d;assert.equal(live.source,'youtube-api');assert.equal(live.periodViews,4200);assert.equal(live.longFormPeriodViewsApprox,2800);assert.equal(live.period.start,'2026-08-15');assert.equal(live.period.end,'2026-09-11');assert.equal(fetchCount,count,'fresh cache avoids Google calls');
 assert.equal((await call('/api/admin/youtube/config',{admin:true,method:'POST',data:config})).r.status,409);
 assert.equal((await call('/api/admin/youtube/disconnect',{admin:true,method:'POST'})).r.status,200);assert.equal((await call('/api/admin/youtube/status',{admin:true})).d.connected,false);assert.equal((await call('/api/analytics')).d.source,'snapshot');
 // A grant for any other channel is rejected and revoked, never stored.
 const again=await call('/api/admin/youtube/connect',{admin:true,method:'POST'}),state2=new URL(again.r.headers.get('location')).searchParams.get('state');cookie=again.r.headers.get('set-cookie').split(';')[0];
 globalThis.fetch=async input=>{const u=new URL(input);if(u.pathname==='/token')return Response.json({access_token:'wrong-channel',refresh_token:'wrong-refresh'});if(u.pathname==='/revoke')return new Response();return Response.json({items:[{id:'wrong-channel'}]})};
 const wrong=await call('/api/youtube/oauth-callback?state='+state2+'&code=test',{admin:true});assert(wrong.r.headers.get('location').includes('youtube=error'));assert.equal((await call('/api/admin/youtube/status',{admin:true})).d.connected,false);
}finally{globalThis.fetch=realFetch}
const businessHTML=readFileSync(new URL('../dist/client/business/index.html',import.meta.url),'utf8');assert.equal((businessHTML.match(/data-metric=/g)||[]).length,4);assert(!businessHTML.includes('analytics-audience'));
console.log('PASS: analytics snapshot, owner-only encrypted OAuth configuration, origin/state/PKCE guards, grant replay rejection, channel verification, 28-day aggregation, cached updates, disconnect and four visible metrics.');

// Work can read only the dedicated inbox endpoint with a server-only secret.
env.WORK_INBOX_SECRET='test-inbox-secret';
assert.equal((await call('/api/work-inbox')).r.status,403);
assert.equal((await call('/api/work-inbox',{headers:{authorization:'Bearer wrong'}})).r.status,403);
const bridge={authorization:'Bearer '+env.WORK_INBOX_SECRET};
assert.equal((await call('/api/work-inbox?kind=feedback',{headers:bridge})).d.rows.length>0,true);
assert.equal((await call('/api/work-inbox?kind=applications',{headers:bridge})).d.rows.length>0,true);
assert.equal((await call('/api/work-inbox?kind=administrators',{headers:bridge})).r.status,400);
assert.equal((await call('/api/admin/summary',{headers:bridge})).r.status,401,'bridge cannot enter main admin');
const existing=(await call('/api/work-inbox?kind=feedback',{headers:bridge})).d.rows[0];
const originalPrepare=DB.prepare.bind(DB);DB.prepare=(q)=>{const s=originalPrepare(q),run=s.run.bind(s);s.run=async()=>{const r=await run();return {...r,meta:{changes:Number(r.changes)}}};return s};
assert.equal((await call('/api/work-inbox?kind=feedback',{method:'PATCH',headers:bridge,data:{id:existing.id,status:'reviewed'}})).r.status,200);
assert.equal((await call('/api/work-inbox?kind=feedback',{headers:bridge})).d.rows[0].status,'reviewed');
const custom=new Request('https://hungryman.ge/api/feedback',{method:'POST',headers:{origin:'https://hungryman.ge','content-type':'application/json'},body:JSON.stringify({name:'Domain Test',email:'domain@test.example',message:'Custom domain submission',category:feedbackCategories[0]})});
assert.equal((await worker.fetch(custom,env,{})).status,201);
console.log('PASS: inbox secret, scoped access, read + status update, and custom-domain form submissions.');
