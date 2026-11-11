import {publicRole} from '@/lib/site-controls';
import {birthdayEvents} from '@/lib/birthdays';
import {getStaffAccess,listApprovedStaff} from '@/lib/staff-access';
import {hasPermission} from '@/lib/permissions';
import {salaryEvents} from '@/lib/calendar-payday';
import {appliesOn,eachDate,validIsoDate,type ManagedCalendarEvent,type WorkPatternRow} from '@/lib/staff-calendar';
import {storage} from '@/lib/storage';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const access=await getStaffAccess();if(!access?.isApproved||!hasPermission(access,'calendar.view'))return Response.json({error:'კალენდრის ნახვის უფლება საჭიროა.'},{status:403});
 try{
  const url=new URL(req.url),from=url.searchParams.get('from')||monthEdge(0),to=url.searchParams.get('to')||monthEdge(1);if(!validIsoDate(from)||!validIsoDate(to)||to<from||daySpan(from,to)>370)return Response.json({error:'თარიღები არასწორია ან დიაპაზონი ზედმეტად დიდია.'},{status:400});
  const {DB}=storage();
  const [{results:calendar},{results:shoots},{results:workPatterns},{results:birthdays}]=await Promise.all([
   DB.prepare(`SELECT id,kind,title,start_date,end_date,employee_email,employee_name,recurring_yearly,visibility,start_time,end_time,duration_minutes
    FROM staff_calendar_events WHERE (recurring_yearly=1 OR (end_date>=? AND start_date<=?)) AND (visibility='all' OR lower(employee_email)=?) ORDER BY start_date,title`).bind(from,to,access.email).all<ManagedCalendarEvent>(),
   DB.prepare("SELECT id,title,shoot_date,start_time,end_time,location_name,content_kind FROM shoots WHERE status!='cancelled' AND shoot_date>=? AND shoot_date<=? ORDER BY shoot_date,start_time").bind(from,to).all<{id:string;title:string;shoot_date:string;start_time:string;end_time:string|null;location_name:string;content_kind:string}>(),
   DB.prepare(`SELECT id,employee_email,employee_name,effective_from,effective_to,schedule_json,break_minutes,created,created_by,updated,updated_by
    FROM staff_work_patterns WHERE lower(employee_email)=? AND effective_from<=? AND (effective_to IS NULL OR effective_to>=?) ORDER BY effective_from`).bind(access.email,to,from).all<WorkPatternRow>(),
   DB.prepare('SELECT id,full_name,birth_date FROM employees ORDER BY full_name').all<{id:string;full_name:string;birth_date:string}>(),
  ]);
  const shootEvents=shoots.map(shoot=>({id:shoot.id,kind:shoot.content_kind==='short'?'shorts' as const:'shoot' as const,title:shoot.title,start_date:shoot.shoot_date,end_date:shoot.shoot_date,employee_email:null,employee_name:null,recurring_yearly:0,visibility:'all' as const,start_time:shoot.start_time,end_time:shoot.end_time,duration_minutes:null,location_name:shoot.location_name,href:'/shoots'+(shoot.content_kind==='short'?'?kind=short':'')+'#shoot-'+shoot.id}));
  const dates=eachDate(from,to),visibleCalendar=calendar.filter(event=>!event.recurring_yearly||dates.some(date=>appliesOn(event,date)));
  const [salaries,people]=await Promise.all([salaryEvents(from,to),access.canManageCalendar?listApprovedStaff():Promise.resolve([])]);
  return Response.json({events:[...visibleCalendar,...shootEvents,...salaries,...birthdayEvents(birthdays,from,to)],workPatterns,people:people.map(({email,fullName,role})=>({email,fullName,role:publicRole(role)})),canManage:access.canManageCalendar,canCreateShoots:access.canCreateShoots,canWriteNotes:hasPermission(access,'cabinet.notes')},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'კალენდარი დროებით მიუწვდომელია.'},{status:503})}
}
function monthEdge(offset:number){const now=new Date(),date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+offset,offset?0:1));return date.toISOString().slice(0,10)}
function daySpan(from:string,to:string){return (Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000}
