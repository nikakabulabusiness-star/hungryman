import {canManageAbsences} from '@/lib/absence-policy';
import {noticeStatements,dispatchNotices} from '@/lib/notifications';
import {getAdminAccess} from '@/lib/admin';
import {salaryEvents} from '@/lib/calendar-payday';
import {listApprovedStaff} from '@/lib/staff-access';
import {appliesOn,calendarEventKinds,defaultSchedule,durationHours,eachDate,eventOvertimeHours,monthCalendarTotals,monthRange,parseSchedule,patternForDate,validIsoDate,validTime,type CalendarMetric,type CalendarVisibility,type LeaveEntitlementRow,type ManagedCalendarEvent,type WorkPatternRow} from '@/lib/staff-calendar';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const access=await getAdminAccess();if(!access?.canManageCalendar)return Response.json({error:'კალენდრის მართვის უფლება არ გაქვს.'},{status:403});
 const url=new URL(req.url),month=url.searchParams.get('month')||tbilisiMonth(),range=monthRange(month);if(!range)return Response.json({error:'თვე არასწორია.'},{status:400});
 try{
  const {DB}=storage(),yearFrom=`${range.year}-01-01`,yearTo=`${range.year}-12-31`;
  const [{results:yearEvents},{results:patterns},{results:entitlements},people]=await Promise.all([
   DB.prepare(`SELECT id,kind,title,start_date,end_date,employee_email,employee_name,recurring_yearly,visibility,start_time,end_time,duration_minutes
    FROM staff_calendar_events WHERE recurring_yearly=1 OR (end_date>=? AND start_date<=?) ORDER BY start_date,title`).bind(yearFrom,yearTo).all<ManagedCalendarEvent>(),
   DB.prepare(`SELECT id,employee_email,employee_name,effective_from,effective_to,schedule_json,break_minutes,created,created_by,updated,updated_by
    FROM staff_work_patterns WHERE effective_from<=? AND (effective_to IS NULL OR effective_to>=?) ORDER BY employee_email,effective_from`).bind(yearTo,yearFrom).all<WorkPatternRow>(),
   DB.prepare('SELECT employee_email,year,allowance_days,carryover_days,updated,updated_by FROM staff_leave_entitlements WHERE year=?').bind(range.year).all<LeaveEntitlementRow>(),
   listApprovedStaff(),
  ]);
  const metrics=calculateMetrics(people,yearEvents,patterns,entitlements,range.from,range.to,yearFrom,yearTo);
  const monthDates=eachDate(range.from,range.to),events=yearEvents.filter(event=>event.recurring_yearly?monthDates.some(date=>appliesOn(event,date)):event.end_date>=range.from&&event.start_date<=range.to);
  return Response.json({month,events,patterns,entitlements,people,metrics,salaryDate:(await salaryEvents(range.from,range.to))[0]?.start_date,canCreateShoots:access.canCreateShoots,calendarTotals:monthCalendarTotals(range.from,range.to,events)});
 }catch{return Response.json({error:'კალენდრის მართვის მონაცემები დროებით მიუწვდომელია.'},{status:503})}
}

export async function POST(req:Request){
 const access=await getAdminAccess();if(!access?.canManageCalendar)return Response.json({error:'კალენდრის მართვის უფლება არ გაქვს.'},{status:403});
 if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{
  const body=await req.json() as Record<string,unknown>,kind=String(body.kind||''),visibility=String(body.visibility||'individual') as CalendarVisibility,title=String(body.title||'').trim().slice(0,120),startDate=String(body.startDate||''),endDate=String(body.endDate||''),employeeEmail=String(body.employeeEmail||'').trim().toLowerCase(),startTime=nullable(body.startTime),endTime=nullable(body.endTime),durationMinutes=body.durationMinutes==null||body.durationMinutes===''?null:Number(body.durationMinutes),recurring=kind==='holiday'&&body.recurringYearly===true;
  if(['leave','day_off','sick'].includes(kind)&&visibility==='individual'&&!canManageAbsences(access))return Response.json({error:'შვებულების მართვა მხოლოდ HR-სა და დამფუძნებელს შეუძლია.'},{status:403});
  if(!calendarEventKinds.includes(kind as never)||!['all','individual'].includes(visibility)||!validIsoDate(startDate)||!validIsoDate(endDate)||endDate<startDate)return Response.json({error:'კალენდრის მონაცემები არასწორია.'},{status:400});
  if((startTime&&!validTime(startTime))||(endTime&&!validTime(endTime))||Boolean(startTime)!==Boolean(endTime)||startTime&&endTime&&endTime<=startTime||durationMinutes!=null&&(!Number.isFinite(durationMinutes)||durationMinutes<0||durationMinutes>24*60))return Response.json({error:'დროის მონაცემები არასწორია.'},{status:400});
  let employeeName:string|null=null,email:string|null=null,userId:string|null=null;
  if(visibility==='individual'){
   const person=(await listApprovedStaff()).find(item=>item.email.toLowerCase()===employeeEmail);if(!person)return Response.json({error:'აირჩიე აქტიური თანამშრომელი.'},{status:400});employeeName=person.fullName;email=person.email;userId=person.userId;
  }
  if(['leave','sick','overtime'].includes(kind)&&visibility!=='individual')return Response.json({error:'შვებულება, ბიულეტენი და ოვერთაიმი კონკრეტულ თანამშრომელს უნდა მიენიჭოს.'},{status:400});
  if(kind==='holiday'&&visibility!=='all')return Response.json({error:'სახელმწიფო დასვენების დღე ყველასთვის უნდა გამოჩნდეს.'},{status:400});
  if(kind==='overtime'&&startDate!==endDate)return Response.json({error:'ოვერთაიმი ერთ კონკრეტულ დღეზე მიუთითე.'},{status:400});
  const fallback=kind==='sick'?'ბიულეტენი':kind==='leave'?'შვებულება':kind==='overtime'?'ოვერთაიმი':kind==='holiday'?'დასვენების დღე':kind==='day_off'?'დასვენების დღე':'ინფორმაცია',id=crypto.randomUUID(),now=Date.now();
  const insert=storage().DB.prepare(`INSERT INTO staff_calendar_events (id,kind,title,start_date,end_date,employee_user_id,employee_email,employee_name,recurring_yearly,created,created_by,visibility,start_time,end_time,duration_minutes,updated,updated_by)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,kind,title||fallback,startDate,endDate,userId,email,employeeName,recurring?1:0,now,access.email,visibility,startTime,endTime,durationMinutes,now,access.email);
  const notifications=noticeStatements(visibility==='individual'?[userId]:(await listApprovedStaff()).map(p=>p.userId),{key:'calendar-created:'+id,category:kind,title:title||fallback,body:startDate+(startDate!==endDate?' — '+endDate:''),target:'calendar',targetId:startDate,important:['leave','sick','day_off','salary'].includes(kind)});
  await storage().DB.batch([insert,...notifications]);dispatchNotices();
  return Response.json({ok:true,id});
 }catch{return Response.json({error:'კალენდრის ჩანაწერი ვერ დაემატა.'},{status:503})}
}

function nullable(value:unknown){const text=String(value||'').trim();return text||null}
function tbilisiMonth(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tbilisi',year:'numeric',month:'2-digit'}).format(new Date())}

function calculateMetrics(people:Awaited<ReturnType<typeof listApprovedStaff>>,events:ManagedCalendarEvent[],patterns:WorkPatternRow[],entitlements:LeaveEntitlementRow[],monthFrom:string,monthTo:string,yearFrom:string,yearTo:string):CalendarMetric[]{
 const monthDates=eachDate(monthFrom,monthTo),yearDates=eachDate(yearFrom,yearTo),defaults=defaultSchedule();
 return people.map(person=>{
  const email=person.email.toLowerCase(),ownEvents=events.filter(event=>event.visibility==='all'||event.employee_email?.toLowerCase()===email);let workedDays=0,workedHours=0,restDays=0,leaveDays=0;
  for(const date of monthDates){const pattern=patternForDate(patterns,email,date),schedule=pattern?parseSchedule(pattern.schedule_json):defaults,work=schedule[weekdayKey(date)],dayEvents=ownEvents.filter(event=>appliesOn(event,date)),leave=dayEvents.some(event=>event.kind==='leave'&&event.employee_email?.toLowerCase()===email),off=dayEvents.some(event=>(event.kind==='holiday'&&event.visibility==='all')||event.kind==='day_off'&&(event.visibility==='all'||event.employee_email?.toLowerCase()===email));if(!work||leave||off||dayEvents.some(event=>event.kind==='sick'&&event.employee_email?.toLowerCase()===email)){restDays++;if(work&&leave&&!off)leaveDays++;continue}workedDays++;workedHours+=durationHours(work.start,work.end,pattern?.break_minutes||0)}
  let usedLeave=0;for(const date of yearDates){const pattern=patternForDate(patterns,email,date),schedule=pattern?parseSchedule(pattern.schedule_json):defaults,dayEvents=ownEvents.filter(event=>appliesOn(event,date)),leave=dayEvents.some(event=>event.kind==='leave'&&event.employee_email?.toLowerCase()===email),off=dayEvents.some(event=>(event.kind==='holiday'&&event.visibility==='all')||event.kind==='day_off'&&(event.visibility==='all'||event.employee_email?.toLowerCase()===email));if(schedule[weekdayKey(date)]&&leave&&!off)usedLeave++}
  const overtimeHours=events.filter(event=>event.kind==='overtime'&&event.employee_email?.toLowerCase()===email&&event.end_date>=monthFrom&&event.start_date<=monthTo).reduce((sum,event)=>sum+eventOvertimeHours(event),0),entitlement=entitlements.find(item=>item.employee_email.toLowerCase()===email);
  return {email,fullName:person.fullName,role:person.role,workedDays,workedHours:round(workedHours),restDays,overtimeHours:round(overtimeHours),leaveDays,leaveRemaining:round(Math.max(0,(entitlement?.allowance_days??24)+(entitlement?.carryover_days??0)-usedLeave))};
 });
}
function weekdayKey(value:string){const [y,m,d]=value.split('-').map(Number),day=new Date(Date.UTC(y,m-1,d)).getUTCDay();return String(day===0?7:day) as '1'|'2'|'3'|'4'|'5'|'6'|'7'}
function round(value:number){return Math.round(value*100)/100}
