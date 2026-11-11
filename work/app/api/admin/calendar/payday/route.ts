import {getAdminAccess} from '@/lib/admin';
import {salaryEvents} from '@/lib/calendar-payday';
import {localDate} from '@/lib/attendance';
import {canRescheduleSalary,monthRange,validIsoDate} from '@/lib/staff-calendar';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';

export const dynamic='force-dynamic';
export async function PUT(req:Request){
 const access=await getAdminAccess();
 if(!access?.canManageCalendar||!sameOrigin(req))return Response.json({error:'კალენდრის მართვის უფლება არ გაქვს.'},{status:403});
 const body=await req.json().catch(()=>null) as {date?:unknown}|null,date=typeof body?.date==='string'?body.date:'';
 if(!validIsoDate(date))return Response.json({error:'აირჩიე სწორი თარიღი.'},{status:400});
 try{
  const range=monthRange(date.slice(0,7))!,current=(await salaryEvents(range.from,range.to))[0]?.start_date,today=localDate();
  if(!current||!canRescheduleSalary(date,current,today))return Response.json({error:'გასული ხელფასის თარიღი უცვლელი რჩება. აირჩიე მომავალი გადახდის თვე და თარიღი.'},{status:409});
  const {DB}=storage(),now=Date.now(),key='salary-date:'+date.slice(0,7);
  await DB.batch([
   DB.prepare('INSERT INTO workspace_settings (key,value,updated,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated,updated_by=excluded.updated_by WHERE workspace_settings.value>=?').bind(key,date,now,access.email,today),
   DB.prepare('INSERT INTO workspace_audit (id,actor,action,target,details,created) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),access.email,'calendar.payday',date.slice(0,7),JSON.stringify({previous:current,date}),now),
  ]);
  return Response.json({ok:true,date,previous:current});
 }catch{return Response.json({error:'ხელფასის თარიღი ვერ შეიცვალა.'},{status:503})}
}
