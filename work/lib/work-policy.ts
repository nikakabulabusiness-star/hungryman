import {getStaffAccess,listApprovedStaff,type StaffAccess} from '@/lib/staff-access';
import {getPositions,type Position} from '@/lib/positions';
import {storage} from '@/lib/storage';
import {hasPermission} from '@/lib/permissions';
import {sameOrigin} from '@/lib/visitor';
import {membershipsForPosition} from '@/lib/department-directory';
import {workBoards,type WorkBoard,type WorkPerson} from '@/mobile/src/lib/work-model';

export class WorkError extends Error{constructor(readonly status:number,message:string){super(message)}}
export type WorkDepartment={id:string;headUserId:string|null;directorUserId:string|null;directorRole:string};
export type WorkContext={actor:StaffAccess;people:WorkPerson[];positions:Position[];departments:WorkDepartment[];editBoards:WorkBoard[];canApprove:boolean;canContacts:boolean;assignable:WorkPerson[]};
export function requireWorkWrite(req:Request){if(!sameOrigin(req))throw new WorkError(403,'მოთხოვნა უარყოფილია.')}
/** Bound streaming bodies even when the sender omits Content-Length. */
export async function readWorkBytes(req:Request,limit:number,message='მონაცემები ზედმეტად დიდია.'){
 if(Number(req.headers.get('content-length')||0)>limit)throw new WorkError(413,message);
 const reader=req.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit){await reader.cancel();throw new WorkError(413,message)}chunks.push(part.value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return bytes;
}
export async function readWorkText(req:Request,limit=350000){return new TextDecoder().decode(await readWorkBytes(req,limit))}

export function workRouteError(error:unknown){const known=error instanceof WorkError;return Response.json({error:known?error.message:'სამუშაო მონაცემები დროებით მიუწვდომელია.'},{status:known?error.status:503,headers:{'Cache-Control':'private, no-store'}})}
export function leadsWorkDepartment(context:Pick<WorkContext,'actor'|'departments'>,id:string){const {actor}=context;return context.departments.some(d=>d.id===id&&(d.headUserId===actor.userId||d.directorUserId===actor.userId||!!actor.role&&d.directorRole===actor.role))}
export function canAssignWork(context:Pick<WorkContext,'actor'|'people'|'departments'>,target:WorkPerson){
 const {actor}=context;if(actor.userId===target.userId)return true;
 if(actor.isDeveloper||actor.role==='Owner'||actor.role==='HR')return true;
 if(target.memberships.some(m=>leadsWorkDepartment(context,m.departmentId)))return true;
 const editor=context.people.find(p=>p.userId===actor.userId)?.memberships.find(m=>m.departmentId==='production');
 return actor.role==='Senior Editor'&&target.role!=='პროდიუსერი'&&!!editor&&target.memberships.some(m=>m.departmentId==='production'&&m.level>=editor.level);
}
export async function getWorkContext(identity?:StaffAccess):Promise<WorkContext>{
 const actor=identity||await getStaffAccess();if(!actor?.isApproved||!actor.isDeveloper||!hasPermission(actor,'workspace.view')||actor.features?.work===false)throw new WorkError(403,'სამუშაო სივრცეში შესვლის უფლება საჭიროა.');
 const [directory,positions,departmentRows]=await Promise.all([listApprovedStaff(),getPositions(),storage().DB.prepare('SELECT id,head_user_id,director_user_id,director_name FROM staff_departments').all<{id:string;head_user_id:string|null;director_user_id:string|null;director_name:string}>()]);
 const people:WorkPerson[]=directory.filter(p=>!!p.userId).map(p=>p.userId===actor.userId&&p.role==='Developer'&&actor.role==='Senior Editor'?{...p,role:actor.role}:p).map(p=>({userId:p.userId!,email:p.email,name:p.fullName,role:p.role,memberships:positions.find(position=>position.name===p.role)?membershipsForPosition(positions.find(position=>position.name===p.role)!):[]}));
 const departments=departmentRows.results.map(d=>({id:d.id,headUserId:d.head_user_id,directorUserId:d.director_user_id,directorRole:d.director_name}));
 const basis={actor,people,positions,departments},memberships=people.find(p=>p.userId===actor.userId)?.memberships||[];
 const editBoards=workBoards.filter(board=>actor.isDeveloper||actor.role==='Owner'||actor.role==='პროდიუსერი'&&board.id!=='social'||memberships.some(m=>m.departmentId===board.departmentId)||leadsWorkDepartment(basis,board.departmentId)).map(board=>board.id);
 const canApprove=actor.role==='Owner'&&people.some(p=>p.userId===actor.userId&&p.role==='Owner'),canContacts=actor.isDeveloper||actor.role==='Owner'||actor.role==='HR'||departments.some(d=>leadsWorkDepartment(basis,d.id));
 return {...basis,editBoards,canApprove,canContacts,assignable:people.filter(p=>canAssignWork(basis,p))};
}
export function assertWorkEditor(context:WorkContext,board:WorkBoard){if(!context.editBoards.includes(board))throw new WorkError(403,'ამ დეპარტამენტის რედაქტირების უფლება არ გაქვს.')}
