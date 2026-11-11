import {storage} from '@/lib/storage';
import {noticeStatements,dispatchNotices} from '@/lib/notifications';
import {publicRole} from '@/lib/site-controls';
import {canAssignWork,leadsWorkDepartment,WorkError,type WorkContext} from '@/lib/work-policy';
import type {WorkTask,WorkTaskCheck,WorkTaskList,WorkTaskPerson,WorkTaskPriority,WorkTaskScope} from '@/mobile/src/lib/work-task-model';

type TaskRow={id:string;scope:WorkTaskScope;title:string;description:string;creator_id:string;creator_name:string;assignee_id:string;assignee_name:string;department_id:string;priority:WorkTaskPriority;progress:number;checklist_json:string;due_date:string|null;version:number;created:number;updated:number;updated_by:string;mutation_id:string;deleted:number|null};
const fields='id,scope,title,description,creator_id,creator_name,assignee_id,assignee_name,department_id,priority,progress,checklist_json,due_date,version,created,updated,updated_by,mutation_id,deleted';
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
export function validWorkId(value:unknown):value is string{return typeof value==='string'&&uuid.test(value)}
export async function readWorkBody(req:Request){
 if(Number(req.headers.get('Content-Length')||0)>40000)throw new WorkError(413,'მოთხოვნა ძალიან დიდია.');
 const text=await req.text();if(text.length>40000)throw new WorkError(413,'მოთხოვნა ძალიან დიდია.');
 let body:unknown;try{body=JSON.parse(text)}catch{throw new WorkError(400,'მონაცემები არასწორია.')}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new WorkError(400,'მონაცემები არასწორია.');
 return body as Record<string,unknown>;
}
export function boundedText(value:unknown,max:number,required=false){
 if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw new WorkError(400,'შეამოწმე ტექსტის ფორმატი და სიგრძე.');
 const result=value.trim();if(required&&!result)throw new WorkError(400,'შეავსე აუცილებელი ველები.');return result;
}
export function requireVersion(value:unknown){if(!Number.isSafeInteger(value)||Number(value)<1)throw new WorkError(400,'ჩანაწერის ვერსია აუცილებელია.');return Number(value)}
function taskPriority(value:unknown):WorkTaskPriority{if(value!=='low'&&value!=='normal'&&value!=='high')throw new WorkError(400,'პრიორიტეტი არასწორია.');return value}
function taskDate(value:unknown){if(value===null||value==='')return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw new WorkError(400,'თარიღი არასწორია.');return value}
function taskProgress(value:unknown){if(!Number.isInteger(value)||Number(value)<0||Number(value)>100)throw new WorkError(400,'პროგრესი უნდა იყოს 0-დან 100-მდე.');return Number(value)}
function taskChecklist(value:unknown):WorkTaskCheck[]{
 if(!Array.isArray(value)||value.length>60)throw new WorkError(400,'სიაში მაქსიმუმ 60 პუნქტია შესაძლებელი.');
 const ids=new Set<string>();return value.map(item=>{if(!item||typeof item!=='object'||typeof item.id!=='string'||!/^[a-z\d_-]{1,80}$/i.test(item.id)||ids.has(item.id)||typeof item.done!=='boolean')throw new WorkError(400,'სიის პუნქტი არასწორია.');ids.add(item.id);return {id:item.id,title:boundedText(item.title,300,true),done:item.done}});
}
function taskCanManage(context:WorkContext,row:TaskRow){
 if(row.scope==='private')return row.creator_id===context.actor.userId;
 if(globalTaskManager(context))return true;
 const target=context.people.find(person=>person.userId===row.assignee_id);
 if(!target)return leadsWorkDepartment(context,row.department_id)||(row.creator_id===context.actor.userId&&context.actor.role==='Senior Editor'&&row.department_id==='production'&&context.people.some(person=>person.userId===context.actor.userId&&person.memberships.some(m=>m.departmentId==='production')));
 return !!target&&context.assignable.some(person=>person.userId!==context.actor.userId)&&canAssignWork(context,target);
}
function globalTaskManager(context:WorkContext){return context.actor.isDeveloper||context.actor.role==='Owner'||context.actor.role==='HR'}
function taskVisible(context:WorkContext,row:TaskRow){
 if(row.deleted!==null)return false;
 if(row.scope==='private')return row.creator_id===context.actor.userId;
 return row.creator_id===context.actor.userId||row.assignee_id===context.actor.userId||taskCanManage(context,row);
}
function taskView(context:WorkContext,row:TaskRow):WorkTask{
 const edit=taskCanManage(context,row);return {id:row.id,scope:row.scope,title:row.title,description:row.description,creatorId:row.creator_id,creatorName:row.creator_name,assigneeId:row.assignee_id,assigneeName:row.assignee_name,departmentId:row.department_id,priority:row.priority,progress:row.progress,checklist:JSON.parse(row.checklist_json),dueDate:row.due_date,created:row.created,updated:row.updated,version:row.version,permissions:{edit,delete:edit,progress:edit||row.assignee_id===context.actor.userId}};
}
export function workPageOptions(url:URL){
 const limit=Number(url.searchParams.get('limit')||50);if(!Number.isInteger(limit)||limit<1||limit>100)throw new WorkError(400,'გვერდის ზომა არასწორია.');
 const q=(url.searchParams.get('q')||'').trim();if(q.length>120)throw new WorkError(400,'საძიებო ტექსტი ძალიან გრძელია.');
 const cursor=url.searchParams.get('cursor');let before:number|null=null,id:string|null=null;
 if(cursor){const separator=cursor.indexOf(':');before=Number(cursor.slice(0,separator));id=cursor.slice(separator+1);if(separator<1||!Number.isSafeInteger(before)||before<0||!validWorkId(id))throw new WorkError(400,'გვერდის მაჩვენებელი არასწორია.')}
 return {limit,q:q.replace(/[\\%_]/g,'\\$&'),before,id};
}
export async function listWorkTasks(context:WorkContext,url:URL):Promise<WorkTaskList>{
 const {limit,q,before,id}=workPageOptions(url),scope=url.searchParams.get('scope')||'all',status=url.searchParams.get('status')||'all';
 if(!['private','assigned','all'].includes(scope)||!['all','current','completed'].includes(status))throw new WorkError(400,'ფილტრი არასწორია.');
 const canAssign=context.assignable.some(person=>person.userId!==context.actor.userId),allowed=canAssign?context.assignable.map(person=>person.userId):[];
 const managedDepartments=context.departments.filter(department=>leadsWorkDepartment(context,department.id)).map(department=>department.id);
 const clauses=["deleted IS NULL", "((scope='private' AND creator_id=?) OR (scope='assigned' AND (creator_id=? OR assignee_id=? OR assignee_id IN (SELECT value FROM json_each(?)) OR ?=1 OR department_id IN (SELECT value FROM json_each(?)))))"];
 const args:unknown[]=[context.actor.userId,context.actor.userId,context.actor.userId,JSON.stringify(allowed),globalTaskManager(context)?1:0,JSON.stringify(managedDepartments)];
 if(scope!=='all'){clauses.push('scope=?');args.push(scope)}
 if(status!=='all')clauses.push(status==='completed'?'progress=100':'progress<100');
 if(q){clauses.push("(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')");args.push('%'+q+'%','%'+q+'%')}
 if(before!==null){clauses.push('(updated<? OR (updated=? AND id<?))');args.push(before,before,id)}
 const rows=(await storage().DB.prepare(`SELECT ${fields} FROM work_tasks WHERE ${clauses.join(' AND ')} ORDER BY updated DESC,id DESC LIMIT ?`).bind(...args,limit+1).all<TaskRow>()).results;
 const result=rows.slice(0,limit),last=result.at(-1);
 const people:WorkTaskPerson[]=canAssign?context.assignable.map(person=>({userId:person.userId,name:person.name,role:publicRole(person.role),departmentIds:person.memberships.map(m=>m.departmentId)})):[];
 return {tasks:result.map(row=>taskView(context,row)),people,canAssign,viewerId:context.actor.userId,nextCursor:rows.length>limit&&last?last.updated+':'+last.id:null};
}
async function taskRow(context:WorkContext,id:string){
 if(!validWorkId(id))throw new WorkError(404,'დავალება ვერ მოიძებნა.');
 const row=await storage().DB.prepare(`SELECT ${fields} FROM work_tasks WHERE id=? AND deleted IS NULL`).bind(id).first<TaskRow>();
 if(!row||!taskVisible(context,row))throw new WorkError(404,'დავალება ვერ მოიძებნა.');return row;
}
export async function getWorkTask(context:WorkContext,id:string){return taskView(context,await taskRow(context,id))}
function mutationGuard(id:string,token:string){return {query:'EXISTS(SELECT 1 FROM work_tasks WHERE id=? AND mutation_id=? AND deleted IS NULL)',values:[id,token]}}
function eventStatement(id:string,version:number,actorId:string,kind:string,now:number,token:string){return storage().DB.prepare('INSERT OR IGNORE INTO work_task_events (id,task_id,version,actor_id,kind,created) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM work_tasks WHERE id=? AND mutation_id=?)').bind(id+':'+version,id,version,actorId,kind,now,id,token)}
export async function createWorkTask(context:WorkContext,body:Record<string,unknown>){
 if(Object.keys(body).some(key=>!['id','scope','title','description','assigneeId','priority','dueDate','checklist'].includes(key)))throw new WorkError(400,'მიუწვდომელი ველია მითითებული.');
 if(body.scope!=='private'&&body.scope!=='assigned')throw new WorkError(400,'აირჩიე პირადი ან მინიჭებული დავალება.');
 const scope=body.scope,title=boundedText(body.title,180,true),description=boundedText(body.description??'',8000),priority=taskPriority(body.priority??'normal'),dueDate=taskDate(body.dueDate??null),checklist=taskChecklist(body.checklist??[]).map(item=>({...item,done:false}));
 let assigneeId=context.actor.userId,assigneeName=context.actor.fullName,departmentId='';
 if(scope==='private'&&body.assigneeId!==undefined&&body.assigneeId!==context.actor.userId)throw new WorkError(400,'პირადი დავალება მხოლოდ შენ გეკუთვნის.');
 if(scope==='assigned'){
  const person=context.people.find(person=>person.userId===body.assigneeId);
  if(!person||!context.assignable.some(p=>p.userId!==context.actor.userId)||!canAssignWork(context,person))throw new WorkError(403,'ამ თანამშრომლისთვის დავალების მინიჭების უფლება არ გაქვს.');
  assigneeId=person.userId;assigneeName=person.name;departmentId=person.memberships[0]?.departmentId||'';
 }
 const id=body.id===undefined?crypto.randomUUID():body.id;if(!validWorkId(id))throw new WorkError(400,'დავალების ID არასწორია.');
 const now=Date.now(),token=crypto.randomUUID(),db=storage().DB;
 const statements=[db.prepare('INSERT OR IGNORE INTO work_tasks (id,scope,title,description,creator_id,creator_name,assignee_id,assignee_name,department_id,priority,progress,checklist_json,due_date,version,created,updated,updated_by,mutation_id) VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,1,?,?,?,?)').bind(id,scope,title,description,context.actor.userId,context.actor.fullName,assigneeId,assigneeName,departmentId,priority,JSON.stringify(checklist),dueDate,now,now,context.actor.userId,token),eventStatement(id,1,context.actor.userId,'created',now,token)];
 if(scope==='assigned')statements.push(...noticeStatements([assigneeId],{key:'work-task-assigned:'+id+':1',category:'work_task',target:'work_task',targetId:id,title:'ახალი დავალება',body:title,created:now},mutationGuard(id,token)));
 const result=await db.batch(statements);
 if(!result[0].meta.changes){const existing=await taskRow(context,id);if(existing.creator_id!==context.actor.userId||existing.scope!==scope||existing.title!==title||existing.assignee_id!==assigneeId)throw new WorkError(409,'ამ ID-ით დავალება უკვე არსებობს.');return taskView(context,existing)}
 if(scope==='assigned')dispatchNotices();return getWorkTask(context,id);
}
export async function updateWorkTask(context:WorkContext,id:string,body:Record<string,unknown>){
 const existing=await taskRow(context,id),version=requireVersion(body.version);if(version!==existing.version)throw new WorkError(409,'დავალება უკვე შეიცვალა. განაახლე და სცადე ხელახლა.');
 const manage=taskCanManage(context,existing),progressAllowed=manage||existing.assignee_id===context.actor.userId;
 if(!progressAllowed)throw new WorkError(403,'ამ დავალების შეცვლის უფლება არ გაქვს.');
 const allowed=manage?['version','title','description','assigneeId','priority','dueDate','progress','checklist']:['version','progress','checklist'];
 if(Object.keys(body).some(key=>!allowed.includes(key))||Object.keys(body).length<2)throw new WorkError(400,'მხოლოდ ხელმისაწვდომი ველების შეცვლა შეიძლება.');
 const title=Object.hasOwn(body,'title')?boundedText(body.title,180,true):existing.title,description=Object.hasOwn(body,'description')?boundedText(body.description,8000):existing.description,priority=Object.hasOwn(body,'priority')?taskPriority(body.priority):existing.priority,dueDate=Object.hasOwn(body,'dueDate')?taskDate(body.dueDate):existing.due_date;
 const originalChecks=JSON.parse(existing.checklist_json) as WorkTaskCheck[];
 let checklist=Object.hasOwn(body,'checklist')?taskChecklist(body.checklist):originalChecks,progress=Object.hasOwn(body,'progress')?taskProgress(body.progress):Object.hasOwn(body,'checklist')&&checklist.length?Math.round(checklist.filter(item=>item.done).length/checklist.length*100):existing.progress;
 if(!manage&&(checklist.length!==originalChecks.length||checklist.some((item,index)=>item.id!==originalChecks[index].id||item.title!==originalChecks[index].title)))throw new WorkError(403,'მხოლოდ სიის შესრულების მონიშვნა შეგიძლია.');
 let assigneeId=existing.assignee_id,assigneeName=existing.assignee_name,departmentId=existing.department_id;
 if(Object.hasOwn(body,'assigneeId')&&body.assigneeId!==existing.assignee_id){
  if(existing.scope==='private')throw new WorkError(400,'პირადი დავალების გადაცემა შეუძლებელია.');
  const person=context.people.find(person=>person.userId===body.assigneeId);if(!person||!canAssignWork(context,person))throw new WorkError(403,'ამ თანამშრომლისთვის მინიჭების უფლება არ გაქვს.');
  assigneeId=person.userId;assigneeName=person.name;departmentId=person.memberships[0]?.departmentId||'';progress=0;checklist=checklist.map(item=>({...item,done:false}));
 }
 if(progress===100)checklist=checklist.map(item=>({...item,done:true}));
 const now=Date.now(),token=crypto.randomUUID(),nextVersion=version+1,db=storage().DB,completed=existing.progress<100&&progress===100;
 const statements=[db.prepare('UPDATE work_tasks SET title=?,description=?,assignee_id=?,assignee_name=?,department_id=?,priority=?,progress=?,checklist_json=?,due_date=?,version=version+1,updated=?,updated_by=?,mutation_id=? WHERE id=? AND version=? AND deleted IS NULL').bind(title,description,assigneeId,assigneeName,departmentId,priority,progress,JSON.stringify(checklist),dueDate,now,context.actor.userId,token,id,version),eventStatement(id,nextVersion,context.actor.userId,completed?'completed':assigneeId!==existing.assignee_id?'assigned':'updated',now,token)];
 if(existing.scope==='assigned'&&completed)statements.push(...noticeStatements([existing.creator_id],{key:'work-task-completed:'+id+':'+nextVersion,category:'work_task',target:'work_task',targetId:id,title:'დავალება შესრულებულია',body:assigneeName+' · '+title,created:now},mutationGuard(id,token)));
 if(existing.scope==='assigned'&&assigneeId!==existing.assignee_id)statements.push(...noticeStatements([assigneeId],{key:'work-task-assigned:'+id+':'+nextVersion,category:'work_task',target:'work_task',targetId:id,title:'ახალი დავალება',body:title,created:now},mutationGuard(id,token)));
 const result=await db.batch(statements);if(!result[0].meta.changes)throw new WorkError(409,'დავალება უკვე შეიცვალა. განაახლე და სცადე ხელახლა.');
 if(existing.scope==='assigned'&&(completed||assigneeId!==existing.assignee_id))dispatchNotices();return getWorkTask(context,id);
}
export async function deleteWorkTask(context:WorkContext,id:string,body:Record<string,unknown>){
 const row=await taskRow(context,id),version=requireVersion(body.version);if(!taskCanManage(context,row))throw new WorkError(403,'დავალების წაშლის უფლება არ გაქვს.');
 if(version!==row.version)throw new WorkError(409,'დავალება უკვე შეიცვალა.');
 const db=storage().DB,now=Date.now(),token=crypto.randomUUID(),result=await db.batch([db.prepare('UPDATE work_tasks SET deleted=?,updated=?,updated_by=?,mutation_id=?,version=version+1 WHERE id=? AND version=? AND deleted IS NULL').bind(now,now,context.actor.userId,token,id,version),eventStatement(id,version+1,context.actor.userId,'deleted',now,token)]);
 if(!result[0].meta.changes)throw new WorkError(409,'დავალება უკვე შეიცვალა.');return {ok:true};
}
