import {publicRole} from '@/lib/site-controls';
import {getAdminAccess} from '@/lib/admin';
import {getDepartments,departmentForRole} from '@/lib/departments';
import {getPositions} from '@/lib/positions';
import {hasPermission} from '@/lib/permissions';
import {listApprovedStaff} from '@/lib/staff-access';

export const dynamic='force-dynamic';
export async function GET(){
 const access=await getAdminAccess();
 if(!hasPermission(access,'departments.view'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 const [departments,roles,staff]=await Promise.all([getDepartments(),getPositions(),listApprovedStaff()]);
 const positions=roles.map(({name,active,departmentId,rank,reportsTo,memberships})=>({name,active,departmentId,rank,reportsTo,memberships}));
 const people=staff.map(p=>({userId:p.userId,name:p.fullName,role:publicRole(p.role),departmentId:positions.find(r=>r.name===publicRole(p.role))?.departmentId||departmentForRole(publicRole(p.role))}));
 return Response.json({departments,positions,people},{headers:{'Cache-Control':'private, no-store'}});
}
