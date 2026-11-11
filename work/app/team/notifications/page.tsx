import {requireApprovedStaff} from '@/lib/staff-access';
import StaffHeader from '../staff-header';
import {NotificationInbox} from '@/components/work-notifications';
export const dynamic='force-dynamic';
export default async function Page(){const a=await requireApprovedStaff('/team/notifications');return <main className="staff-shell"><StaffHeader access={a} active="team"/><NotificationInbox/></main>}
