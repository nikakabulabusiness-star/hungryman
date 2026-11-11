import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';

const modules=new Map();
class WorkError extends Error{constructor(status,message){super(message);this.status=status}}
let denied=false,shootPermission=true,queries=[],gets=[],detail,shoot,history=[],snapshots=[],stored=[],objects=new Map(),metadataBytes=0;
const actor={userId:'reader',role:'Video Editor',isApproved:true};
const DB={prepare(sql){return {bind(...args){const eligible=rows=>rows.filter(row=>row.video_id===args[0]&&row.version<=args[1]&&row.created<=args[2]);return {
 async first(){queries.push({sql,args});const rows=sql.includes('work_video_history')?eligible(history):eligible(snapshots);return {n:rows.length,bytes:metadataBytes||rows.reduce((sum,row)=>sum+String(row.data_json||row.comment||'').length+256,0)}},
 async all(){queries.push({sql,args});if(sql.includes('FROM work_files'))return {results:stored.filter(row=>args.includes(row.id))};if(sql.includes('FROM work_video_history'))return {results:eligible(history)};if(sql.includes('FROM work_video_snapshots'))return {results:eligible(snapshots)};throw Error('Unexpected SQL '+sql)},
}}}}};
const BUCKET={async get(key){gets.push(key);const bytes=objects.get(key);return bytes?{size:bytes.length,body:{async cancel(){}},arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}:null}};
function load(file){
 if(modules.has(file))return modules.get(file);const exports={};modules.set(file,exports);
 const require=name=>{
  if(name==='@/lib/work-policy')return {WorkError,getWorkContext:async()=>{if(denied)throw new WorkError(403,'denied');return {actor}},workRouteError:error=>Response.json({error:error instanceof WorkError?error.message:'unavailable'},{status:error instanceof WorkError?error.status:503,headers:{'Cache-Control':'private, no-store'}})};
  if(name==='@/lib/work-store')return {getWorkVideoDetail:async()=>{queries.push({detail:true});return structuredClone(detail)}};
  if(name==='@/lib/shoots')return {getShoot:async()=>structuredClone(shoot)};
  if(name==='@/lib/permissions')return {hasPermission:()=>shootPermission};
  if(name==='@/lib/storage')return {storage:()=>({DB,BUCKET})};
  if(name.startsWith('@/')||name.startsWith('.')){const target=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);return load(target.endsWith('.ts')?target:target+'.ts')}
  throw Error('Unexpected import '+name);
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,Response,Request,URL,Headers,Date,Intl,TextEncoder,TextDecoder,Uint8Array,Uint32Array,DataView,ArrayBuffer,console});return exports;
}
const model=load('mobile/src/lib/work-model.ts'),{buildWorkZip,WorkZipLimitError}=load('lib/work-zip.ts');
const encoded=value=>new TextEncoder().encode(value),directory=fs.mkdtempSync(path.join(os.tmpdir(),'hm-work-archive-'));
function unzip(bytes,name='archive.zip'){
 const target=path.join(directory,name);fs.writeFileSync(target,bytes);
 return JSON.parse(execFileSync('python3',['-c',"import zipfile,json,sys,base64\nwith zipfile.ZipFile(sys.argv[1]) as z:\n assert z.testzip() is None\n print(json.dumps({n:base64.b64encode(z.read(n)).decode() for n in z.namelist()}))",target],{encoding:'utf8'}));
}
const zip=buildWorkZip([{name:'ქართული.txt',data:encoded('სრული ტექსტი')},{name:'files/image.png',data:new Uint8Array([0,1,2,255])}],{date:new Date('2026-10-26T12:00:00Z')});
const parsedZip=unzip(zip,'zip-format.zip');assert.equal(Buffer.from(parsedZip['ქართული.txt'],'base64').toString(),'სრული ტექსტი');assert.deepEqual([...Buffer.from(parsedZip['files/image.png'],'base64')],[0,1,2,255]);
assert.throws(()=>buildWorkZip([{name:'../escape',data:encoded('no')}]),/Unsafe/);
assert.throws(()=>buildWorkZip([{name:'a',data:encoded('1')},{name:'a',data:encoded('2')}]),/Duplicate/);
assert.throws(()=>buildWorkZip([{name:'a',data:new Uint8Array(100)}],{maxBytes:20}),error=>error instanceof WorkZipLimitError);

const id='11111111-1111-4111-8111-111111111111',shootId='22222222-2222-4222-8222-222222222222';
const frozenPhoto='33333333-3333-4333-8333-333333333333',oldPhoto='44444444-4444-4444-8444-444444444444',draftPhoto='55555555-5555-4555-8555-555555555555';
const base={title:'დამტკიცებული ქოლშითი',kind:'video',content:{...model.emptyWorkContent(),script:'დამტკიცებული სცენარი <script>alert(1)</script>',coverId:frozenPhoto},callSheet:{...model.emptyCallSheet(),producer:'პროდიუსერი',days:[{id:'d1',date:'2026-10-28',callTime:'08:00',cameraTime:'09:00',endTime:'18:00',goal:'პირველი დღე',locationId:'',notes:''}],budget:[{id:'b1',category:'ხარჯი',type:'service',label:'=formula',quantity:1,unitPrice:1200}]},technical:model.emptyTechnical(),approvedTechnical:null,totals:{currency:'GEL',base:1200,technicalApproved:0,technicalPending:0,grandTotal:1200,categories:[{name:'ხარჯი',total:1200}]}};
const current={...structuredClone(base),title:'UNSENT DRAFT',content:{...base.content,coverId:draftPhoto,script:'UNSENT SECRET SCRIPT'},id,entryBoard:'story',stages:{story:'approved',production:'planning',editing:null,social:null,technical:null},version:9,createdBy:'author',created:100,updated:900,permissions:{editBoards:['production'],approve:false,remove:false},shoots:[{id:shootId,dayId:'d1',date:'2026-10-28',status:'planned'}],reviewNotes:{production:'UNSENT REVIEW NOTE'}};
detail={video:current,history:[],snapshots:[],meta:{people:[{email:'unrelated-private@example.test'}]}};
shoot={id:shootId,work_video_id:id,work_day_id:'d1',shoot_date:'2026-10-28',status:'planned',updated:800,work_snapshot:JSON.stringify({...base,videoId:id,version:8})};
history=[{id:'h8',video_id:id,board:'production',action:'approve',from_stage:'review',to_stage:'scheduled',comment:'დამტკიცდა',actor_name:'დამფუძნებელი',version:8,created:800},{id:'h9',video_id:id,board:'production',action:'save',from_stage:'scheduled',to_stage:'planning',comment:'UNSENT HISTORY',actor_name:'editor',version:9,created:900}];
snapshots=[{id:'s7',video_id:id,board:'story',version:7,created:700,actor_name:'დამფუძნებელი',data_json:JSON.stringify({...base,content:{...base.content,coverId:oldPhoto}})},{id:'s8',video_id:id,board:'production',version:8,created:800,actor_name:'დამფუძნებელი',data_json:JSON.stringify(base)}];
stored=[frozenPhoto,oldPhoto,draftPhoto].map((file,index)=>({id:file,object_key:'private-key-'+index,mime:'image/png',bytes:4}));
for(const row of stored)objects.set(row.object_key,new Uint8Array([137,80,78,71]));
const {GET}=load('app/api/work/videos/[id]/export/route.ts');
const get=(query='')=>GET(new Request('https://work.example/api/work/videos/'+id+'/export?'+query),{params:Promise.resolve({id})});
denied=true;let response=await get('format=zip');assert.equal(response.status,403);assert.equal(queries.length,0);assert.equal(gets.length,0);denied=false;
shootPermission=false;response=await get('format=html&shoot='+shootId);assert.equal(response.status,403);shootPermission=true;
response=await get('format=json&shoot='+shootId);assert.equal(response.status,200);const frozen=await response.json();
assert.equal(frozen.video.title,base.title);assert.equal(frozen.video.version,8);assert.equal(frozen.video.stages.production,'scheduled');assert.equal(frozen.history.length,1);assert.equal(frozen.snapshots.length,1);assert.equal(frozen.source.revisionHistory.length,2);
const frozenJSON=JSON.stringify(frozen);for(const forbidden of ['UNSENT','unrelated-private@example.test','permissions'])assert.ok(!frozenJSON.includes(forbidden),forbidden+' must not leak into the approved shoot archive');
assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('content-disposition'),/attachment; filename="Hungryman-Work-/);
response=await get('format=html&shoot='+shootId);assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;')&&!html.includes('<script>'));assert.ok(!html.includes('UNSENT'));assert.match(response.headers.get('content-security-policy'),/script-src 'none'/);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'self'/);
response=await get('format=csv&shoot='+shootId);assert.equal(response.status,200);assert.ok((await response.text()).includes('"\'=formula"'));
response=await get('format=zip&shoot='+shootId);assert.equal(response.status,200);const archive=unzip(new Uint8Array(await response.arrayBuffer()));
assert.ok(archive['index.html']&&archive['project.json']&&archive['budget.csv']&&archive['files.json']&&archive['README.txt']);assert.ok(archive['files/'+frozenPhoto+'.png']);assert.ok(!archive['files/'+draftPhoto+'.png']);assert.deepEqual(gets.sort(),['private-key-0']);
assert.ok(Buffer.from(archive['index.html'],'base64').toString().includes('files/'+frozenPhoto+'.png'));assert.equal(JSON.parse(Buffer.from(archive['project.json'],'base64')).snapshots.length,1);
gets=[];response=await get('format=zip');assert.equal(response.status,200);const liveArchive=unzip(new Uint8Array(await response.arrayBuffer()),'live.zip');assert.ok(liveArchive['files/'+oldPhoto+'.png']&&liveArchive['files/'+draftPhoto+'.png']&&liveArchive['files/'+frozenPhoto+'.png'],'Live Work archive retains all historical approval images');
const oldFrozen=shoot.work_snapshot;shoot.work_snapshot=JSON.stringify({...base,videoId:id,version:10,productionVersion:8,approvedAt:800,approvedBy:'founder',technicalApprovedAt:1000,technicalApprovedBy:'tech-founder'});shoot.updated=1000;
snapshots.push({id:'s10',video_id:id,board:'technical',version:10,created:1000,actor_name:'founder',data_json:JSON.stringify({...base,callSheet:{...base.callSheet,notes:'UNAPPROVED CROSS-BOARD DRAFT'}})});
response=await get('format=json&shoot='+shootId);assert.equal(response.status,200);const technicalFrozen=await response.json();assert.ok(!JSON.stringify(technicalFrozen).includes('UNAPPROVED CROSS-BOARD DRAFT'));assert.equal(technicalFrozen.source.productionApproval.version,8);assert.equal(technicalFrozen.source.technicalApproval.by,'tech-founder');assert.equal(technicalFrozen.source.revisionHistory.length,3);snapshots.pop();shoot.work_snapshot=oldFrozen;shoot.updated=800;
shoot.status='completed';response=await get('format=json&shoot='+shootId);assert.equal((await response.json()).video.stages.production,'filmed');shoot.status='planned';
shoot.work_snapshot=JSON.stringify({...base,kind:'short',videoId:id,version:8,approvedAt:700,completedAt:800,completedBy:'producer'});response=await get('format=json&shoot='+shootId);const completedShort=await response.json();assert.equal(completedShort.video.stages.social,'done');assert.equal(completedShort.source.completion.by,'producer');shoot.work_snapshot=oldFrozen;
const approvedSnapshot=shoot.work_snapshot;shoot.work_snapshot=null;response=await get('format=json&shoot='+shootId);assert.equal(response.status,409);assert.ok(!(await response.text()).includes('UNSENT'));shoot.work_snapshot=approvedSnapshot;
shoot.work_video_id='different-project';response=await get('format=zip&shoot='+shootId);assert.equal(response.status,404);shoot.work_video_id=id;
metadataBytes=9*1024*1024;response=await get('format=zip');assert.equal(response.status,413);metadataBytes=0;
stored[0].bytes=30*1024*1024;gets=[];response=await get('format=zip&shoot='+shootId);assert.equal(response.status,413);assert.equal(gets.length,0,'Oversized archives must fail before reading object bodies');stored[0].bytes=4;
objects.delete('private-key-0');response=await get('format=zip&shoot='+shootId);assert.equal(response.status,409,'Missing frozen image must fail instead of creating a partial archive');
response=await get('format=json');assert.equal(response.status,200);assert.equal((await response.json()).video.title,'UNSENT DRAFT','Live Work export may include its saved current revision');
console.log('PASS Work archive: real ZIP/CRC/Unicode paths, traversal/size limits, denial before private reads, frozen revision isolation, full history, safe HTML/CSV, authorized archived photos, explicit incomplete/oversized failures.');
