import {getSiteFeatures} from './site-controls-store';
import {attendancePlan,localDate,localTime,officeConfig} from './attendance';
import {salaryEvents} from './calendar-payday';
import {listApprovedStaff} from './staff-access';
import {noticeStatements} from './notifications';
import {storage} from './storage';

/** Repeated invocations catch up only within the current Tbilisi date. */
export async function produceScheduledNotices(now=Date.now()){
 const date=localDate(now),time=localTime(now),db=storage().DB;
 if(time<'10:00')return {date,created:0};
 const features=await getSiteFeatures();if(!features.notifications)return {date,created:0};
 const [people,salaries,office,answers]=await Promise.all([
  listApprovedStaff(),salaryEvents(date,date),officeConfig(),
  db.prepare('SELECT user_id FROM attendance_requests WHERE work_date=?').bind(date).all<{user_id:string}>(),
 ]);
 const answered=new Set(answers.results.map(row=>row.user_id)),statements:D1PreparedStatement[]=[];
 for(const person of people){
  if(!person.userId)continue;
  if(salaries.some(event=>event.start_date===date))statements.push(...noticeStatements([person.userId],{key:'salary-reminder:'+date,category:'salary',title:'დღეს ხელფასის დღეა',body:'Hungryman Work · კალენდარი',target:'calendar',targetId:date,important:true,created:now}));
  if(!features.attendance||time<'13:00'||!office||answered.has(person.userId))continue;
  const [day]=await attendancePlan(person.email,person.userId,date,date);
  if(day?.planned==='work'&&day.mode==='pending'&&!day.firstArrival)statements.push(...noticeStatements([person.userId],{key:'attendance-reminder:'+date,category:'attendance_prompt',title:'აგვიანებ?',body:'აირჩიე პასუხი — HR მიიღებს შენს მოთხოვნას.',target:'attendance',targetId:date,created:now}));
 }
 let created=0;for(let index=0;index<statements.length;index+=50){const results=await db.batch(statements.slice(index,index+50));created+=results.reduce((sum,result)=>sum+Number(result.meta.changes||0),0)}
 return {date,created};
}
