import {requireApprovedStaff} from '@/lib/staff-access';
import StaffHeader from '@/app/team/staff-header';
import WorkHub from './work-hub';
export const dynamic='force-dynamic';
export default async function WorkPage(){
 const access=await requireApprovedStaff('/work');
 return <main className="staff-shell hm-work-home"><StaffHeader access={access} active="team"/><WorkHub actor={access}/></main>;
}
