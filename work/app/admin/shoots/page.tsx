import {hasPermission} from '@/lib/permissions';
import {redirect} from 'next/navigation';
import {getAdminAccess} from '@/lib/admin';
import {listApprovedStaff,requireApprovedStaff,syncStaffProfile} from '@/lib/staff-access';
import {listShootsWithTasks} from '@/lib/shoots';
import ShootsClient from '@/app/shoots/shoots-client';
import AdminHeader from '../admin-header';

export const dynamic='force-dynamic';

export default async function AdminShootsPage(){
 const staff=await syncStaffProfile(await requireApprovedStaff('/admin/shoots'));
 if(!staff.canAccessAdmin||!hasPermission(staff,'shoots.view'))redirect('/shoots');
 const adminAccess=await getAdminAccess();
 if(!adminAccess?.canAccessAdmin)redirect('/shoots');
 const [shoots,people]=await Promise.all([listShootsWithTasks(),listApprovedStaff()]);
 return <main className="admin-shell shoots-page"><AdminHeader access={adminAccess} active="shoots" isOwner={adminAccess.isOwner} canManagePeople={adminAccess.canManageEmployees}/><div className="admin-heading"><div><p className="eyebrow">გუნდის მართვა</p><h1>გადაღებების გეგმა</h1><p className="lead">თარიღები, მდებარეობა, მონაწილეები და თითოეული ადამიანის დავალება.</p></div></div><ShootsClient canWorkFlow={staff.features?.work!==false} initialShoots={shoots} people={people} canCreate={staff.canCreateShoots} canEdit={staff.canEditShoots} canDelete={hasPermission(staff,'shoots.delete')}/></main>;
}
