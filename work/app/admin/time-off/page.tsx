import {requireApprovedStaff} from '@/lib/staff-access';
import {notFound} from 'next/navigation';
import StaffHeader from '@/app/team/staff-header';
import {Requests} from '@/components/cabinet-panel';
import {AttendanceRequests} from '@/components/work-notifications';
import {canReviewRequests} from '@/lib/notification-policy';
export const dynamic='force-dynamic';
export default async function Page(){
 const access=await requireApprovedStaff('/admin/time-off');
 if(!canReviewRequests(access))notFound();
 return <main className="staff-shell"><StaffHeader access={access} active="team"/>
  <div className="work-requests-page"><h1>შემოსული მოთხოვნები</h1>{access.features?.attendance!==false&&<AttendanceRequests/>}
   <section className="work-stack"><h2>შვებულება, დეი ოფი და ბიულეტენი</h2><Requests review/></section>
  </div>
 </main>;
}
