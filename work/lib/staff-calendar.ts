export const calendarEventKinds=['leave','day_off','sick','overtime','holiday','info'] as const;
export type ManagedCalendarKind=typeof calendarEventKinds[number];
export type CalendarVisibility='all'|'individual';
export type WorkDay={start:string;end:string};
export type WorkSchedule=Partial<Record<'1'|'2'|'3'|'4'|'5'|'6'|'7',WorkDay>>;

export type ManagedCalendarEvent={
 id:string;kind:ManagedCalendarKind;title:string;start_date:string;end_date:string;
 employee_email:string|null;employee_name:string|null;recurring_yearly:number;
 visibility:CalendarVisibility;start_time:string|null;end_time:string|null;duration_minutes:number|null;
};
export type SalaryCalendarEvent=Omit<ManagedCalendarEvent,'kind'>&{kind:'salary'};

export type WorkPatternRow={
 id:string;employee_email:string;employee_name:string;effective_from:string;effective_to:string|null;
 schedule_json:string;break_minutes:number;created:number;created_by:string;updated:number;updated_by:string;
};

export type LeaveEntitlementRow={employee_email:string;year:number;allowance_days:number;carryover_days:number;updated:number;updated_by:string};
export type CalendarMetric={email:string;fullName:string;role:string;workedDays:number;workedHours:number;restDays:number;overtimeHours:number;leaveDays:number;leaveRemaining:number};
export type MonthCalendarTotals={workDays:number;workHours:number;restDays:number};

const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const timePattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
export function validIsoDate(value:string){if(!datePattern.test(value))return false;const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d}
export function validTime(value:string){return timePattern.test(value)}
export function monthRange(month:string){if(!/^\d{4}-\d{2}$/.test(month))return null;const [year,index]=month.split('-').map(Number);if(index<1||index>12)return null;return {year,from:`${year}-${String(index).padStart(2,'0')}-01`,to:isoDate(new Date(Date.UTC(year,index,0)))}}
export function isoDate(date:Date){return date.toISOString().slice(0,10)}
export function addDays(value:string,days:number){const [y,m,d]=value.split('-').map(Number);return isoDate(new Date(Date.UTC(y,m-1,d+days)))}
export function eachDate(from:string,to:string){const dates:string[]=[];for(let value=from;value<=to;value=addDays(value,1))dates.push(value);return dates}
export function weekday(value:string){const [y,m,d]=value.split('-').map(Number),day=new Date(Date.UTC(y,m-1,d)).getUTCDay();return String(day===0?7:day) as keyof WorkSchedule}
export function defaultSchedule():WorkSchedule{return {'1':{start:'11:00',end:'19:00'},'2':{start:'11:00',end:'19:00'},'3':{start:'11:00',end:'19:00'},'4':{start:'11:00',end:'19:00'},'5':{start:'11:00',end:'19:00'}}}
export function parseSchedule(value:string):WorkSchedule{try{const parsed=JSON.parse(value) as Record<string,unknown>;if(!parsed||typeof parsed!=='object')return {};const schedule:WorkSchedule={};for(const key of ['1','2','3','4','5','6','7'] as const){const day=parsed[key] as {start?:unknown;end?:unknown}|undefined;if(day&&validTime(String(day.start||''))&&validTime(String(day.end||''))&&String(day.end)>String(day.start))schedule[key]={start:String(day.start),end:String(day.end)}}return schedule}catch{return {}}}
export function validateSchedule(value:unknown){if(!value||typeof value!=='object')return null;const schedule:WorkSchedule={};for(const key of ['1','2','3','4','5','6','7'] as const){const raw=(value as Record<string,unknown>)[key];if(raw==null)continue;if(!raw||typeof raw!=='object')return null;const start=String((raw as Record<string,unknown>).start||''),end=String((raw as Record<string,unknown>).end||'');if(!validTime(start)||!validTime(end)||end<=start)return null;schedule[key]={start,end}}return Object.keys(schedule).length?schedule:null}
export function appliesOn(event:Pick<ManagedCalendarEvent,'start_date'|'end_date'|'recurring_yearly'>,date:string){if(!event.recurring_yearly)return date>=event.start_date&&date<=event.end_date;const current=Number(date.slice(5).replace('-','')),from=Number(event.start_date.slice(5).replace('-','')),to=Number(event.end_date.slice(5).replace('-',''));return from<=to?current>=from&&current<=to:current>=from||current<=to}
export function salaryDate(year:number,monthIndex:number){const date=new Date(Date.UTC(year,monthIndex-1,26)),day=date.getUTCDay();if(day===6)date.setUTCDate(28);else if(day===0)date.setUTCDate(27);return isoDate(date)}
export function virtualSalaryEvents(from:string,to:string,overrides:Record<string,string>={}){const start=monthRange(from.slice(0,7)),end=monthRange(to.slice(0,7));if(!start||!end)return [];const events:SalaryCalendarEvent[]=[];for(let year=start.year,month=Number(from.slice(5,7));year<end.year||year===end.year&&month<=Number(to.slice(5,7));){const key=`${year}-${String(month).padStart(2,'0')}`,override=overrides[key],date=override&&validIsoDate(override)&&override.slice(0,7)===key?override:salaryDate(year,month);if(date>=from&&date<=to)events.push({id:`salary-${date}`,kind:'salary',title:'ხელფასი',start_date:date,end_date:date,employee_email:null,employee_name:null,recurring_yearly:0,visibility:'all',start_time:null,end_time:null,duration_minutes:null});month++;if(month===13){month=1;year++}}return events}

/** A reschedule never rewrites a payday which has already passed. */
export function canRescheduleSalary(date:string,currentDate:string,today:string){return validIsoDate(date)&&validIsoDate(currentDate)&&validIsoDate(today)&&date.slice(0,7)===currentDate.slice(0,7)&&date>=today&&currentDate>=today}
export function patternForDate(patterns:WorkPatternRow[],email:string,date:string){return patterns.filter(item=>item.employee_email.toLowerCase()===email.toLowerCase()&&item.effective_from<=date&&(!item.effective_to||item.effective_to>=date)).sort((a,b)=>b.effective_from.localeCompare(a.effective_from)||b.updated-a.updated)[0]}
export function durationHours(start:string,end:string,breakMinutes=0){const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number);return Math.max(0,(eh*60+em-sh*60-sm-breakMinutes)/60)}
export function eventOvertimeHours(event:ManagedCalendarEvent){if(event.duration_minutes!=null)return Math.max(0,event.duration_minutes)/60;if(event.start_time&&event.end_time)return durationHours(event.start_time,event.end_time);return 0}

/** Count the common monthly calendar once, independently of staff headcount or personal schedules. */
export function monthCalendarTotals(from:string,to:string,events:ManagedCalendarEvent[]):MonthCalendarTotals{
 const schedule=defaultSchedule(),days=eachDate(from,to),sharedDaysOff=events.filter(event=>event.visibility==='all'&&(event.kind==='holiday'||event.kind==='day_off'));
 let workDays=0,workHours=0;
 for(const date of days){const work=schedule[weekday(date)];if(!work||sharedDaysOff.some(event=>appliesOn(event,date)))continue;workDays++;workHours+=durationHours(work.start,work.end)}
 return {workDays,workHours:Math.round(workHours*100)/100,restDays:days.length-workDays};
}
