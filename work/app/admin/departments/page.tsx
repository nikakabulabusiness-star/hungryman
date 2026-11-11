import {redirect} from 'next/navigation';
import {getAdminAccess} from '@/lib/admin';
import {getDepartments,plannedDepartmentMembers} from '@/lib/departments';
import {getPositions} from '@/lib/positions';
import {hasPermission} from '@/lib/permissions';
import {listApprovedStaff} from '@/lib/staff-access';
import AdminHeader from '../admin-header';
import DepartmentsManager from './departments-manager';
import '../positions/roles.css';
export const dynamic='force-dynamic';
export default async function DepartmentsPage(){
 const access=await getAdminAccess();if(!access||!hasPermission(access,'departments.view'))redirect('/team');
 const [departments,positions,people]=await Promise.all([getDepartments(),getPositions(),listApprovedStaff()]);
 return <main className="admin-shell"><AdminHeader active="departments" isOwner={access.isOwner} canManagePeople={access.canManageAccess} access={access}/><div className="admin-heading"><div><p className="eyebrow">გუნდი და სუბორდინაცია</p><h1>დეპარტამენტები</h1><p className="lead">ხელმძღვანელები, გუნდები და როლების იერარქია.</p></div></div><DepartmentsManager initialDepartments={departments} positions={positions} people={people.map(p=>({userId:p.userId,name:p.fullName,role:p.role}))} planned={[...plannedDepartmentMembers].map(p=>({...p,capabilities:[...p.capabilities]}))} canManage={hasPermission(access,'departments.manage')}/></main>;
}
