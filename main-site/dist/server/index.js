import { publicAnalytics, youtubeRoute } from './youtube.js';
import { adminPage } from './admin-page.js';
import { products, feedbackCategories } from './content.js';
const ORIGIN='https://hungryman-official.hungryman.chatgpt.site';
const MAIL='info@hungryman.ge';
const now=()=>Date.now();
const uuid=()=>crypto.randomUUID();
const reply=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const db=env=>{if(!env.DB)fail('მონაცემების შენახვა დროებით მიუწვდომელია.',503);return env.DB};
const all=async(env,sql,...args)=>(await db(env).prepare(sql).bind(...args).all()).results;
const run=(env,sql,...args)=>db(env).prepare(sql).bind(...args).run();
const first=(env,sql,...args)=>db(env).prepare(sql).bind(...args).first();
function identity(req){const id=req.headers.get('oai-authenticated-user-id'),email=req.headers.get('oai-authenticated-user-email');return id&&email?{id,email}:null}
function isOwner(req,env){const u=identity(req);return !!u&&!!env.ADMIN_EMAIL&&u.email.toLowerCase()===env.ADMIN_EMAIL.toLowerCase()}
async function isAdmin(req,env){if(isOwner(req,env))return true;const u=identity(req);return !!u&&!!(await first(env,'SELECT id FROM administrators WHERE email=?',u.email.toLowerCase()))}
async function guard(req,env){if(!identity(req))fail('ადმინისტრაციაში შესასვლელად გაიარე ავტორიზაცია.',401);if(!await isAdmin(req,env))fail('ამ გვერდზე წვდომა მხოლოდ ადმინისტრატორს აქვს.',403)}
function sameOrigin(req){const origin=req.headers.get('origin');if(![ORIGIN,'https://hungryman.ge'].includes(origin)||origin!==new URL(req.url).origin)fail('მოთხოვნის წყარო არასწორია.',403)}
const str=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const emailOk=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const statusOk=v=>['new','reviewed','archived'].includes(v);
async function bytes(req,max){const reader=req.body?.getReader();if(!reader)return new Uint8Array();let n=0,parts=[];while(true){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>max){await reader.cancel();fail('ფაილი ან ტექსტი ზედმეტად დიდია.',413)}parts.push(r.value)}const out=new Uint8Array(n);let p=0;for(const b of parts){out.set(b,p);p+=b.length}return out}
async function json(req){if(!req.headers.get('content-type')?.includes('application/json'))fail('მოთხოვნის ფორმატი არასწორია.',415);try{return JSON.parse(new TextDecoder().decode(await bytes(req,65536)))}catch(e){if(e.status)throw e;fail('მონაცემების ფორმატი არასწორია.')}}
async function sign(value,env){if(!env.TRACKING_SECRET)fail('სტატისტიკა დროებით მიუწვდომელია.',503);const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.TRACKING_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function visitor(req,env){let token=req.headers.get('cookie')?.match(/(?:^|;\s*)hm_visitor=([^;]+)/)?.[1];if(token){const [id,sig]=token.split('.');if(/^[0-9a-f-]{36}$/.test(id)&&sig===await sign(id,env))return {id,cookie:null}}const id=uuid();return {id,cookie:`hm_visitor=${id}.${await sign(id,env)}; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax`}}
async function rate(req,env,bucket,max,seconds=600){const raw=(req.headers.get('cf-connecting-ip')||identity(req)?.id||'unknown')+':'+bucket+':'+Math.floor(now()/1000/seconds);const key=await sign(raw,env);const r=await db(env).prepare('INSERT INTO request_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now()+seconds*1000).first();if(r.count>max)fail('ძალიან ბევრი მოთხოვნაა. ცოტა ხანში სცადე ხელახლა.',429)}
async function init(env){await db(env).batch([
 db(env).prepare('DELETE FROM request_limits WHERE key IN (SELECT key FROM request_limits WHERE expires_at < ? LIMIT 1000)').bind(now()),
 ...['Betlive','TBC Bank','2 ტონა'].map((name,i)=>db(env).prepare("INSERT OR IGNORE INTO sponsors (id,name,created_at) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='initialized')").bind('initial-'+i,name,now())),
 db(env).prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('initialized',?)").bind(String(now()))
]);}
function questions(v){if(!Array.isArray(v)||v.length>20)fail('შეგიძლია მაქსიმუმ 20 კითხვა დაამატო.');return v.map(q=>{const label=str(q.label,240),type=q.type;if(!label||!['text','textarea','number','select'].includes(type))fail('შეავსე კითხვების სათაურები.');const options=type==='select'?(q.options||[]).map(x=>str(x,100)).filter(Boolean).slice(0,20):[];if(type==='select'&&options.length<2)fail('არჩევით კითხვას მინიმუმ 2 ვარიანტი სჭირდება.');return {id:/^[\w-]{1,60}$/.test(q.id||'')?q.id:uuid(),label,type,required:!!q.required,options}})}
function cast(c){return {...c,active:!!c.active,questions:JSON.parse(c.questions)}}
async function handle(req,env,ctx){const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/';
 if(p==='/api/work-inbox')return workInbox(req,env);
 if(p==='/api/analytics'&&req.method==='GET')return publicAnalytics(env);
 if(p==='/api/youtube/oauth-callback')return youtubeRoute(req,env,{owner:isOwner(req,env),userId:identity(req)?.id,readJSON:json});
 if(p==='/api/session')return reply({admin:await isAdmin(req,env)});
 if(p==='/admin'){if(!identity(req))return new Response(null,{status:302,headers:{Location:'/signin-with-chatgpt?return_to=%2Fadmin%2F','Cache-Control':'no-store'}});await guard(req,env);return new Response(adminPage(isOwner(req,env)),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})}
 if(p.startsWith('/api/admin/')){await guard(req,env);if(req.method!=='GET')sameOrigin(req);await init(env);}
 if(p.startsWith('/api/admin/youtube/'))return youtubeRoute(req,env,{owner:isOwner(req,env),userId:identity(req)?.id,readJSON:json});
 if(p==='/api/admin/administrators'||p.startsWith('/api/admin/administrators/')){
  if(!isOwner(req,env))fail('ადმინისტრატორების მართვა მხოლოდ საიტის მფლობელს შეუძლია.',403);
  if(p==='/api/admin/administrators'&&req.method==='GET')return reply({owner:env.ADMIN_EMAIL,administrators:await all(env,'SELECT id,email,created_at FROM administrators ORDER BY created_at DESC')});
  if(p==='/api/admin/administrators'&&req.method==='POST'){
   const a=await json(req),email=str(a.email,254).toLowerCase();if(!emailOk(email))fail('ჩაწერე სწორი ელფოსტა.');if(email===env.ADMIN_EMAIL.toLowerCase())fail('ამ ელფოსტას მფლობელის წვდომა უკვე აქვს.',409);
   if(await first(env,'SELECT id FROM administrators WHERE email=?',email))fail('ამ ელფოსტას ადმინისტრატორის წვდომა უკვე აქვს.',409);
   const id=uuid();await run(env,'INSERT OR IGNORE INTO administrators (id,email,created_by,created_at) VALUES (?,?,?,?)',id,email,identity(req).id,now());return reply({ok:true,email},201);
  }
  const id=p.split('/').pop();if(req.method==='DELETE'&&/^[0-9a-f-]{36}$/.test(id)){await run(env,'DELETE FROM administrators WHERE id=?',id);return reply({ok:true})}
  fail('მოთხოვნა არასწორია.',400);
 }
 if(p==='/api/admin/summary'&&req.method==='GET'){
  const [online,unique,clicks,feedback,applications,sales,sponsors,started]=await Promise.all([
   first(env,'SELECT COUNT(*) AS n FROM visitors WHERE last_seen > ?',now()-90000),first(env,'SELECT COUNT(*) AS n FROM visitors'),first(env,"SELECT COUNT(*) AS n, COUNT(DISTINCT visitor_id) AS visitors FROM events WHERE type='business_email'"),first(env,"SELECT COUNT(*) AS n FROM feedback WHERE status='new'"),first(env,"SELECT COUNT(*) AS n FROM applications WHERE status='new'"),first(env,"SELECT COALESCE(SUM(quantity),0) AS n,COALESCE(SUM(quantity*unit_price_cents),0) AS revenue FROM sales WHERE status='paid'"),all(env,'SELECT * FROM sponsors ORDER BY created_at'),first(env,"SELECT value FROM settings WHERE key='initialized'")]);
  return reply({canManageAdmins:isOwner(req,env),online:online.n,unique:unique.n,businessClicks:clicks.n,businessVisitors:clicks.visitors,feedback:feedback.n,applications:applications.n,sales:sales.n,revenue:sales.revenue,sponsors,started:Number(started.value),email:MAIL,mailConfigured:!!(env.GMAIL_REFRESH_TOKEN&&env.GMAIL_CLIENT_ID&&env.GMAIL_CLIENT_SECRET)});
 }
 if(p==='/api/admin/sponsors'){
  if(req.method==='GET')return reply(await all(env,'SELECT * FROM sponsors ORDER BY created_at'));
  if(req.method==='POST'){const a=await json(req),name=str(a.name,100);if(!name)fail('ჩაწერე სპონსორის სახელი.');const id=uuid();await run(env,'INSERT INTO sponsors (id,name,created_at) VALUES (?,?,?)',id,name,now());return reply({id},201)}
 }
 let m=p.match(/^\/api\/admin\/sponsors\/([\w-]+)$/);if(m&&req.method==='DELETE'){await run(env,'DELETE FROM sponsors WHERE id=?',m[1]);return reply({ok:true})}
 if(p==='/api/admin/castings'&&req.method==='GET')return reply((await all(env,'SELECT * FROM castings ORDER BY created_at DESC')).map(cast));
 if(p==='/api/admin/castings'&&req.method==='POST'||/^\/api\/admin\/castings\/[\w-]+$/.test(p)&&req.method==='PUT'){
  const a=await json(req),title=str(a.title,160),description=str(a.description,5000),cover=str(a.cover,200),qs=questions(a.questions||[]);if(!title||!description||!/^\/media\/[\w-]+\.(jpg|png|webp)$/.test(cover))fail('საჭიროა სათაური, აღწერა და ატვირთული ფოტო.');if(!(await env.BUCKET.head(cover.slice(7))))fail('ფოტო ვერ მოიძებნა. ატვირთე ხელახლა.');
  const id=req.method==='POST'?uuid():p.split('/').pop();if(req.method==='PUT'&&!(await first(env,'SELECT id FROM castings WHERE id=?',id)))fail('კასტინგი ვერ მოიძებნა.',404);
  await run(env,'INSERT INTO castings (id,title,description,cover,questions,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,cover=excluded.cover,questions=excluded.questions,active=excluded.active,updated_at=excluded.updated_at',id,title,description,cover,JSON.stringify(qs),a.active?1:0,now(),now());return reply({id});
 }
 if(p==='/api/admin/upload'&&req.method==='POST'){
  await rate(req,env,'upload',20);if(!env.BUCKET)fail('ფოტოს ატვირთვა დროებით მიუწვდომელია.',503);
  const b=await bytes(req,5*1024*1024);let ext,type;
  if(b[0]===255&&b[1]===216&&b[2]===255){ext='jpg';type='image/jpeg'}else if(b[0]===137&&new TextDecoder().decode(b.slice(1,4))==='PNG'){ext='png';type='image/png'}else if(new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP'){ext='webp';type='image/webp'}else fail('ატვირთე JPG, PNG ან WebP ფოტო.');
  const key=uuid()+'.'+ext;await env.BUCKET.put(key,b,{httpMetadata:{contentType:type}});return reply({url:'/media/'+key},201);
 }
 if(p.startsWith('/media/')&&req.method==='GET'){const key=p.slice(7);if(!/^[\w-]+\.(jpg|png|webp)$/.test(key))fail('ფოტო ვერ მოიძებნა.',404);const obj=await env.BUCKET?.get(key);if(!obj)fail('ფოტო ვერ მოიძებნა.',404);return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata.contentType,'Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'}})}
 if(p==='/api/castings'&&req.method==='GET')return reply((await all(env,'SELECT * FROM castings WHERE active=1 ORDER BY created_at DESC')).map(cast));
 m=p.match(/^\/api\/castings\/([\w-]+)\/apply$/);if(m&&req.method==='POST'){
  sameOrigin(req);await rate(req,env,'applications',6);const a=await json(req);if(a.website)return reply({ok:true});const c=await first(env,'SELECT * FROM castings WHERE id=? AND active=1',m[1]);if(!c)fail('ამ კასტინგზე განაცხადების მიღება დასრულებულია.',409);
  const name=str(a.name,150),email=str(a.email,200),phone=str(a.phone,40);if(!name||!emailOk(email)||phone.replace(/\D/g,'').length<7||a.consent!==true)fail('შეავსე სახელი, ელფოსტა, ტელეფონი და თანხმობა.');
  const answers=JSON.parse(c.questions).map(q=>{const value=str(a.answers?.[q.id],3000);if(q.required&&!value)fail('უპასუხე სავალდებულო კითხვას: '+q.label);if(value&&q.type==='select'&&!q.options.includes(value))fail('პასუხის ვარიანტი არასწორია.');if(value&&q.type==='number'&&!Number.isFinite(Number(value)))fail('ამ კითხვაში ჩაწერე რიცხვი.');return {label:q.label,value}});
  const id=/^[0-9a-f-]{36}$/.test(a.submissionId||'')?a.submissionId:uuid();await run(env,'INSERT OR IGNORE INTO applications (id,casting_id,casting_title,name,email,phone,answers,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)',id,c.id,c.title,name,email,phone,JSON.stringify(answers),'new',now());return reply({ok:true,id},201);
 }
 if(p==='/api/feedback'&&req.method==='POST'){
  sameOrigin(req);await rate(req,env,'feedback',8);const a=await json(req);if(a.website)return reply({ok:true});const name=str(a.name,150),email=str(a.email,200),message=str(a.message,3000);if(!message||email&&!emailOk(email)||!feedbackCategories.includes(a.category))fail('შეამოწმე შეტყობინება და ელფოსტა.');
  const id=/^[0-9a-f-]{36}$/.test(a.submissionId||'')?a.submissionId:uuid();await run(env,'INSERT OR IGNORE INTO feedback (id,name,email,category,message,status,created_at) VALUES (?,?,?,?,?,?,?)',id,name,email,a.category,message,'new',now());return reply({ok:true,id},201);
 }
 if(p==='/api/track'&&req.method==='POST'){
  sameOrigin(req);if(await isAdmin(req,env)||/bot|crawl|spider|preview/i.test(req.headers.get('user-agent')||''))return reply({ok:true,excluded:true});await rate(req,env,'tracking',160,60);
  const a=await json(req);if(!['heartbeat','pageview','business_email'].includes(a.type))fail('მოვლენის ტიპი არასწორია.');const path=str(a.path,100);if(!['/','/shop/','/business/','/participate/','/feedback/'].includes(path))fail('გვერდი არასწორია.');if(a.type==='business_email'&&path!=='/business/')fail('გვერდი არასწორია.');const v=await visitor(req,env);
  const statements=[db(env).prepare('INSERT INTO visitors (id,first_seen,last_seen) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen').bind(v.id,now(),now())];
  if(a.type!=='heartbeat'&&/^[0-9a-f-]{36}$/.test(a.eventId||''))statements.push(db(env).prepare('INSERT OR IGNORE INTO events (id,visitor_id,type,path,created_at) VALUES (?,?,?,?,?)').bind(a.eventId,v.id,a.type,path,now()));
  await db(env).batch(statements);return reply({ok:true},200,v.cookie?{'Set-Cookie':v.cookie}:{});
 }
 m=p.match(/^\/api\/admin\/(feedback|applications|emails)$/);if(m&&req.method==='GET'){
  const tables={feedback:'feedback',applications:'applications',emails:'business_emails'},table=tables[m[1]],col=m[1]==='emails'?'received_at':'created_at';const offset=Math.max(0,Math.min(100000,Number(u.searchParams.get('offset'))||0));const rows=await all(env,`SELECT * FROM ${table} ORDER BY ${col} DESC LIMIT 50 OFFSET ?`,offset);return reply({rows:rows.map(r=>m[1]==='applications'?{...r,answers:JSON.parse(r.answers)}:r),hasMore:rows.length===50});
 }
 m=p.match(/^\/api\/admin\/(feedback|applications|emails)\/([\w-]+)$/);if(m&&req.method==='PATCH'){
  const a=await json(req);if(!statusOk(a.status))fail('სტატუსი არასწორია.');const table={feedback:'feedback',applications:'applications',emails:'business_emails'}[m[1]];await run(env,`UPDATE ${table} SET status=? WHERE id=?`,a.status,m[2]);return reply({ok:true});
 }
 if(p==='/api/admin/sales'&&req.method==='GET')return reply(await all(env,'SELECT * FROM sales ORDER BY created_at DESC LIMIT 100'));
 if(p==='/api/admin/sales'&&req.method==='POST'){
  const a=await json(req),product=products.find(p=>p.id===a.productId),quantity=Number(a.quantity),price=Number(a.unitPrice);if(!product||!Number.isInteger(quantity)||quantity<1||quantity>10000||!Number.isFinite(price)||price<0||price>100000)fail('შეამოწმე პროდუქტი, რაოდენობა და ფასი.');const id=uuid();await run(env,'INSERT INTO sales (id,product_id,product_name,quantity,unit_price_cents,status,source,created_at) VALUES (?,?,?,?,?,?,?,?)',id,product.id,product.name,quantity,Math.round(price*100),'paid','manual',now());return reply({id},201);
 }
 m=p.match(/^\/api\/admin\/sales\/([\w-]+)$/);if(m&&req.method==='PATCH'){const a=await json(req);if(!['paid','cancelled'].includes(a.status))fail('სტატუსი არასწორია.');await run(env,'UPDATE sales SET status=? WHERE id=?',a.status,m[1]);return reply({ok:true})}
 if(p==='/api/admin/mail-sync'&&req.method==='POST'){await rate(req,env,'mail-sync',1,45);return syncMail(env)}
 if(p.startsWith('/api/'))return reply({error:'მოთხოვნა ვერ მოიძებნა.'},404);
 if(!['GET','HEAD'].includes(req.method))return reply({error:'მეთოდი დაუშვებელია.'},405);
 return env.ASSETS.fetch(req);
}
function decode64(v){try{return new TextDecoder().decode(Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))}catch{return ''}}
function plainBody(p){if(p.mimeType==='text/plain'&&p.body?.data)return decode64(p.body.data);return (p.parts||[]).map(plainBody).filter(Boolean).join('\n')}
async function syncMail(env){
 if(!env.GMAIL_REFRESH_TOKEN||!env.GMAIL_CLIENT_ID||!env.GMAIL_CLIENT_SECRET)return reply({error:'info@hungryman.ge ჯერ არ არის დაკავშირებული. საჭიროა ამ საფოსტო ანგარიშის ავტორიზაცია.',connected:false},409);
 const tokenReq=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GMAIL_CLIENT_ID,client_secret:env.GMAIL_CLIENT_SECRET,refresh_token:env.GMAIL_REFRESH_TOKEN,grant_type:'refresh_token'}),signal:AbortSignal.timeout(15000)});const token=await tokenReq.json();if(!tokenReq.ok||!token.access_token)fail('ფოსტის ავტორიზაცია განაახლე.',502);
 const gmail=async path=>{const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)});if(!r.ok)fail('ფოსტასთან კავშირი ვერ დამყარდა.',502);return r.json()};
 const profile=await gmail('profile');if(profile.emailAddress?.toLowerCase()!==MAIL)fail('დაკავშირებული ანგარიში info@hungryman.ge უნდა იყოს.',409);
 const q='in:inbox (sponsor OR sponsorship OR partnership OR collaboration OR advertising OR სპონსორობა OR თანამშრომლობა OR შემოთავაზება OR რეკლამა OR сотрудничество)';
 const list=await gmail('messages?maxResults=25&q='+encodeURIComponent(q));let imported=0;
 for(const item of list.messages||[]){if(await first(env,'SELECT id FROM business_emails WHERE id=?',item.id))continue;const m=await gmail('messages/'+encodeURIComponent(item.id)+'?format=full'),h=n=>m.payload.headers.find(x=>x.name.toLowerCase()===n)?.value||'';await run(env,'INSERT OR IGNORE INTO business_emails (id,sender,subject,body,status,received_at) VALUES (?,?,?,?,?,?)',m.id,h('from').slice(0,300),h('subject').slice(0,500),(plainBody(m.payload)||m.snippet||'').slice(0,20000),'new',Number(m.internalDate)||now());imported++}
 await run(env,"INSERT INTO settings (key,value) VALUES ('mail_sync',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",String(now()));return reply({ok:true,imported,connected:true});
}
async function workInbox(req,env){
 if(!env.WORK_INBOX_SECRET||req.headers.get('authorization')!=='Bearer '+env.WORK_INBOX_SECRET)return reply({error:'წვდომა შეზღუდულია.'},403);
 const u=new URL(req.url),kind=u.searchParams.get('kind')||'feedback',tables={feedback:'feedback',applications:'applications',emails:'business_emails'};
 if(!Object.hasOwn(tables,kind))return reply({error:'ტიპი არასწორია.'},400);
 const table=tables[kind];
 if(req.method==='GET'){const offset=Number(u.searchParams.get('offset')||0);if(!Number.isInteger(offset)||offset<0||offset>100000)return reply({error:'გვერდი არასწორია.'},400);
 const col=kind==='emails'?'received_at':'created_at',rows=await all(env,`SELECT * FROM ${table} ORDER BY ${col} DESC,id DESC LIMIT 51 OFFSET ?`,offset);
 return reply({rows:rows.slice(0,50).map(row=>({...row,answers:kind==='applications'?JSON.parse(row.answers):undefined})),hasMore:rows.length>50,offset});}
 if(req.method==='PATCH'){const a=await json(req);if(!/^[\w-]{1,100}$/.test(a.id||'')||!statusOk(a.status))return reply({error:'მონაცემები არასწორია.'},400);
 const result=await run(env,`UPDATE ${table} SET status=? WHERE id=?`,a.status,a.id);if(!result.meta.changes)return reply({error:'ჩანაწერი ვერ მოიძებნა.'},404);return reply({ok:true});}
 return reply({error:'მეთოდი დაუშვებელია.'},405);
}
export default {async fetch(req,env,ctx){try{const r=await handle(req,env,ctx);const headers=new Headers(r.headers);headers.set('X-Content-Type-Options','nosniff');if(!headers.has('Referrer-Policy'))headers.set('Referrer-Policy','strict-origin-when-cross-origin');if(r.headers.get('Content-Type')?.includes('text/html'))headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; form-action 'self' https://accounts.google.com; base-uri 'self'");return new Response(r.body,{status:r.status,headers})}catch(e){if(!e.status)console.error('Hungryman request error',e.message);return reply({error:e.status?e.message:'დროებითი შეფერხებაა. სცადე ხელახლა — შევსებული ტექსტი შეინარჩუნე.'},e.status||503)}}};
