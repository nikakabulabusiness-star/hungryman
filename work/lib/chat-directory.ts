import {listApprovedStaff,type StaffAccess} from './staff-access';import {storage} from './storage';
import {hasPermission} from './permissions';
import {getDepartments,departmentForRole,membershipsForPosition,defaultMemberships} from './departments';
import {getPositions} from './positions';
export async function conversationPeople(id:string){const staff=(await listApprovedStaff()).filter(p=>p.userId);if(id==='team')return staff;const db=storage().DB,pair=await db.prepare('SELECT user_a,user_b FROM chat_threads WHERE id=?').bind(id).first<{user_a:string;user_b:string}>();if(pair)return staff.filter(p=>p.userId===pair.user_a||p.userId===pair.user_b);const members=await db.prepare('SELECT user_id FROM chat_group_members WHERE conversation_id=?').bind(id).all<{user_id:string}>();const ids=new Set(members.results.map(p=>p.user_id));return staff.filter(p=>ids.has(p.userId!))}
export function personHandle(name:string,id:string){const handle=name.trim().replace(/[^\p{L}\p{N}_.-]+/gu,'_').replace(/^_+|_+$/g,'').slice(0,64);return handle||'user_'+id.slice(-8)}
export function mentionPeople<T extends {userId:string|null;fullName:string;role:string}>(people:T[]){return people.map(p=>{let handle=personHandle(p.fullName,p.userId!);if(people.filter(x=>personHandle(x.fullName,x.userId!).toLocaleLowerCase()===handle.toLocaleLowerCase()).length>1)handle+='_'+p.userId!.slice(-6);return {...p,handle}})}
export function mentionedUsers(body:string,people:{userId:string|null;fullName:string;role:string}[]){const tokens=new Set([...body.matchAll(/(?:^|[\s(])@([\p{L}\p{N}_.-]+)/gu)].map(m=>m[1].toLocaleLowerCase()));if(tokens.has('everyone')||tokens.has('ყველა'))return people.map(p=>p.userId!).filter(Boolean);return mentionPeople(people).filter(p=>tokens.has(p.handle.toLocaleLowerCase())||tokens.has(p.role.replace(/\s+/g,'_').toLocaleLowerCase())||p.role==='სცენარისტი'&&tokens.has('სცენარი')).map(p=>p.userId!).filter(Boolean)}

/** A department audience is a snapshot of its current approved members, not an account grant. */
export async function chatAudience(access:StaffAccess){
 const [departments,positions]=await Promise.all([getDepartments(),getPositions()]);
 const positionDepartments=new Map(positions.map(p=>[p.name,membershipsForPosition(p).map(m=>m.departmentId)]));
 const roleDepartments=(role:string)=>positionDepartments.get(role)||defaultMemberships(role).map(m=>m.departmentId);
 const roleDepartment=(role:string)=>roleDepartments(role)[0]||departmentForRole(role);
 const allowed=hasPermission(access,'chat.department_group')?departments.filter(d=>
  access.isSiteAdmin||access.isDeveloper||access.role==='Developer'||access.role==='Owner'||access.role==='HR'||
  roleDepartments(access.role||'').includes(d.id)||
  d.headUserId===access.userId||d.directorUserId===access.userId
 ):[];
 return {departments:allowed.map(d=>({id:d.id,name:d.name})),roleDepartment,roleDepartments};
}
export function chatCapabilities(access:StaffAccess,canSelectDepartments=false){return {
 canSend:hasPermission(access,'chat.send'),canAttach:hasPermission(access,'chat.attach'),canCall:hasPermission(access,'chat.call'),
 canDirect:access.features?.privateChats!==false&&hasPermission(access,'chat.send'),canCreateGroups:hasPermission(access,'chat.create_group'),
 canManageGroups:hasPermission(access,'chat.manage_group'),canModerate:hasPermission(access,'chat.moderate'),canSelectDepartments,
}}
