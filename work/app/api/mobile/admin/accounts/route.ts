import {DEVELOPER_EMAIL,getAdminAccess} from '@/lib/admin';
import {staffGroupingDefinitions,departmentForRole} from '@/lib/departments';
import {canDeleteAccount,canManageRole,hasPermission,permissionKeys} from '@/lib/permissions';
import {getPositions} from '@/lib/positions';
import {storage} from '@/lib/storage';

export const dynamic='force-dynamic';
type AccountRow={email:string;fullName:string;role:string|null;status:string;created:number};

export async function GET(){
 const access=await getAdminAccess();
 if(!hasPermission(access,'accounts.view'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 const [rows,positions]=await Promise.all([
  storage().DB.prepare(`SELECT t.email,t.full_name AS fullName,COALESCE(a.role,t.role) AS role,t.status,t.created
   FROM team_members t LEFT JOIN admin_users a ON lower(a.email)=lower(t.email)
   WHERE t.password_hash IS NOT NULL
   ORDER BY CASE t.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,t.created DESC`).all<AccountRow>(),
  getPositions(),
 ]);
 const departments=new Map<string,string>(staffGroupingDefinitions.map(item=>[item.id,item.name])),positionMap=new Map(positions.map(position=>[position.name,position]));
 const canManageAccounts=hasPermission(access,'accounts.manage')&&(access!.isDeveloper||access!.isSiteAdmin||['Owner','HR'].includes(access!.role||''));
 const accounts=rows.results.map(row=>{
  const developer=row.email.toLowerCase()===DEVELOPER_EMAIL,role=developer?'Developer':row.role,departmentId=positionMap.get(role||'')?.departmentId||departmentForRole(role);
  const inherited=developer?permissionKeys:positionMap.get(role||'')?.permissions||[];
  return {...row,role:!access!.isDeveloper&&developer?'თანამშრომელი':role,status:developer?'approved':row.status,department:departments.get(departmentId)||'სხვა პოზიციები',canManage:canManageAccounts&&!developer&&(!role||canManageRole(access!,role)),canDelete:canDeleteAccount(access,role,row.email),isSelf:row.email.toLowerCase()===access!.email.toLowerCase(),canCreateShoots:inherited.includes('shoots.create'),canEditShoots:inherited.includes('shoots.edit')};
 });
 const roles=canManageAccounts?positions.filter(position=>position.active&&canManageRole(access!,position.name)).map(position=>position.name):[];
 return Response.json({accounts,roles,permissions:{canManage:canManageAccounts,canDelete:hasPermission(access,'accounts.delete')}},{headers:{'Cache-Control':'private, no-store'}});
}
