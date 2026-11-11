import {storage} from '@/lib/storage';

export type ShootTask={
 id:string;
 shoot_id:string;
 assignee_email:string;
 assignee_name:string;
 assignee_role:string;
 task:string;
 status:'todo'|'done';
 created:number;
};

export type ShootRecord={
 id:string;
 title:string;
 shoot_date:string;
 start_time:string;
 end_time:string|null;
 location_name:string;
 location_url:string|null;
 latitude:number|null;
 longitude:number|null;
 photo_id:string|null;
 details:string;
 status:'planned'|'completed'|'cancelled';
 created:number;
 updated:number;
 created_by:string;
 updated_by:string;
 work_video_id?:string|null;
 work_day_id?:string|null;
 content_kind?:'video'|'short';
 work_snapshot?:string|null;
};

export type ShootWithTasks=ShootRecord&{tasks:ShootTask[]};

export type ShootInput={
 title:string;
 shootDate:string;
 startTime:string;
 endTime:string;
 locationName:string;
 locationUrl:string;
 latitude:number|null;
 longitude:number|null;
 photoId:string|null;
 details:string;
 status:ShootRecord['status'];
 assignments:Array<{assigneeEmail:string;task:string}>;
};

const shootColumns='id,title,shoot_date,start_time,end_time,location_name,location_url,latitude,longitude,photo_id,details,status,created,updated,created_by,updated_by,work_video_id,work_day_id,content_kind';

export async function listShootsWithTasks():Promise<ShootWithTasks[]>{
 const {DB}=storage();
 const [{results:shootRows},{results:taskRows}]=await Promise.all([
  DB.prepare(`SELECT ${shootColumns} FROM shoots ORDER BY shoot_date DESC,start_time DESC,created DESC`).all<ShootRecord>(),
  DB.prepare('SELECT id,shoot_id,assignee_email,assignee_name,assignee_role,task,status,created FROM shoot_tasks ORDER BY created').all<ShootTask>(),
 ]);
 const byShoot=new Map<string,ShootTask[]>();
 for(const task of taskRows){const list=byShoot.get(task.shoot_id)||[];list.push(task);byShoot.set(task.shoot_id,list)}
 return shootRows.map(shoot=>({...shoot,tasks:byShoot.get(shoot.id)||[]}));
}

export async function getShoot(id:string):Promise<ShootWithTasks|null>{
 const {DB}=storage();
 const shoot=await DB.prepare(`SELECT ${shootColumns},work_snapshot FROM shoots WHERE id=? LIMIT 1`).bind(id).first<ShootRecord>();
 if(!shoot)return null;
 const {results}=await DB.prepare('SELECT id,shoot_id,assignee_email,assignee_name,assignee_role,task,status,created FROM shoot_tasks WHERE shoot_id=? ORDER BY created').bind(id).all<ShootTask>();
 return {...shoot,tasks:results};
}

export async function getNextShoot():Promise<ShootRecord|null>{
 const {date,time}=tbilisiNow();
 return await storage().DB.prepare(`SELECT ${shootColumns} FROM shoots WHERE status='planned' AND (shoot_date>? OR (shoot_date=? AND start_time>=?)) ORDER BY shoot_date,start_time LIMIT 1`).bind(date,date,time).first<ShootRecord>()||null;
}

export function validateShootInput(value:unknown):{ok:true;value:ShootInput}|{ok:false;error:string}{
 if(!value||typeof value!=='object')return {ok:false,error:'მონაცემები არასწორია.'};
 const body=value as Record<string,unknown>;
 const photoId=body.photoId==null||body.photoId===''?null:String(body.photoId);
 if(photoId&&!/^[a-f\d-]{36}$/i.test(photoId))return {ok:false,error:'არასწორი ფოტო.'};
 const title=clean(body.title,160),shootDate=clean(body.shootDate,10),startTime=clean(body.startTime,5),endTime=clean(body.endTime,5),locationName=clean(body.locationName,200),locationUrl=clean(body.locationUrl,2000),details=clean(body.details,5000),status=clean(body.status,20)||'planned';
 if(!title)return {ok:false,error:'მიუთითე გადაღების დასახელება.'};
 if(!validDate(shootDate))return {ok:false,error:'მიუთითე სწორი თარიღი.'};
 if(!validTime(startTime)||endTime&&!validTime(endTime))return {ok:false,error:'მიუთითე სწორი დრო.'};
 if(endTime&&endTime<=startTime)return {ok:false,error:'დასრულების დრო დაწყების დროზე გვიან უნდა იყოს.'};
 if(!['planned','completed','cancelled'].includes(status))return {ok:false,error:'გადაღების სტატუსი არასწორია.'};
 if(locationUrl&&!safeHttpUrl(locationUrl))return {ok:false,error:'მიუთითე სწორი მდებარეობის ბმული.'};
 let latitude=body.latitude==null||body.latitude===''?null:Number(body.latitude),longitude=body.longitude==null||body.longitude===''?null:Number(body.longitude);
 if(latitude===null&&longitude===null&&locationUrl){const match=locationUrl.match(/(?:query=|q=|@)(-?\d+\.\d+),(-?\d+\.\d+)/);if(match){latitude=Number(match[1]);longitude=Number(match[2])}}
 if((latitude===null)!==(longitude===null)||latitude!==null&&(!Number.isFinite(latitude)||Math.abs(latitude)>90)||longitude!==null&&(!Number.isFinite(longitude)||Math.abs(longitude)>180))return {ok:false,error:'რუკაზე მონიშნული ლოკაცია არასწორია.'};
 const source=Array.isArray(body.assignments)?body.assignments:[];
 if(source.length>40)return {ok:false,error:'ერთ გადაღებაზე მაქსიმუმ 40 დავალების დამატებაა შესაძლებელი.'};
 const assignments:Array<{assigneeEmail:string;task:string}>=[];
 for(const item of source){
  if(!item||typeof item!=='object')return {ok:false,error:'დავალების მონაცემები არასწორია.'};
  const row=item as Record<string,unknown>,assigneeEmail=clean(row.assigneeEmail,254).toLowerCase(),task=clean(row.task,500);
  if(!assigneeEmail||!task)return {ok:false,error:'ყოველ დავალებაზე აირჩიე თანამშრომელი და შეავსე აღწერა.'};
  assignments.push({assigneeEmail,task});
 }
 return {ok:true,value:{title,shootDate,startTime,endTime,locationName,locationUrl,latitude,longitude,photoId,details,status:status as ShootRecord['status'],assignments}};
}

function clean(value:unknown,max:number){return String(value||'').trim().slice(0,max)}
function validTime(value:string){return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)}
function validDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d}
function safeHttpUrl(value:string){try{const url=new URL(value);return url.protocol==='https:'||url.protocol==='http:'}catch{return false}}
function tbilisiNow(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tbilisi',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()),get=(type:string)=>parts.find(part=>part.type===type)?.value||'';return {date:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour')}:${get('minute')}`}}
