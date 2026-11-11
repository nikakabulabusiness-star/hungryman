import {getAdminAccess} from '@/lib/admin';
import {getDepartments,founderLabel,hierarchyInDepartment} from '@/lib/departments';
import {getPositions} from '@/lib/positions';
import {hasPermission} from '@/lib/permissions';
import {listApprovedStaff} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
export const dynamic='force-dynamic';
export async function GET(){const access=await getAdminAccess();if(!hasPermission(access,'departments.view'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});try{return Response.json({departments:await getDepartments()})}catch{return Response.json({error:'დეპარტამენტები ვერ ჩაიტვირთა.'},{status:503})}}
export async function PATCH(req:Request){
 const access=await getAdminAccess();if(!access||!hasPermission(access,'departments.view')||!hasPermission(access,'departments.manage')||!sameOrigin(req))return Response.json({error:'დეპარტამენტის მართვის უფლება არ გაქვს.'},{status:403});
 try{
  const body=await req.json() as {id?:unknown;headName?:unknown;directorName?:unknown;headUserId?:unknown;directorUserId?:unknown};
  const id=typeof body.id==='string'?body.id:'',department=(await getDepartments()).find(d=>d.id===id);
  if(!department)return Response.json({error:'დეპარტამენტი ვერ მოიძებნა.'},{status:404});
  const headName=founderLabel;let directorName=department.directorName;
  const topRoles=hierarchyInDepartment(await getPositions(),id).filter(r=>r.level===1&&r.active).map(r=>r.name);
  if(headName.length>150||directorName.length>150||/[<>\u0000-\u001f]/.test(headName+directorName))return Response.json({error:'სახელი არასწორია.'},{status:400});
  const headUserId=body.headUserId===undefined?department.headUserId:typeof body.headUserId==='string'?body.headUserId.trim()||null:null;
  const directorUserId=body.directorUserId===undefined?department.directorUserId:typeof body.directorUserId==='string'?body.directorUserId.trim()||null:null;
  const people=await listApprovedStaff();
  if(headUserId){
   const person=people.find(p=>p.userId===headUserId),allowedRoles=['Owner'];
   if(!person||!allowedRoles.includes(person.role))return Response.json({error:'აირჩიე აქტიური დამფუძნებლის ანგარიში.'}, {status:400});

  }
  if(directorUserId){
   const person=people.find(p=>p.userId===directorUserId),expected=person&&topRoles.includes(person.role);
   if(!person||!expected)return Response.json({error:'დირექტორს უნდა ჰქონდეს ამ დეპარტამენტის შესაბამისი მოქმედი შტატი.'},{status:400});
   directorName=person.role;
  }
  const {DB}=storage(),now=Date.now();
  await DB.batch([DB.prepare('UPDATE staff_departments SET head_name=?,director_name=?,head_user_id=?,director_user_id=?,updated=?,updated_by=? WHERE id=?').bind(headName,directorName,headUserId,directorUserId,now,access.email,id),DB.prepare('INSERT INTO workspace_audit (id,actor,action,target,details,created) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),access.email,'department.update',id,JSON.stringify({headName,directorName,headUserId,directorUserId}),now)]);
  return Response.json({departments:await getDepartments()});
 }catch{return Response.json({error:'ცვლილება ვერ შეინახა.'},{status:503})}
}
