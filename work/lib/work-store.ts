import {storage} from '@/lib/storage';
import {noticeStatements,dispatchNotices,type NoticeInput} from '@/lib/notifications';
import {getShoot} from '@/lib/shoots';
import {hasPermission} from '@/lib/permissions';
import {publicRole} from '@/lib/site-controls';
import {workBoards,emptyWorkContent,emptyCallSheet,emptyTechnical,type WorkBoard,type WorkVideo,type WorkVideoCreate,type WorkVideoMutation,type WorkMeta,type WorkVideoDetail,type WorkHistory,type WorkSnapshot,type WorkContent,type WorkCallSheet,type WorkTechnical} from '@/mobile/src/lib/work-model';
import {getWorkContext,assertWorkEditor,WorkError,type WorkContext} from './work-policy';
import {cleanWorkContent,cleanWorkCallSheet,cleanWorkTechnical,cleanWorkTitle,cleanWorkComment,workBudgetTotals,workFileIds,assertWorkSchedule} from './work-validation';

type Row={id:string;title:string;kind:'video'|'short';entry_board:WorkBoard;stages_json:string;content_json:string;callsheet_json:string;technical_json:string;approved_technical_json:string|null;review_notes_json:string;version:number;created_by:string;created:number;updated:number;updated_by:string;mutation_id:string};
const json=JSON.stringify;
function parse<T>(value:string):T{return JSON.parse(value) as T}
export function validWorkBoard(value:unknown):value is WorkBoard{return workBoards.some(b=>b.id===value)}
function needBoard(value:unknown):WorkBoard{if(!validWorkBoard(value))throw new WorkError(400,'სამუშაო დაფა არასწორია.');return value}
function recordVideo(row:Row,context:WorkContext,shoots:WorkVideo['shoots']=[]):WorkVideo{
 const content=parse<WorkContent>(row.content_json),callSheet=parse<WorkCallSheet>(row.callsheet_json),technical=parse<WorkTechnical>(row.technical_json),approvedTechnical=row.approved_technical_json?parse<WorkTechnical>(row.approved_technical_json):null;
 return {id:row.id,title:row.title,kind:row.kind,entryBoard:row.entry_board,stages:parse(row.stages_json),content,callSheet,technical,approvedTechnical,totals:workBudgetTotals(callSheet,technical,approvedTechnical),version:row.version,createdBy:row.created_by,created:row.created,updated:row.updated,permissions:{editBoards:context.editBoards,approve:context.canApprove,remove:context.actor.isDeveloper||context.actor.role==='Owner'},shoots,reviewNotes:parse(row.review_notes_json)};
}
export async function workMeta(context:WorkContext):Promise<WorkMeta>{
 const rows=hasPermission(context.actor,'shoots.view')?(await storage().DB.prepare("SELECT id,title,shoot_date,start_time,location_name FROM shoots WHERE status='planned' AND work_video_id IS NULL ORDER BY shoot_date,start_time LIMIT 100").all<{id:string;title:string;shoot_date:string;start_time:string;location_name:string}>()).results:[];
 return {canAssignEditor:context.actor.isDeveloper||context.actor.role==='Senior Editor',boards:workBoards,editBoards:context.editBoards,canApprove:context.canApprove,canContacts:context.canContacts,people:context.people.map(p=>({...p,role:publicRole(p.role)})),assignable:context.assignable.map(p=>({...p,role:publicRole(p.role)})),unlinkedShoots:rows.map(r=>({id:r.id,title:r.title,date:r.shoot_date,startTime:r.start_time,locationName:r.location_name}))};
}
export async function getWorkVideo(id:string,context:WorkContext):Promise<WorkVideo>{
 const db=storage().DB,[row,shots]=await Promise.all([db.prepare('SELECT * FROM work_videos WHERE id=?').bind(id).first<Row>(),db.prepare('SELECT id,work_day_id,shoot_date,status FROM shoots WHERE work_video_id=? ORDER BY shoot_date,start_time').bind(id).all<{id:string;work_day_id:string;shoot_date:string;status:string}>()]);
 if(!row)throw new WorkError(404,'ვიდეო ვერ მოიძებნა.');return recordVideo(row,context,shots.results.map(s=>({id:s.id,dayId:s.work_day_id,date:s.shoot_date,status:s.status})));
}
export async function getWorkVideoDetail(id:string,context:WorkContext):Promise<WorkVideoDetail>{
 const db=storage().DB,[video,history,snapshots,meta]=await Promise.all([getWorkVideo(id,context),db.prepare('SELECT id,board,action,from_stage,to_stage,comment,actor_name,created,version FROM work_video_history WHERE video_id=? ORDER BY created DESC,id DESC LIMIT 200').bind(id).all<{id:string;board:WorkBoard;action:string;from_stage:string|null;to_stage:string|null;comment:string;actor_name:string;created:number;version:number}>(),db.prepare('SELECT id,board,version,created,actor_name,data_json FROM work_video_snapshots WHERE video_id=? ORDER BY created DESC LIMIT 100').bind(id).all<{id:string;board:WorkBoard;version:number;created:number;actor_name:string;data_json:string}>(),workMeta(context)]);
 return {video,meta,history:history.results.map(r=>({id:r.id,board:r.board,action:r.action,fromStage:r.from_stage,toStage:r.to_stage,comment:r.comment,actorName:r.actor_name,created:r.created,version:r.version})),snapshots:snapshots.results.map(r=>({id:r.id,board:r.board,version:r.version,created:r.created,actorName:r.actor_name,data:parse(r.data_json)}))};
}
type WorkListOptions={cursor?:string|null;review?:boolean};
const WORK_PAGE_SIZE=60;
export async function listWorkVideos(context:WorkContext,board?:WorkBoard,options:WorkListOptions={}){
 const review=options.review===true,where:string[]=[],params:(string|number)[]=[];
 if(board){where.push('json_extract(stages_json,?) '+(review?"= 'review'":'IS NOT NULL'));params.push('$.'+board)}
 else if(review)where.push("EXISTS(SELECT 1 FROM json_each(stages_json) WHERE value='review')");
 if(options.cursor){
  let cursor:unknown;try{if(options.cursor.length>500)throw 0;cursor=JSON.parse(atob(options.cursor.replaceAll('-','+').replaceAll('_','/')))}catch{throw new WorkError(400,'გვერდის მაჩვენებელი არასწორია.')}
  if(!Array.isArray(cursor)||cursor.length!==4||!Number.isSafeInteger(cursor[0])||cursor[0]<0||typeof cursor[1]!=='string'||!/^[a-f\d-]{36}$/i.test(cursor[1])||cursor[2]!==(board||'')||cursor[3]!==review)throw new WorkError(400,'გვერდის მაჩვენებელი ამ ფილტრს არ ეკუთვნის.');
  where.push('(updated<? OR (updated=? AND id<?))');params.push(cursor[0],cursor[0],cursor[1]);
 }
 const fetched=(await storage().DB.prepare('SELECT * FROM work_videos'+(where.length?' WHERE '+where.join(' AND '):'')+' ORDER BY updated DESC,id DESC LIMIT '+(WORK_PAGE_SIZE+1)).bind(...params).all<Row>()).results,rows=fetched.slice(0,WORK_PAGE_SIZE),last=rows.at(-1);
 const nextCursor=fetched.length>WORK_PAGE_SIZE&&last?btoa(JSON.stringify([last.updated,last.id,board||'',review])).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''):null;
 const shots:{id:string;work_video_id:string;work_day_id:string;shoot_date:string;status:string}[]=[];for(let offset=0;offset<rows.length;offset+=80){const ids=rows.slice(offset,offset+80).map(r=>r.id);shots.push(...(await storage().DB.prepare('SELECT id,work_video_id,work_day_id,shoot_date,status FROM shoots WHERE work_video_id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all<typeof shots[number]>()).results)}
 return {videos:rows.map(row=>recordVideo(row,context,shots.filter(s=>s.work_video_id===row.id).map(s=>({id:s.id,dayId:s.work_day_id,date:s.shoot_date,status:s.status})))),meta:await workMeta(context),nextCursor};
}
async function assertFiles(owner:string,ids:string[],previous:string[]=[]){const fresh=ids.filter(id=>!previous.includes(id));if(!fresh.length)return;const rows=(await storage().DB.prepare('SELECT id FROM work_files WHERE user_id=? AND id IN ('+fresh.map(()=>'?').join(',')+')').bind(owner,...fresh).all<{id:string}>()).results;if(rows.length!==fresh.length)throw new WorkError(400,'ატვირთული ფოტო ვერ მოიძებნა ან შენ არ გეკუთვნის.')}
function snapshot(video:WorkVideo){return {title:video.title,kind:video.kind,content:video.content,callSheet:video.callSheet,technical:video.technical,approvedTechnical:video.approvedTechnical,totals:video.totals}}
function guardedHistory(context:WorkContext,video:WorkVideo,board:WorkBoard,action:string,from:string|null,to:string|null,comment:string,mutation:string){return storage().DB.prepare('INSERT INTO work_video_history (id,video_id,board,action,from_stage,to_stage,comment,actor_id,actor_name,created,version) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM work_videos WHERE id=? AND mutation_id=?)').bind(crypto.randomUUID(),video.id,board,action,from,to,comment,context.actor.userId,context.actor.fullName,video.updated,video.version,video.id,mutation)}
function guardedNotice(context:WorkContext,video:WorkVideo,mutation:string,userIds:string[],title:string,body:string,key:string,target:'work'|'shoot'='work',targetId=video.id){return noticeStatements(userIds,{key,category:key.endsWith(':review')?'work_review':'work',title,body,target,targetId,important:true,created:video.updated} as NoticeInput,{query:'EXISTS(SELECT 1 FROM work_videos WHERE id=? AND mutation_id=?)',values:[video.id,mutation]})}
export async function createWorkVideo(context:WorkContext,input:WorkVideoCreate):Promise<WorkVideo>{
 if(!input||typeof input!=='object')throw new WorkError(400,'მონაცემები არასწორია.');
 const board=needBoard(input.board);assertWorkEditor(context,board);
 const id=input.id||crypto.randomUUID();if(!/^[a-f\d-]{36}$/i.test(id))throw new WorkError(400,'ვიდეოს ID არასწორია.');
 const db=storage().DB,existing=await db.prepare('SELECT created_by FROM work_videos WHERE id=?').bind(id).first<{created_by:string}>();if(existing){if(existing.created_by!==context.actor.userId)throw new WorkError(409,'ვიდეოს ID უკვე გამოიყენება.');return getWorkVideo(id,context)}
 const title=cleanWorkTitle(input.title),kind=board==='social'?'short':input.kind==='short'?'short':'video',content=cleanWorkContent(input.content||{}),callSheet=emptyCallSheet(),technical=emptyTechnical(),stages:WorkVideo['stages']={story:null,production:null,editing:null,social:null,technical:null},now=Date.now(),mutation=crypto.randomUUID();
 stages[board]=workBoards.find(b=>b.id===board)!.stages[0].id;
 if(board==='production'){stages.story='idea';stages.production='ready'}
 let importedShoot:string|null=null;
 if(board==='technical'){
  if(!input.shootId||!hasPermission(context.actor,'shoots.view'))throw new WorkError(400,'აირჩიე დაგეგმილი გადაღება.');
  const shoot=await getShoot(input.shootId);if(!shoot||shoot.status!=='planned')throw new WorkError(400,'დაგეგმილი გადაღება ვერ მოიძებნა.');
  const link=await db.prepare('SELECT work_video_id FROM shoots WHERE id=?').bind(shoot.id).first<{work_video_id:string|null}>();if(link?.work_video_id)throw new WorkError(409,'ამ გადაღებას უკვე აქვს სამუშაო ბარათი.');
  importedShoot=shoot.id;stages.production='scheduled';
  callSheet.days=[{id:crypto.randomUUID(),date:shoot.shoot_date,callTime:shoot.start_time,cameraTime:shoot.start_time,endTime:shoot.end_time||'',goal:'',locationId:'main',notes:''}];callSheet.locations=[{id:'main',name:shoot.location_name,address:'',mapUrl:shoot.location_url||'',latitude:shoot.latitude,longitude:shoot.longitude,contactName:'',contactPhone:'',parking:'',access:'',photoIds:[]}];content.requirements=shoot.details;
  callSheet.crew=shoot.tasks.flatMap(t=>{const p=context.people.find(p=>p.email===t.assignee_email);return p?[{id:crypto.randomUUID(),userId:p.userId,name:p.name,role:publicRole(p.role),task:t.task,phone:'',email:p.email,callTime:'',dayIds:[]}]:[]});
 }
 await assertFiles(context.actor.userId,workFileIds(content,callSheet,technical));
 const guard=importedShoot?' WHERE EXISTS(SELECT 1 FROM shoots WHERE id=? AND work_video_id IS NULL)':'';
 const statements=[db.prepare('INSERT INTO work_videos (id,title,kind,entry_board,stages_json,content_json,callsheet_json,technical_json,approved_technical_json,review_notes_json,version,created_by,created,updated,updated_by,mutation_id) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?'+guard).bind(id,title,kind,board,json(stages),json(content),json(callSheet),json(technical),null,'{}',1,context.actor.userId,now,now,context.actor.userId,mutation,...(importedShoot?[importedShoot]:[]))];
 const video:WorkVideo={id,title,kind,entryBoard:board,stages,content,callSheet,technical,approvedTechnical:null,totals:workBudgetTotals(callSheet,technical,null),version:1,createdBy:context.actor.userId,created:now,updated:now,permissions:{editBoards:context.editBoards,approve:context.canApprove,remove:context.actor.isDeveloper||context.actor.role==='Owner'},shoots:[],reviewNotes:{}};
 if(importedShoot)statements.push(db.prepare('UPDATE shoots SET work_video_id=?,work_day_id=?,content_kind=?,work_snapshot=? WHERE id=? AND work_video_id IS NULL AND EXISTS(SELECT 1 FROM work_videos WHERE id=? AND mutation_id=?)').bind(id,callSheet.days[0].id,kind,json({...snapshot(video),videoId:id,version:1}),importedShoot,id,mutation));
 statements.push(guardedHistory(context,video,board,'create',null,stages[board],'',mutation));const results=await db.batch(statements);if(!results[0].meta.changes)throw new WorkError(409,'გადაღება უკვე შეიცვალა. განაახლე გვერდი.');return getWorkVideo(id,context);
}
export async function mutateWorkVideo(context:WorkContext,id:string,input:WorkVideoMutation):Promise<WorkVideo>{
 if(!input||typeof input!=='object'||!Number.isInteger(input.version))throw new WorkError(400,'ვიდეოს მიმდინარე ვერსია აუცილებელია.');
 const board=needBoard(input.board),old=await getWorkVideo(id,context);if(old.version!==input.version)throw new WorkError(409,'ვიდეო სხვამ განაახლა. განაახლე მონაცემები და სცადე ხელახლა.');
 if(!['save','move','approve','return'].includes(input.action))throw new WorkError(400,'მოქმედება არასწორია.');
 const current=old.stages[board];if(!current)throw new WorkError(400,'ვიდეო ამ ეტაპზე ამ დაფაზე არ არის.');
 const next:WorkVideo={...old,stages:{...old.stages},reviewNotes:{...old.reviewNotes},content:{...old.content},callSheet:old.callSheet,technical:old.technical,version:old.version+1,updated:Date.now()},comment=cleanWorkComment(input.comment),mutation=crypto.randomUUID();
 if(input.action==='save'){
  assertWorkEditor(context,board);if(current==='review'||board==='story'&&(old.stages.production==='review'||old.stages.social==='review'))throw new WorkError(409,'დადასტურების მოლოდინში ბარათი დაბლოკილია. ჯერ დასაბრუნებელია რედაქტირებისთვის.');
  if(input.title!==undefined){if(board==='technical'&&input.title!==old.title||board==='editing'&&old.entryBoard!=='editing'&&input.title!==old.title)throw new WorkError(403,'სათაური სცენარის ან პროდაქშენის დაფაზე შეცვალე.');next.title=cleanWorkTitle(input.title)}
  if(input.content!==undefined){if(board==='technical')throw new WorkError(403,'ტექნიკური დაფიდან სცენარი არ იცვლება.');const changed=cleanWorkContent(input.content,old.content);if((board==='editing'||board==='production')&&(changed.scriptHtml!==old.content.scriptHtml||changed.script!==old.content.script||changed.idea!==old.content.idea))throw new WorkError(403,'იდეა და სცენარი სცენარის დაფაზე შეცვალე.');next.content=changed}
  if(input.content?.editorId!==undefined&&input.content.editorId!==(old.content.editorId||'')){
   if(board!=='editing'||!(context.actor.isDeveloper||context.actor.role==='Senior Editor'))throw new WorkError(403,'ედითორის დანიშვნის უფლება საჭიროა.');
   const editorId=input.content.editorId;
   if(editorId&&!context.people.some(p=>p.userId===editorId&&['Video Editor','Senior Editor','Shorts Video Editor'].includes(p.role)))throw new WorkError(400,'აირჩიე გუნდის ედითორი.');
   next.content.editorId=editorId;
  }
  if(input.callSheet!==undefined){if(!['story','production','social'].includes(board))throw new WorkError(403,'ქოლშითის შეცვლა ამ დაფიდან დაუშვებელია.');next.callSheet=cleanWorkCallSheet(input.callSheet,context.people)}
  if(input.technical!==undefined){if(board!=='technical')throw new WorkError(403,'ტექნიკური სია ტექნიკურ დაფაზე შეცვალე.');next.technical=cleanWorkTechnical(input.technical)}
  if(board==='story'&&current==='approved'){next.stages.story='script';if(next.stages.production)next.stages.production='planning';next.reviewNotes.story='დამტკიცებული ვერსია შეიცვალა; საჭიროა ხელახალი დასტური.'}
  if(board==='production'&&['scheduled','filmed'].includes(current)){next.stages.production='planning';next.reviewNotes.production='ცვლილება ახალი დასტურის შემდეგ აისახება გადაღებაში.'}
  if(board==='social'&&['scheduled','done'].includes(current)){next.stages.social='planning';next.reviewNotes.social='ცვლილება ახალი დასტურის შემდეგ აისახება გადაღებაში.'}
  if(board==='technical'&&current==='approved'){next.stages.technical='preparing';next.reviewNotes.technical='ცვლილება ახალი დასტურის შემდეგ აისახება გადაღებაში.'}
  await assertFiles(context.actor.userId,workFileIds(next.content,next.callSheet,next.technical),workFileIds(old.content,old.callSheet,old.technical));
 }else if(input.action==='approve'||input.action==='return'){
  if(!context.canApprove)throw new WorkError(403,'დადასტურება მხოლოდ დამფუძნებელს შეუძლია.');if(current!=='review')throw new WorkError(409,'ბარათი დასტურის მოლოდინში არ არის.');
  if(input.action==='return'){if(!comment)throw new WorkError(400,'დაბრუნების მიზეზი მიუთითე.');next.stages[board]=board==='story'?'script':board==='technical'?'preparing':'planning';next.reviewNotes[board]=comment}
  else{next.stages[board]=board==='production'||board==='social'?'scheduled':'approved';delete next.reviewNotes[board];if(board==='story'&&!next.stages.production)next.stages.production='ready';if(board==='technical')next.approvedTechnical=old.technical}
 }else{
  assertWorkEditor(context,board);const stage=String(input.stage||''),sequence=workBoards.find(b=>b.id===board)!.stages.map(s=>s.id),from=sequence.indexOf(current),to=sequence.indexOf(stage);
  if(to<0||Math.abs(to-from)!==1||current==='review'||['approved','scheduled'].includes(stage)||['approved','scheduled'].includes(current)&&to<from)throw new WorkError(400,'ეტაპი შეცვალე თანმიმდევრულად; დამტკიცებას დამფუძნებლის დასტური სჭირდება.');
  next.stages[board]=stage;
  if(board==='production'&&stage==='filmed'&&!next.stages.editing)next.stages.editing='footage';
 }
 const scheduling=(board==='production'||board==='social')&&next.stages[board]==='review'||input.action==='approve'&&(board==='production'||board==='social');
 if(scheduling){if(context.actor.features?.shoots===false)throw new WorkError(403,'გადაღებების მოდული გამორთულია.');if(board==='production'&&next.stages.story!=='approved'&&next.entryBoard!=='technical')throw new WorkError(400,'ჯერ სცენარის დამტკიცებაა საჭირო.');assertWorkSchedule(next.callSheet)}
 if(next.stages.story==='review'&&!next.content.script.trim())throw new WorkError(400,'დასტურამდე სცენარი შეავსე.');
 if(next.stages.technical==='review'&&!next.technical.items.length)throw new WorkError(400,'ტექნიკური სია შეავსე.');
 if(next.stages.technical==='review')for(const item of next.technical.items)if(!item.name||item.source==='rental'&&(!item.vendor||!item.phone||!item.pickupAt||!item.returnAt))throw new WorkError(400,'ქირავნობისთვის შეავსე ტექნიკა, მომწოდებელი, ნომერი და აღება/დაბრუნების დრო.');
 next.totals=workBudgetTotals(next.callSheet,next.technical,next.approvedTechnical);
 const db=storage().DB,guard={query:'EXISTS(SELECT 1 FROM work_videos WHERE id=? AND mutation_id=?)',values:[id,mutation]},statements=[db.prepare('UPDATE work_videos SET title=?,stages_json=?,content_json=?,callsheet_json=?,technical_json=?,approved_technical_json=?,review_notes_json=?,version=?,updated=?,updated_by=?,mutation_id=? WHERE id=? AND version=?').bind(next.title,json(next.stages),json(next.content),json(next.callSheet),json(next.technical),next.approvedTechnical?json(next.approvedTechnical):null,json(next.reviewNotes),next.version,next.updated,context.actor.userId,mutation,id,old.version)];
 statements.push(guardedHistory(context,next,board,input.action,current,next.stages[board],comment,mutation));
 if(input.action==='move'&&(board==='production'&&next.stages.production==='filmed'||board==='social'&&next.stages.social==='done'))statements.push(db.prepare("UPDATE shoots SET status='completed',updated=?,updated_by=?,work_snapshot=json_set(COALESCE(work_snapshot,'{}'),'$.version',?,'$.completedAt',?,'$.completedBy',?) WHERE work_video_id=? AND status='planned' AND "+guard.query).bind(next.updated,context.actor.email,next.version,next.updated,context.actor.fullName,id,...guard.values));
 const eventKey='work:'+id+':'+next.version;
 if(input.action==='approve'){
  let approvedSnapshot=snapshot(next);
  if(board==='technical'){
   const published=await db.prepare("SELECT work_snapshot FROM shoots WHERE work_video_id=? AND work_snapshot IS NOT NULL ORDER BY CASE WHEN status='cancelled' THEN 1 ELSE 0 END,updated DESC LIMIT 1").bind(id).first<{work_snapshot:string}>();
   if(published){const frozen=parse<ReturnType<typeof snapshot>>(published.work_snapshot);approvedSnapshot={...frozen,technical:next.technical,approvedTechnical:next.approvedTechnical,totals:{...frozen.totals,technicalApproved:next.totals.technicalApproved,technicalPending:0,grandTotal:frozen.totals.base+next.totals.technicalApproved}}}
  }
  statements.push(db.prepare('INSERT INTO work_video_snapshots (id,video_id,board,version,created,actor_name,data_json) SELECT ?,?,?,?,?,?,? WHERE '+guard.query).bind(crypto.randomUUID(),id,board,next.version,next.updated,context.actor.fullName,json(approvedSnapshot),...guard.values));
  if(board==='production'||board==='social'){
   next.stages.technical=next.stages.technical||'needed';statements[0]=db.prepare('UPDATE work_videos SET title=?,stages_json=?,content_json=?,callsheet_json=?,technical_json=?,approved_technical_json=?,review_notes_json=?,version=?,updated=?,updated_by=?,mutation_id=? WHERE id=? AND version=?').bind(next.title,json(next.stages),json(next.content),json(next.callSheet),json(next.technical),next.approvedTechnical?json(next.approvedTechnical):null,json(next.reviewNotes),next.version,next.updated,context.actor.userId,mutation,id,old.version);
   const liveSnapshot={...snapshot(next),technical:next.approvedTechnical||emptyTechnical(),totals:{...next.totals,technicalPending:0},videoId:id,version:next.version,productionVersion:next.version,approvedAt:next.updated,approvedBy:context.actor.fullName};
   const dayIds=next.callSheet.days.map(day=>day.id);
   statements.push(db.prepare("UPDATE shoots SET status='cancelled',updated=?,updated_by=? WHERE work_video_id=? AND work_day_id NOT IN ("+dayIds.map(()=>'?').join(',')+') AND '+guard.query).bind(next.updated,context.actor.email,id,...dayIds,...guard.values));
   for(const day of next.callSheet.days){
    const shootId=old.shoots.find(s=>s.dayId===day.id)?.id||crypto.randomUUID(),location=next.callSheet.locations.find(l=>l.id===day.locationId)!,crew=next.callSheet.crew.filter(p=>p.userId&&(!p.dayIds.length||p.dayIds.includes(day.id)));
    statements.push(db.prepare('INSERT OR IGNORE INTO shoots (id,title,shoot_date,start_time,end_time,location_name,location_url,latitude,longitude,photo_id,details,status,created,updated,created_by,updated_by,work_video_id,work_day_id,content_kind,work_snapshot) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE '+guard.query).bind(shootId,next.title,day.date,day.callTime,day.endTime,location.name,location.mapUrl||null,location.latitude,location.longitude,next.content.coverId,next.content.script,'planned',next.updated,next.updated,context.actor.email,context.actor.email,id,day.id,next.kind,json(liveSnapshot),...guard.values));
    statements.push(db.prepare("UPDATE shoots SET title=?,shoot_date=?,start_time=?,end_time=?,location_name=?,location_url=?,latitude=?,longitude=?,photo_id=?,details=?,status='planned',updated=?,updated_by=?,content_kind=?,work_snapshot=? WHERE work_video_id=? AND work_day_id=? AND "+guard.query).bind(next.title,day.date,day.callTime,day.endTime,location.name,location.mapUrl||null,location.latitude,location.longitude,next.content.coverId,next.content.script,next.updated,context.actor.email,next.kind,json(liveSnapshot),id,day.id,...guard.values));
    statements.push(db.prepare('DELETE FROM shoot_tasks WHERE shoot_id=? AND '+guard.query).bind(shootId,...guard.values));
    const assigned=crew.map(person=>({id:crypto.randomUUID(),email:person.email,name:person.name,role:person.role,task:person.task||person.role}));
    statements.push(db.prepare("INSERT INTO shoot_tasks (id,shoot_id,assignee_email,assignee_name,assignee_role,task,status,created) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.email'),json_extract(value,'$.name'),json_extract(value,'$.role'),json_extract(value,'$.task'),'todo',? FROM json_each(?) WHERE "+guard.query).bind(shootId,next.updated,json(assigned),...guard.values));
    statements.push(...guardedNotice(context,next,mutation,context.people.map(p=>p.userId),(next.kind==='short'?'Shorts · ':'გადაღება · ')+next.title,day.date+' · '+day.callTime+' · '+location.name,eventKey+':shoot:'+day.id,'shoot',shootId));
   }
  }else if(board==='technical'){
   const amount=next.totals.technicalApproved;
   statements.push(db.prepare("UPDATE shoots SET work_snapshot=json_set(COALESCE(work_snapshot,'{}'),'$.technical',json(?),'$.approvedTechnical',json(?),'$.totals.technicalApproved',?,'$.totals.technicalPending',0,'$.totals.grandTotal',COALESCE(json_extract(work_snapshot,'$.totals.base'),0)+?,'$.version',?,'$.technicalApprovedAt',?,'$.technicalApprovedBy',?),updated=?,updated_by=? WHERE work_video_id=? AND "+guard.query).bind(json(next.approvedTechnical),json(next.approvedTechnical),amount,amount,next.version,next.updated,context.actor.fullName,next.updated,context.actor.email,id,...guard.values));
  }
  const recipients=board==='story'?context.people.filter(p=>p.role==='პროდიუსერი'||p.memberships.some(m=>m.departmentId==='preproduction'&&m.level===1)).map(p=>p.userId):[old.createdBy,...context.people.filter(p=>p.role==='პროდიუსერი').map(p=>p.userId)];
  statements.push(...guardedNotice(context,next,mutation,recipients,board==='story'?'სცენარი დამტკიცებულია':'სამუშაო გეგმა დამტკიცებულია',next.title,eventKey+':approved'));
 }else if(input.action==='return')statements.push(...guardedNotice(context,next,mutation,[old.createdBy,...context.people.filter(p=>p.memberships.some(m=>m.departmentId===workBoards.find(b=>b.id===board)!.departmentId)).map(p=>p.userId)],'ბარათი დაბრუნდა რედაქტირებისთვის',next.title+' · '+comment,eventKey+':returned'));
 else if(next.stages[board]==='review')statements.push(...guardedNotice(context,next,mutation,context.people.filter(p=>p.role==='Owner').map(p=>p.userId),'საჭიროა დამფუძნებლის დასტური',next.title+' · '+workBoards.find(b=>b.id===board)!.label,eventKey+':review'));
 const results=await db.batch(statements);if(!results[0].meta.changes)throw new WorkError(409,'ვიდეო სხვამ განაახლა. განაახლე მონაცემები.');dispatchNotices();return getWorkVideo(id,context);
}
