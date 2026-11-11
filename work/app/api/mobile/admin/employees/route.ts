import {hasPermission} from '@/lib/permissions';
import {getAdminAccess} from '@/lib/admin';
import {storage} from '@/lib/storage';
import {canEditEmployee,employeeRole} from '@/lib/employee-policy';
import {getPositions} from '@/lib/positions';
import {departmentForRole,hierarchyForRole,defaultMemberships} from '@/lib/departments';
export const dynamic='force-dynamic';
export async function GET(){
 const access=await getAdminAccess();
 if(!hasPermission(access,'employees.view'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 const [rows,positions]=await Promise.all([
  storage().DB.prepare('SELECT e.id,e.full_name,e.birth_date,e.personal_number,e.email,e.phone,e.position,COALESCE(a.role,t.role) AS account_role FROM employees e LEFT JOIN admin_users a ON lower(a.email)=lower(e.email) LEFT JOIN team_members t ON lower(t.email)=lower(e.email) ORDER BY e.full_name').all<{id:string;full_name:string;birth_date:string;personal_number:string;email:string;phone:string;position:string;account_role:string|null}>(),
  getPositions(),
 ]);
 const employees=rows.results.map(row=>{const role=row.account_role||employeeRole(row.position),position=positions.find(p=>p.name===role);return {...row,canManage:canEditEmployee(access,role,row.email),departmentId:position?.departmentId||departmentForRole(role),rank:position?.rank??hierarchyForRole(role),memberships:position?.memberships??defaultMemberships(role)}});
 return Response.json({employees},{headers:{'Cache-Control':'private, no-store'}});
}
