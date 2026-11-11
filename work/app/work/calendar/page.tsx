import {notFound} from 'next/navigation';
import {requireApprovedStaff} from '@/lib/staff-access';
import {hasPermission} from '@/lib/permissions';
import {validIsoDate} from '@/lib/staff-calendar';
import StaffCalendar from '@/app/team/staff-calendar';
import StaffHeader from '@/app/team/staff-header';
export const dynamic='force-dynamic';
export default async function CalendarPage({searchParams}:{searchParams:Promise<{date?:string}>}){
 const actor=await requireApprovedStaff('/work/calendar');
 if(!hasPermission(actor,'calendar.view'))notFound();
 const date=(await searchParams).date;
 return <main className="staff-shell hm-work-calendar"><StaffHeader access={actor} active="team"/><StaffCalendar initialDate={date&&validIsoDate(date)?date:undefined}/></main>;
}
