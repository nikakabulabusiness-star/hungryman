import {storage} from './storage';
import {localDate,attendancePlan} from './attendance';
import {appliesOn,defaultSchedule,eachDate,monthRange,parseSchedule,patternForDate,weekday,eventOvertimeHours,type ManagedCalendarEvent,type WorkPatternRow,type LeaveEntitlementRow} from './staff-calendar';
export const timeOffLabels={leave:'შვებულება',day_off:'დეი ოფი',sick:'ბიულეტენი'} as const;
export type TimeOffKind=keyof typeof timeOffLabels;
export type TimeOffRequest={id:string;user_id:string;email:string;employee_name:string;kind:TimeOffKind;start_date:string;end_date:string;comment:string;status:'pending'|'approved'|'rejected'|'cancelled';created:number;resolved:number|null;resolved_by:string|null;response:string;seen:number|null};
export function canReviewTimeOff(role:string|null){return ['HR','Owner','Developer'].includes(role||'')}
export function calculateBalances(email:string,year:number,events:ManagedCalendarEvent[],patterns:WorkPatternRow[],entitlement:LeaveEntitlementRow|null,dayOffAllowance:number|null,now=localDate()){
 const counts={leave:0,day_off:0,sick:0},reserved={leave:0,day_off:0,sick:0};
 for(const date of eachDate(`${year}-01-01`,`${year}-12-31`)){const matching=events.filter(e=>appliesOn(e,date)),own=matching.filter(e=>e.employee_email?.toLowerCase()===email.toLowerCase()),pattern=patternForDate(patterns,email,date),work=(pattern?parseSchedule(pattern.schedule_json):defaultSchedule())[weekday(date)],holiday=matching.some(e=>e.kind==='holiday'||e.kind==='day_off'&&e.visibility==='all');
 // Sick leave counts calendar days. Vacation/day off count scheduled workdays, once per day.
 for(const kind of ['sick','leave','day_off'] as const){if(!own.some(e=>e.kind===kind)||kind!=='sick'&&(!work||holiday))continue;if(date<=now)counts[kind]++;else reserved[kind]++;break}}
 const allowance=Number(entitlement?.allowance_days??24)+Number(entitlement?.carryover_days??0);
 return {year,leave:{allowance,used:counts.leave,reserved:reserved.leave,remaining:Math.max(0,allowance-counts.leave-reserved.leave)},dayOff:{allowance:dayOffAllowance,used:counts.day_off,reserved:reserved.day_off,remaining:dayOffAllowance==null?null:Math.max(0,dayOffAllowance-counts.day_off-reserved.day_off)},sick:{allowance:30,used:counts.sick,reserved:reserved.sick,remaining:Math.max(0,30-counts.sick-reserved.sick)}};
}
export async function cabinetStats(email:string,userId:string,month:string){const range=monthRange(month);if(!range)throw Error('Invalid month');const db=storage().DB,from=`${range.year}-01-01`,to=`${range.year}-12-31`,now=localDate();const [e,p,l,d,days]=await Promise.all([
 db.prepare("SELECT * FROM staff_calendar_events WHERE (recurring_yearly=1 OR (end_date>=? AND start_date<=?)) AND (visibility='all' OR lower(employee_email)=?)").bind(from,to,email).all<ManagedCalendarEvent>(),
 db.prepare('SELECT * FROM staff_work_patterns WHERE lower(employee_email)=? AND effective_from<=? AND (effective_to IS NULL OR effective_to>=?)').bind(email,to,from).all<WorkPatternRow>(),
 db.prepare('SELECT * FROM staff_leave_entitlements WHERE employee_email=? AND year=?').bind(email,range.year).first<LeaveEntitlementRow>(),
 db.prepare('SELECT days FROM staff_day_off_entitlements WHERE email=? AND year=?').bind(email,range.year).first<{days:number}>(),attendancePlan(email,userId,range.from,range.to)]);
 const actual=days.filter(d=>d.date<=now),workedDays=actual.filter(d=>['office','remote','shoot'].includes(d.mode)).length,workedHours=Math.round(actual.reduce((s,d)=>s+d.officeMinutes,0)/60*10)/10,overtimeHours=Math.round(e.results.filter(e=>e.kind==='overtime'&&e.employee_email?.toLowerCase()===email&&e.start_date>=range.from&&e.start_date<=range.to&&e.start_date<=now).reduce((s,e)=>s+eventOvertimeHours(e),0)*10)/10;
 return {month,workedDays,workedHours,overtimeHours,remoteDays:actual.filter(d=>d.mode==='remote').length,shootDays:actual.filter(d=>d.mode==='shoot').length,...calculateBalances(email,range.year,e.results,p.results,l,d?.days??null,now)};
}
