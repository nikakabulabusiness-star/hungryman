import {storage} from '@/lib/storage';
import {WorkError,type WorkContext} from '@/lib/work-policy';
import {boundedText,requireVersion,validWorkId,workPageOptions} from '@/lib/work-tasks';
import type {WorkContact,WorkContactInput,WorkContactList} from '@/mobile/src/lib/work-task-model';

type ContactRow={id:string;company:string;category:string;first_name:string;last_name:string;position:string;phone:string;email:string;notes:string;version:number;created:number;updated:number;created_by:string;updated_by:string;mutation_id:string;deleted:number|null};
const fields='id,company,category,first_name,last_name,position,phone,email,notes,version,created,updated,created_by,updated_by,mutation_id,deleted';
const keys=['company','category','firstName','lastName','position','phone','email','notes'] as const;
function allowed(context:WorkContext){if(!context.canContacts)throw new WorkError(403,'კონტაქტების ბაზა ხელმისაწვდომია ხელმძღვანელებისთვის, HR-ისთვის და დამფუძნებლებისთვის.')}
function view(row:ContactRow):WorkContact{return {id:row.id,company:row.company,category:row.category,firstName:row.first_name,lastName:row.last_name,position:row.position,phone:row.phone,email:row.email,notes:row.notes,created:row.created,updated:row.updated,createdBy:row.created_by,updatedBy:row.updated_by,version:row.version}}
function input(body:Record<string,unknown>,existing?:WorkContact):WorkContactInput{
 const value:Record<string,string>={};
 for(const key of keys)value[key]=boundedText(body[key]===undefined?(existing?.[key]??''):body[key],key==='notes'?5000:key==='email'?254:key==='phone'?80:180,['company','firstName','phone'].includes(key));
 if(value.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))throw new WorkError(400,'ელფოსტა არასწორია.');
 if(!/^[+\d\s().#*-]{3,80}$/.test(value.phone))throw new WorkError(400,'მიუთითე საკონტაქტო ნომერი.');
 return value as WorkContactInput;
}
async function row(context:WorkContext,id:string){
 allowed(context);if(!validWorkId(id))throw new WorkError(404,'კონტაქტი ვერ მოიძებნა.');
 const value=await storage().DB.prepare(`SELECT ${fields} FROM work_contacts WHERE id=? AND deleted IS NULL`).bind(id).first<ContactRow>();
 if(!value)throw new WorkError(404,'კონტაქტი ვერ მოიძებნა.');return value;
}
export async function getWorkContact(context:WorkContext,id:string){return view(await row(context,id))}
export async function listWorkContacts(context:WorkContext,url:URL):Promise<WorkContactList>{
 allowed(context);const {limit,q,before,id}=workPageOptions(url),clauses=['deleted IS NULL'],args:unknown[]=[];
 if(q){clauses.push("(company LIKE ? ESCAPE '\\' OR first_name LIKE ? ESCAPE '\\' OR last_name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\')");args.push(...Array(5).fill('%'+q+'%'))}
 if(before!==null){clauses.push('(updated<? OR (updated=? AND id<?))');args.push(before,before,id)}
 const rows=(await storage().DB.prepare(`SELECT ${fields} FROM work_contacts WHERE ${clauses.join(' AND ')} ORDER BY updated DESC,id DESC LIMIT ?`).bind(...args,limit+1).all<ContactRow>()).results,last=rows.slice(0,limit).at(-1);
 return {contacts:rows.slice(0,limit).map(view),canManage:true,nextCursor:rows.length>limit&&last?last.updated+':'+last.id:null};
}
function audit(context:WorkContext,id:string,version:number,action:string,token:string,now:number){return storage().DB.prepare('INSERT INTO workspace_audit (id,actor,action,target,details,created) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM work_contacts WHERE id=? AND mutation_id=?)').bind(crypto.randomUUID(),context.actor.email,action,id,JSON.stringify({version}),now,id,token)}
export async function createWorkContact(context:WorkContext,body:Record<string,unknown>){
 allowed(context);if(Object.keys(body).some(key=>!keys.includes(key as typeof keys[number])&&key!=='id'))throw new WorkError(400,'მიუწვდომელი ველია მითითებული.');
 const value=input(body),id=body.id===undefined?crypto.randomUUID():body.id;if(!validWorkId(id))throw new WorkError(400,'კონტაქტის ID არასწორია.');
 const db=storage().DB,now=Date.now(),token=crypto.randomUUID();
 const results=await db.batch([db.prepare('INSERT OR IGNORE INTO work_contacts (id,company,category,first_name,last_name,position,phone,email,notes,version,created,updated,created_by,updated_by,mutation_id) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?,?)').bind(id,value.company,value.category,value.firstName,value.lastName,value.position,value.phone,value.email,value.notes,now,now,context.actor.fullName,context.actor.fullName,token),audit(context,id,1,'work.contact.created',token,now)]);
 if(!results[0].meta.changes)throw new WorkError(409,'ამ ID-ით კონტაქტი უკვე არსებობს.');return getWorkContact(context,id);
}
export async function updateWorkContact(context:WorkContext,id:string,body:Record<string,unknown>){
 const existing=await row(context,id),version=requireVersion(body.version);if(version!==existing.version)throw new WorkError(409,'კონტაქტი უკვე შეიცვალა. განაახლე და სცადე ხელახლა.');
 if(Object.keys(body).length<2||Object.keys(body).some(key=>key!=='version'&&!keys.includes(key as typeof keys[number])))throw new WorkError(400,'მხოლოდ კონტაქტის ველების შეცვლა შეიძლება.');
 const value=input(body,view(existing)),db=storage().DB,now=Date.now(),token=crypto.randomUUID();
 const results=await db.batch([db.prepare('UPDATE work_contacts SET company=?,category=?,first_name=?,last_name=?,position=?,phone=?,email=?,notes=?,updated=?,updated_by=?,mutation_id=?,version=version+1 WHERE id=? AND version=? AND deleted IS NULL').bind(value.company,value.category,value.firstName,value.lastName,value.position,value.phone,value.email,value.notes,now,context.actor.fullName,token,id,version),audit(context,id,version+1,'work.contact.updated',token,now)]);
 if(!results[0].meta.changes)throw new WorkError(409,'კონტაქტი უკვე შეიცვალა. განაახლე და სცადე ხელახლა.');return getWorkContact(context,id);
}
export async function deleteWorkContact(context:WorkContext,id:string,body:Record<string,unknown>){
 const existing=await row(context,id),version=requireVersion(body.version);if(version!==existing.version)throw new WorkError(409,'კონტაქტი უკვე შეიცვალა.');
 const db=storage().DB,now=Date.now(),token=crypto.randomUUID(),results=await db.batch([db.prepare('UPDATE work_contacts SET deleted=?,updated=?,updated_by=?,mutation_id=?,version=version+1 WHERE id=? AND version=? AND deleted IS NULL').bind(now,now,context.actor.fullName,token,id,version),audit(context,id,version+1,'work.contact.deleted',token,now)]);
 if(!results[0].meta.changes)throw new WorkError(409,'კონტაქტი უკვე შეიცვალა.');return {ok:true};
}
