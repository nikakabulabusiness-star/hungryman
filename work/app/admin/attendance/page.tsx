import {hasPermission} from '@/lib/permissions';
import {getAdminAccess} from '@/lib/admin';
import AdminHeader from '../admin-header';
import AttendanceManager from '@/components/attendance-manager';
export const dynamic='force-dynamic';
export default async function AttendancePage(){const access=await getAdminAccess();if(!access||!hasPermission(access,'attendance.view'))return <main><h1>წვდომა შეზღუდულია</h1><a href="/team">ჩემი კაბინეტი</a></main>;return <main className="admin-shell"><AdminHeader access={access} active="attendance" isOwner={access.isOwner} canManagePeople/><h1>ოფისი და დასწრება</h1><AttendanceManager canManageOffice={hasPermission(access,'office.manage')} canManageAttendance={hasPermission(access,'attendance.manage')}/></main>}
