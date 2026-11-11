import {DEVELOPER_EMAIL,getAdminAccess} from '@/lib/admin';
import {staffGroupingDefinitions,departmentForRole} from '@/lib/departments';
import {canDeleteAccount,canManageRole,hasPermission} from '@/lib/permissions';
import {getPositions} from '@/lib/positions';
import {storage} from '@/lib/storage';
import type {TeamRole,TeamStatus} from '@/lib/team-roles';
import AccessManager from './access-manager';

export const dynamic='force-dynamic';
type AccountRow={email:string;full_name:string;role:TeamRole|null;status:TeamStatus;created:number};

export default async function AccessPage(){
 const access=await getAdminAccess();
 if(!access)return <main><h1>ანგარიშების მართვა</h1><a className="action" href="/team/auth?return_to=/admin/access">ავტორიზაცია</a></main>;
 if(!hasPermission(access,'accounts.view'))return <main><h1>წვდომა შეზღუდულია</h1><p>ანგარიშებისა და რეგისტრაციის მოთხოვნების ნახვის უფლება არ გაქვს.</p><a className="action" href="/admin">ადმინისტრატორის პანელი</a></main>;
 let rows:AccountRow[];
 try{rows=(await storage().DB.prepare(`
  SELECT t.email,t.full_name,COALESCE(a.role,t.role) AS role,t.status,t.created
  FROM team_members t
  LEFT JOIN admin_users a ON lower(a.email)=lower(t.email)
  WHERE t.password_hash IS NOT NULL
  ORDER BY CASE t.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,t.created DESC
 `).all<AccountRow>()).results}
 catch{return <main><h1>ანგარიშების სია დროებით მიუწვდომელია</h1><a className="action" href="/admin/access">სცადე ხელახლა</a></main>}

 const positions=await getPositions(),positionMap=new Map(positions.map(position=>[position.name,position])),departmentNames=new Map<string,string>(staffGroupingDefinitions.map(item=>[item.id,item.name]));
 const canManage=hasPermission(access,'accounts.manage')&&(access.isDeveloper||access.isSiteAdmin||['Owner','HR'].includes(access.role||''));
 const availableRoles=canManage?positions.filter(position=>position.active&&canManageRole(access,position.name)).map(position=>position.name):[];
 const roleDepartments=Object.fromEntries(positions.map(position=>[position.name,departmentNames.get(position.departmentId)||'სხვა პოზიციები']));
 const initialAccounts=rows.map(row=>{
  const isDeveloper=row.email.toLowerCase()===DEVELOPER_EMAIL,role=isDeveloper?'Developer':row.role,status=isDeveloper?'approved':row.status;
  const departmentId=positionMap.get(role||'')?.departmentId||departmentForRole(role);
  return {
   email:row.email,
   fullName:row.full_name,
   role:!access.isDeveloper&&role==='Developer'?'თანამშრომელი':role,
   status:status as TeamStatus,
   created:row.created,
   department:departmentNames.get(departmentId)||'სხვა პოზიციები',
   canManage:canManage&&!isDeveloper&&(!role||canManageRole(access,role)),
   canDelete:canDeleteAccount(access,role,row.email),
   isSelf:row.email.toLowerCase()===access.email.toLowerCase(),
  };
 });
 return <AccessManager viewerIsOwner={access.isOwner} viewerEmail={access.email} initialAccounts={initialAccounts} availableRoles={availableRoles} roleDepartments={roleDepartments}/>;
}
