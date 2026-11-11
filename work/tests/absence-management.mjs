import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const sql=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8').replaceAll('--> statement-breakpoint',''));
function stmt(query,args=[]){return {bind(...values){assert.ok(values.length<=100);return stmt(query,values)},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}})}}
const DB={prepare:stmt,batch:async statements=>{sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};
const objects=new Map(),BUCKET={put:async(k,b)=>objects.set(k,b),get:async k=>objects.has(k)?{body:objects.get(k)}:null,delete:async k=>objects.delete(k)};
let actor=null;const cache=new Map();
function load(file){if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);function require(name){if(name==='@/lib/staff-access')return {getStaffAccess:async()=>actor};if(name==='@/lib/visitor')return {sameOrigin:r=>r.headers.get('origin')==='https://work.test'};if(name==='@/lib/notifications')return {noticeStatements:()=>[],dispatchNotices:()=>{}};if(name==='@/lib/storage'||name==='./storage')return {storage:()=>({DB,BUCKET})};const p=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);return load(p.endsWith('.ts')?p:p+'.ts')};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,require,URL,Request,Response,Headers,Uint8Array,DOMException,crypto,Date,Intl,TextEncoder,console});return exports}
const api=load('app/api/admin/absences/route.ts'),docs=load('app/api/admin/absences/documents/route.ts'),domain=load('lib/cabinet.ts');
const hr={userId:'hr',email:'hr@test',role:'HR',isApproved:true},owner={...hr,userId:'owner',role:'Owner'},developer={...hr,role:'Developer'},editor={...hr,role:'Video Editor'},admin={...hr,role:'Admin'};
function req(url,{method='GET',body,origin='https://work.test',raw}={}){return new Request('https://work.test'+url,{method,headers:{origin,...(body?{'Content-Type':'application/json'}:{})},body:raw??(body?JSON.stringify(body):undefined)})}
async function json(response,status=200){assert.equal(response.status,status,await response.clone().text());return response.json()}
function event({kind='leave',email='employee@test',name='Team Member',start='2026-11-02',end='2026-11-04',fromRequest=false}={}){const requestId=crypto.randomUUID(),id=fromRequest?'request-'+requestId:crypto.randomUUID();sql.prepare("INSERT INTO staff_calendar_events (id,kind,title,start_date,end_date,employee_user_id,employee_email,employee_name,created,created_by,visibility) VALUES (?,?,?,?,?,'employee',?,?,1,'hr@test','individual')").run(id,kind,kind,start,end,email,name);if(fromRequest)sql.prepare("INSERT INTO staff_time_off_requests (id,user_id,email,employee_name,kind,start_date,end_date,created,status) VALUES (?,'employee',?,?,?,?,?,1,'approved')").run(requestId,email,name,kind,start,end);return {id,requestId}}
const leave=event({fromRequest:true}),sick=event({kind:'sick'}),off=event({kind:'day_off',email:'100_percent@test',name:'100%_staff'});
for(const a of [null,editor,admin,{...hr,isApproved:false}]){actor=a;await json(await api.GET(req('/api/admin/absences?period=all')),403);await json(await api.PATCH(req('/api/admin/absences',{method:'PATCH',body:{id:leave.id,action:'cancel'}})),403);await json(await api.DELETE(req('/api/admin/absences',{method:'DELETE',body:{id:leave.id,confirm:'DELETE'}})),403);await json(await docs.POST(req('/api/admin/absences/documents?absenceId='+sick.id,{method:'POST',raw:'%PDF-1.7'})),403);assert.equal((await docs.GET(req('/api/admin/absences/documents?id='+crypto.randomUUID()))).status,403)}
for(const a of [hr,owner,developer]){actor=a;const d=await json(await api.GET(req('/api/admin/absences?period=all')));assert.equal(d.items.length,3)}
actor=hr;await json(await api.PATCH(req('/api/admin/absences',{method:'PATCH',origin:'https://attacker.test',body:{id:leave.id,action:'cancel'}})),403);await json(await docs.POST(req('/api/admin/absences/documents?absenceId='+sick.id,{method:'POST',origin:'https://attacker.test',raw:'%PDF-1.7'})),403);
await json(await api.GET(req('/api/admin/absences?period=invalid')),400);await json(await api.GET(req('/api/admin/absences?offset=-1')),400);let data=await json(await api.GET(req('/api/admin/absences?period=all&q='+encodeURIComponent('%_'))));assert.equal(data.items.length,1);assert.equal(data.items[0].id,off.id);
console.log('PASS roles/approval, forged-origin rejection, query validation and escaped search.');
function notice(id){sql.prepare("INSERT INTO work_notifications (id,user_id,category,title,body,target,target_id,created) VALUES (?,'employee','leave','private','private','calendar','2026-11-02',1)").run(id);sql.prepare('INSERT INTO work_notification_deliveries (notification_id,token) VALUES (?,?)').run(id,'token')}
notice('time-off-result:'+leave.requestId+':employee');notice('time-off-request:'+leave.requestId+':hr');
await json(await api.PATCH(req('/api/admin/absences',{method:'PATCH',body:{id:leave.id,action:'cancel',reason:'Plans changed'}})));
assert.equal(sql.prepare('SELECT COUNT(*) n FROM staff_calendar_events WHERE id=?').get(leave.id).n,0);assert.equal(sql.prepare('SELECT reason FROM staff_absence_archives WHERE id=?').get(leave.id).reason,'Plans changed');assert.equal(sql.prepare('SELECT status FROM staff_time_off_requests WHERE id=?').get(leave.requestId).status,'cancelled');assert.equal(sql.prepare('SELECT COUNT(*) n FROM work_notification_deliveries').get().n,0);
const balance=domain.calculateBalances('employee@test',2026,sql.prepare('SELECT * FROM staff_calendar_events').all(),[],null,5,'2026-11-01');assert.equal(balance.leave.reserved,0);assert.equal(balance.sick.reserved,3);
await json(await api.PATCH(req('/api/admin/absences',{method:'PATCH',body:{id:leave.id,action:'cancel'}})),409);data=await json(await api.GET(req('/api/admin/absences?period=cancelled')));assert.equal(data.items.length,1);assert.equal(data.items[0].id,leave.id);
await json(await api.PATCH(req('/api/admin/absences',{method:'PATCH',body:{id:off.id,action:'cancel'}})));assert.equal(sql.prepare('SELECT COUNT(*) n FROM staff_absence_archives').get().n,2);
console.log('PASS direct and approved-request cancellation preserves history, frees balances/calendar and clears stale pushes.');
await json(await docs.POST(req('/api/admin/absences/documents?absenceId='+leave.id,{method:'POST',raw:'%PDF-1.7'})),400);
await json(await docs.POST(req('/api/admin/absences/documents?absenceId='+sick.id,{method:'POST',raw:'<html>unsafe</html>'})),400);
await json(await docs.POST(req('/api/admin/absences/documents?absenceId='+sick.id,{method:'POST',raw:new Uint8Array(5*1024*1024+1)})),413);
const file=(await json(await docs.POST(req('/api/admin/absences/documents?absenceId='+sick.id+'&name=note.pdf',{method:'POST',raw:'%PDF-1.7 test bytes'})),201)).id;
assert.equal(objects.size,1);const downloaded=await docs.GET(req('/api/admin/absences/documents?id='+file));assert.equal(downloaded.status,200);assert.match(downloaded.headers.get('Content-Disposition'),/^attachment/);assert.equal(downloaded.headers.get('Cache-Control'),'private, no-store');assert.match(await downloaded.text(),/%PDF/);actor=editor;assert.equal((await docs.GET(req('/api/admin/absences/documents?id='+file))).status,403);actor=hr;
await json(await api.PATCH(req('/api/admin/absences',{method:'PATCH',body:{id:sick.id,action:'cancel'}})));assert.equal((await docs.GET(req('/api/admin/absences/documents?id='+file))).status,200);
const later=(await json(await docs.POST(req('/api/admin/absences/documents?absenceId='+sick.id,{method:'POST',raw:'%PDF-1.7 later'})),201)).id;
for(let i=0;i<8;i++)await json(await docs.POST(req('/api/admin/absences/documents?absenceId='+sick.id,{method:'POST',raw:'%PDF-1.7 other'})),201);
await json(await docs.POST(req('/api/admin/absences/documents?absenceId='+sick.id,{method:'POST',raw:'%PDF-1.7 over limit'})),409);assert.equal(objects.size,10);
console.log('PASS optional private sick documents: magic/size validation, restricted downloads, later upload and per-record cap.');
notice('absence-cancelled:'+sick.id+':employee');notice('calendar-created:'+sick.id+':employee');
await json(await api.DELETE(req('/api/admin/absences',{method:'DELETE',body:{id:sick.id}})),400);
await json(await api.DELETE(req('/api/admin/absences',{method:'DELETE',body:{id:sick.id,confirm:'DELETE'}})));
assert.equal(sql.prepare('SELECT COUNT(*) n FROM staff_absence_documents WHERE absence_id=?').get(sick.id).n,0);assert.equal(objects.size,0);assert.equal((await docs.GET(req('/api/admin/absences/documents?id='+file))).status,404);assert.equal((await docs.GET(req('/api/admin/absences/documents?id='+later))).status,404);assert.equal(sql.prepare('SELECT COUNT(*) n FROM work_notifications').get().n,0);assert.equal(sql.prepare('SELECT COUNT(*) n FROM work_notification_deliveries').get().n,0);
await json(await api.DELETE(req('/api/admin/absences',{method:'DELETE',body:{id:leave.id,confirm:'DELETE'}})));assert.equal(sql.prepare('SELECT COUNT(*) n FROM staff_time_off_requests WHERE id=?').get(leave.requestId).n,0);assert.equal(sql.prepare('SELECT COUNT(*) n FROM staff_absence_archives WHERE id=?').get(leave.id).n,0);
await json(await api.DELETE(req('/api/admin/absences',{method:'DELETE',body:{id:leave.id,confirm:'DELETE'}})),404);
assert.ok(sql.prepare('SELECT COUNT(*) n FROM workspace_audit').get().n>=5);
console.log('PASS permanent removal requires explicit confirmation, removes docs/request/history/notices/queued pushes, and keeps minimal audit.');
// Deleting an account must also remove its private medical evidence and archive identity.
const privateSick=event({kind:'sick'});await json(await docs.POST(req('/api/admin/absences/documents?absenceId='+privateSick.id,{method:'POST',raw:'%PDF-1.7 private'})),201);await json(await api.PATCH(req('/api/admin/absences',{method:'PATCH',body:{id:privateSick.id,action:'cancel'}})));
await load('app/api/admin/access/account-deletion.ts').deleteAccountData(DB,BUCKET,{user_id:'employee',email:'employee@test',avatar_key:null},'owner@test');
assert.equal(objects.size,0);assert.equal(sql.prepare("SELECT COUNT(*) n FROM staff_absence_archives WHERE employee_user_id='employee'").get().n,0);assert.equal(sql.prepare('SELECT COUNT(*) n FROM staff_absence_documents').get().n,0);
console.log('PASS account deletion removes private medical evidence and cancelled-absence identity.');
