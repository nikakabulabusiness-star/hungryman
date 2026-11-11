import {getAdminAccess,type AdminAccess} from '@/lib/admin';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {getPositions,normalizePosition,validPositionName,type Position} from '@/lib/positions';
import {canManageRole,hasPermission,permissionKeys,validatePermissionGrant,type PermissionKey} from '@/lib/permissions';
import {getDepartments,defaultMemberships,type DepartmentMembership} from '@/lib/departments';

export const dynamic='force-dynamic';
type PositionBody={name?:unknown;currentName?:unknown;active?:unknown;departmentId?:unknown;rank?:unknown;reportsTo?:unknown;permissions?:unknown;memberships?:unknown};
const fail=(error:string,status=400)=>Response.json({error},{status});
function canOpen(access:AdminAccess|null){return !!access&&hasPermission(access,'positions.view')}
function canWrite(access:AdminAccess|null){return !!access&&hasPermission(access,'positions.view')&&hasPermission(access,'positions.manage')}
async function payload(access:AdminAccess){const positions=await getPositions();return {positions,editableNames:positions.filter(role=>canManageRole(access,role.name)).map(role=>role.name)}}
export async function GET(){
 const access=await getAdminAccess();if(!canOpen(access)||!access)return fail('წვდომა შეზღუდულია.',403);
 try{return Response.json(await payload(access))}catch{return fail('შტატები ვერ ჩაიტვირთა.',503)}
}
async function change(req:Request,action:'create'|'update'|'delete'){
 const access=await getAdminAccess();
 if(!canWrite(access)||!access||!sameOrigin(req))return fail('ამ მოქმედების უფლება არ გაქვს.',403);
 try{
  const body=await req.json() as PositionBody;
  const name=normalizePosition(body.name),currentName=normalizePosition(body.currentName)||name;
  if(!name||name.toLowerCase()==='developer'||currentName.toLowerCase()==='developer')return fail('Developer-ის შტატი ამ გვერდიდან არ იცვლება.',403);
  const allRoles=await getPositions({includeDeleted:true}),roles=allRoles.filter(r=>!r.deleted),current=roles.find(role=>role.name.toLocaleLowerCase()===currentName.toLocaleLowerCase());
  if(action!=='create'&&!current)return fail('შტატი ვერ მოიძებნა.',404);
  if(action==='create'&&roles.some(role=>role.name.toLocaleLowerCase()===name.toLocaleLowerCase()))return fail('ეს შტატი უკვე არსებობს.',409);
  if(!canManageRole(access,current?.name||name))return fail('ამ შტატის მართვის უფლება არ გაქვს.',403);
  const fixedNames=['HR','კრეატიული დირექტორი','ადმინისტრატორი'];
  if(!access.isDeveloper&&!access.isSiteAdmin&&((action==='delete'&&fixedNames.includes(current?.name||name))||(action==='update'&&current?.name!==name&&(fixedNames.includes(current?.name||'')||fixedNames.includes(name)))||(action==='create'&&fixedNames.includes(name))))return fail('ამ სისტემური შტატის წაშლა, აღდგენა ან სახელის შეცვლა მხოლოდ Developer-ს შეუძლია.',403);
  const {DB}=storage(),now=Date.now();
  if(action==='delete'){
   await DB.batch([
    DB.prepare('UPDATE staff_positions SET is_active=0,is_deleted=1,updated=?,updated_by=? WHERE name=?').bind(now,access.email,current!.name),
    DB.prepare('INSERT INTO workspace_audit (id,actor,action,target,details,created) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),access.email,'position.delete',current!.name,JSON.stringify({previousActive:current!.active}),now),
   ]);
   return Response.json(await payload(access));
  }
  if(name==='Owner'&&current?.name!=='Owner'||name!=='Owner'&&!validPositionName(name))return fail('ჩაწერე სწორი დასახელება (2–80 სიმბოლო). Owner-ის შექმნა ამ გზით შეუძლებელია.');
  if(current?.name==='Owner'&&name!=='Owner')return fail('Owner-ის სისტემური დასახელება არ იცვლება.');
  if(name!==current?.name&&!canManageRole(access,name))return fail('ამ დასახელების შტატის მართვის უფლება არ გაქვს.',403);
  const duplicate=roles.find(role=>role.name.toLocaleLowerCase()===name.toLocaleLowerCase()&&role.name!==current?.name);
  if(duplicate)return fail('ამ დასახელებით შტატი უკვე არსებობს.',409);
  if(!access.isDeveloper&&!access.isSiteAdmin&&!['Owner','HR'].includes(access.role||'')&&current&&
   (name!==current.name||body.departmentId!==undefined&&body.departmentId!==current.departmentId||body.rank!==undefined&&Number(body.rank)!==current.rank||body.reportsTo!==undefined&&body.reportsTo!==current.reportsTo||body.memberships!==undefined&&JSON.stringify(body.memberships)!==JSON.stringify(current.memberships)))return fail('სტრუქტურას HR ან დამფუძნებელი მართავს.',403);
  const departments=await getDepartments();
  let input:unknown=body.memberships??current?.memberships??defaultMemberships(name);
  // Retain compatibility with older app versions that edit a single primary department.
  if(body.memberships===undefined&&body.departmentId!==undefined&&body.departmentId!==current?.departmentId){
   input=body.departmentId==='other'?[]:[{departmentId:body.departmentId,level:Number(body.rank)||1,reportsTo:normalizePosition(body.reportsTo)||'Owner'}];
  }
  if(!Array.isArray(input)||input.length>departments.length)return fail('დეპარტამენტების სია არასწორია.');
  const memberships:DepartmentMembership[]=[];
  for(const item of input){
   if(!item||typeof item!=='object'||!departments.some(d=>d.id===item.departmentId)||memberships.some(m=>m.departmentId===item.departmentId))return fail('აირჩიე არსებული დეპარტამენტი ერთხელ.');
   if(!Number.isInteger(item.level)||item.level<1||item.level>30)return fail('შტატის დონე უნდა იყოს 1–30. დამფუძნებელი ყოველთვის 0 დონეა.');
   const reportsTo=item.level===1?'Owner':normalizePosition(item.reportsTo);
   if(!reportsTo||reportsTo===name||reportsTo==='Developer')return fail('აირჩიე ზემდგომი თანამდებობა.');
   memberships.push({departmentId:item.departmentId,level:item.level,reportsTo});
  }
  if(name==='Owner'&&memberships.length)return fail('დამფუძნებელი ყველა დეპარტამენტის ზემდგომია და ყოველთვის 0 დონეა.');
  if(body.active!==undefined&&typeof body.active!=='boolean')return fail('შტატის სტატუსი არასწორია.');
  const active=typeof body.active==='boolean'?body.active:current?.active??true;
  const departmentId=name==='Owner'?'leadership':memberships[0]?.departmentId||'other',rank=name==='Owner'?0:memberships[0]?.level||1,reportsTo=name==='Owner'?null:memberships[0]?.reportsTo||'Owner';
  const structure=allRoles.filter(r=>r.name!==(current?.name||name)).map(r=>({...r,memberships:r.memberships.map(m=>({...m,reportsTo:m.reportsTo===current?.name?name:m.reportsTo}))}));
  structure.push({name,memberships} as Position);
  for(const role of structure)for(const membership of role.memberships){
   if(membership.reportsTo==='Owner')continue;
   const parent=structure.find(r=>r.name===membership.reportsTo)?.memberships.find(m=>m.departmentId===membership.departmentId);
   if(!parent||parent.level>=membership.level)return fail('ხელმძღვანელი იმავე დეპარტამენტში უფრო მაღალ დონეზე უნდა იყოს.');
  }
  const requested=body.permissions===undefined?current?.permissions||[]:body.permissions;
  if(!Array.isArray(requested)||requested.length>permissionKeys.length||requested.some(key=>typeof key!=='string'||!permissionKeys.includes(key as PermissionKey)))return fail('უფლებების ჩამონათვალი არასწორია.');
  const permissions=[...new Set(requested)] as PermissionKey[];
  const denied=validatePermissionGrant(access,name,permissions);if(denied)return fail(denied,403);
  const row:Position={name,active,system:current?.system||false,departmentId,rank,reportsTo,permissions,deleted:false,memberships};
  const writes=[DB.prepare('INSERT INTO staff_positions (name,is_active,is_deleted,department_id,hierarchy_rank,reports_to,permissions_json,memberships_json,created,updated,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET is_active=excluded.is_active,is_deleted=0,department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to,permissions_json=excluded.permissions_json,memberships_json=excluded.memberships_json,updated=excluded.updated,updated_by=excluded.updated_by').bind(name,active?1:0,0,departmentId,rank,reportsTo,JSON.stringify(permissions),JSON.stringify(memberships),now,now,access.email)];
  if(current&&current.name!==name){
   for(const role of structure.filter(r=>r.name!==name))writes.push(DB.prepare('UPDATE staff_positions SET memberships_json=?,reports_to=CASE WHEN reports_to=? THEN ? ELSE reports_to END WHERE name=?').bind(JSON.stringify(role.memberships),current.name,name,role.name));
   writes.push(DB.prepare('UPDATE admin_users SET role=? WHERE role=?').bind(name,current.name),DB.prepare('UPDATE team_members SET role=?,updated=? WHERE role=?').bind(name,now,current.name),DB.prepare('UPDATE employees SET position=?,updated=? WHERE position=?').bind(name,now,current.name),DB.prepare('UPDATE staff_positions SET is_active=0,is_deleted=1,updated=?,updated_by=? WHERE name=?').bind(now,access.email,current.name));
  }
  writes.push(DB.prepare('INSERT INTO workspace_audit (id,actor,action,target,details,created) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),access.email,action==='create'?'position.create':'position.update',current?.name||name,JSON.stringify({name:row.name,active:row.active,departmentId:row.departmentId,rank:row.rank,memberships:row.memberships,permissions:row.permissions}),now));
  await DB.batch(writes);
  return Response.json(await payload(access));
 }catch(reason){console.error('Position update failed',reason);return fail('ცვლილება ვერ შეინახა.',503)}
}
export async function POST(req:Request){return change(req,'create')}
export async function PATCH(req:Request){return change(req,'update')}
export async function DELETE(req:Request){return change(req,'delete')}
