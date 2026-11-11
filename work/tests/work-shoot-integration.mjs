import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

// Exercise the real route, validation, reads and generated SQL on an isolated DB.
const sql=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
let beforeBatch=null,lastChanges=[],batchCount=0;
function statement(query,args=[]){return {
 bind(...next){return statement(query,next)},
 first:async()=>sql.prepare(query).get(...args)||null,
 all:async()=>({results:sql.prepare(query).all(...args)}),
 async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}},
}}
const DB={prepare:statement,batch:async statements=>{
 const importWork=beforeBatch;beforeBatch=null;importWork?.();batchCount++;
 sql.exec('BEGIN');try{const results=[];for(const item of statements)results.push(await item.run());sql.exec('COMMIT');lastChanges=results.map(result=>result.meta.changes);return results}catch(error){sql.exec('ROLLBACK');throw error}
}};
const directory=[{userId:'editor',email:'editor@example.test',fullName:'Editor',role:'Video Editor'}];
let actor;
const modules=new Map();
function load(file){
 if(modules.has(file))return modules.get(file);
 const exports={};modules.set(file,exports);
 function require(name){
  if(name==='@/lib/storage'||name==='./storage')return {storage:()=>({DB})};
  if(name==='@/lib/staff-access')return {getStaffAccess:async()=>actor,listApprovedStaff:async()=>directory};
  if(name==='@/lib/visitor')return {sameOrigin:req=>req.headers.get('Origin')===new URL(req.url).origin};
  if(name==='@/lib/calendar-payday')return {salaryEvents:async()=>[]};
  if(name==='@/lib/birthdays')return {birthdayEvents:()=>[]};
  const base=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);
  if(name.startsWith('@/')||name.startsWith('.'))return load(base.endsWith('.ts')?base:base+'.ts');
  throw Error('Unexpected module '+name);
 }
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,crypto,Date,Intl,URL,Request,Response,Headers,console});return exports;
}
const permissions=load('lib/permissions.ts'),route=load('app/api/shoots/[id]/route.ts'),calendar=load('app/api/calendar/route.ts');
actor={userId:'producer',email:'producer@example.test',fullName:'Producer',role:'პროდიუსერი',isApproved:true,canEditShoots:true,canCreateShoots:true,canManageCalendar:false,permissions:[...permissions.permissionKeys]};
const now=Date.now(),newPhoto='11111111-1111-4111-8111-111111111111';
sql.prepare('INSERT INTO shoot_photos (id,user_id,object_key,mime,created) VALUES (?,?,?,?,?)').run(newPhoto,actor.userId,'shoot-photos/test','image/jpeg',now);
const archive={videoId:'approved-video',title:'Approved call sheet',version:7,callsheet:{days:[{id:'day-1',date:'2026-10-30'}],budget:[{label:'Rental',amount:50000}]}};
function seed(id,{linked=false,kind='video',status='planned'}={}){
 sql.prepare('INSERT INTO shoots (id,title,shoot_date,start_time,end_time,location_name,location_url,latitude,longitude,photo_id,details,status,created,updated,created_by,updated_by,work_video_id,work_day_id,content_kind,work_snapshot) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'Original '+id,'2026-10-30','09:00','18:00','Original location',null,41.7,44.8,null,'Original details',status,now,now,actor.email,actor.email,linked?'approved-video':null,linked?'day-'+id:null,kind,linked?JSON.stringify(archive):null);
 sql.prepare('INSERT INTO shoot_tasks (id,shoot_id,assignee_email,assignee_name,assignee_role,task,status,created) VALUES (?,?,?,?,?,?,?,?)').run('task-'+id,id,'editor@example.test','Editor','Video Editor','Approved assignment','done',now);
 sql.prepare('INSERT INTO staff_chat_messages (id,author_user_id,author_email,author_name,author_role,body,kind,reference_id,conversation_id,created) VALUES (?,?,?,?,?,?,?,?,?,?)').run('notice-'+id,actor.userId,actor.email,'Producer',actor.role,'Original shoot notice','shoot',id,'team',now);
}
function snapshot(id){return {
 shoot:sql.prepare('SELECT * FROM shoots WHERE id=?').get(id),
 tasks:sql.prepare('SELECT * FROM shoot_tasks WHERE shoot_id=? ORDER BY id').all(id),
 messages:sql.prepare('SELECT * FROM staff_chat_messages WHERE reference_id=? ORDER BY id').all(id),
}}
const payload={title:'Legacy overwrite',shootDate:'2026-10-31',startTime:'10:00',endTime:'17:00',locationName:'Legacy location',locationUrl:'https://maps.example.test/place',latitude:42.1,longitude:45.2,photoId:newPhoto,details:'Legacy details',status:'completed',assignments:[{assigneeEmail:'editor@example.test',task:'Legacy replacement'}]};
const params=id=>({params:Promise.resolve({id})});
const request=(id,method,body=method==='PATCH'?payload:undefined)=>new Request('https://test.example/api/shoots/'+id,{method,headers:{Origin:'https://test.example','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});

// Already-approved Work shoots cannot be mutated by legacy edit/delete controls.
seed('linked',{linked:true});const linked=snapshot('linked'),batchesBefore=batchCount;
assert.equal((await route.PATCH(request('linked','PATCH'),params('linked'))).status,409);
assert.equal((await route.DELETE(request('linked','DELETE'),params('linked'))).status,409);
assert.deepEqual(snapshot('linked'),linked,'A rejected legacy action preserves the full approved snapshot, assignments and chat notice');
assert.equal(batchCount,batchesBefore,'Known Work linkage is rejected before any mutation batch');
const linkedRead=await route.GET(request('linked','GET'),params('linked'));
assert.equal(linkedRead.status,200);assert.equal((await linkedRead.json()).shoot.work_snapshot,JSON.stringify(archive));

// Manual shoots still support the existing editor, task replacement and deletion.
seed('manual');
const edited=await route.PATCH(request('manual','PATCH'),params('manual'));assert.equal(edited.status,200);
const manual=snapshot('manual');
assert.equal(manual.shoot.title,payload.title);assert.equal(manual.shoot.latitude,payload.latitude);assert.equal(manual.shoot.longitude,payload.longitude);assert.equal(manual.shoot.photo_id,newPhoto);
assert.equal(manual.shoot.work_video_id,null);assert.equal(manual.shoot.work_snapshot,null);
assert.equal(manual.tasks.length,1);assert.equal(manual.tasks[0].task,'Legacy replacement');assert.equal(manual.tasks[0].status,'todo');assert.notEqual(manual.tasks[0].id,'task-manual');
assert.match(manual.messages[0].body,/Legacy overwrite/);
assert.equal((await route.DELETE(request('manual','DELETE'),params('manual'))).status,200);
assert.deepEqual(snapshot('manual'),{shoot:undefined,tasks:[],messages:[]});

// Simulate a separate Work import committed after getShoot, before the legacy
// transaction acquires its write lock. Every dependent statement must no-op.
for(const method of ['PATCH','DELETE']){
 const id='race-'+method.toLowerCase();seed(id);let imported;
 beforeBatch=()=>{
  sql.prepare('UPDATE shoots SET title=?,work_video_id=?,work_day_id=?,work_snapshot=?,latitude=?,longitude=?,photo_id=?,updated=updated+1 WHERE id=?').run('Fresh approved import','approved-video','day-'+id,JSON.stringify({...archive,title:'Fresh approved import'}),40.5,43.5,null,id);
  sql.prepare('UPDATE shoot_tasks SET task=?,status=? WHERE shoot_id=?').run('Fresh approved assignment','done',id);
  sql.prepare('UPDATE staff_chat_messages SET body=? WHERE reference_id=?').run('Fresh approved notice',id);
  imported=snapshot(id);
 };
 const response=await route[method](request(id,method),params(id));
 assert.equal(response.status,409,method+' detects the Work import race');
 assert.ok(lastChanges.length>0);assert.ok(lastChanges.every(changes=>changes===0),method+' guards every legacy child/parent write');
 assert.deepEqual(snapshot(id),imported,method+' retains the imported archive, tasks, notice, photo and map coordinates');
}

// Shared calendar distinguishes Shorts and points into the correct shoot filter.
seed('calendar-short',{linked:true,kind:'short'});seed('calendar-video');seed('calendar-cancelled',{linked:true,kind:'short',status:'cancelled'});
const calendarResponse=await calendar.GET(new Request('https://test.example/api/calendar?from=2026-10-01&to=2026-10-31'));
assert.equal(calendarResponse.status,200);
const events=(await calendarResponse.json()).events,short=events.find(event=>event.id==='calendar-short'),video=events.find(event=>event.id==='calendar-video');
assert.equal(short.kind,'shorts');assert.equal(short.href,'/shoots?kind=short#shoot-calendar-short');assert.equal(short.start_date,'2026-10-30');assert.equal(short.start_time,'09:00');
assert.equal(video.kind,'shoot');assert.equal(video.href,'/shoots#shoot-calendar-video');assert.equal(events.some(event=>event.id==='calendar-cancelled'),false);
assert.deepEqual(snapshot('linked'),linked,'Calendar reads do not mutate the approved archive');
console.log('PASS Work shoot integration: linked legacy guards, atomic import-race no-ops, manual edits/deletion, archive preservation and Shorts calendar deep links.');
