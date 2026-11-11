import {getAdminAccess} from '@/lib/admin';
import {listApprovedStaff} from '@/lib/staff-access';
import {addDays,validIsoDate,validateSchedule} from '@/lib/staff-calendar';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';

export async function PUT(req:Request){
 const access=await getAdminAccess();if(!access?.canManageCalendar)return Response.json({error:'კალენდრის მართვის უფლება არ გაქვს.'},{status:403});
 if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{
  const body=await req.json() as Record<string,unknown>,email=String(body.employeeEmail||'').trim().toLowerCase(),effectiveFrom=String(body.effectiveFrom||''),effectiveTo:null=null,schedule=validateSchedule(body.schedule),breakMinutes=Number(body.breakMinutes||0);
  if(!validIsoDate(effectiveFrom)||!schedule||!Number.isInteger(breakMinutes)||breakMinutes<0||breakMinutes>240)return Response.json({error:'სამუშაო გრაფიკის მონაცემები არასწორია.'},{status:400});
  const person=(await listApprovedStaff()).find(item=>item.email.toLowerCase()===email);if(!person)return Response.json({error:'აირჩიე აქტიური თანამშრომელი.'},{status:400});
  const {DB}=storage(),existing=(await DB.prepare(`SELECT id,effective_from
   FROM staff_work_patterns WHERE employee_email=? AND (effective_to IS NULL OR effective_to>=?)`).bind(person.email,effectiveFrom).all<{id:string;effective_from:string}>()).results,statements:D1PreparedStatement[]=[];
  const now=Date.now();
  for(const row of existing){
   if(row.effective_from<effectiveFrom)statements.push(DB.prepare('UPDATE staff_work_patterns SET effective_to=?,updated=?,updated_by=? WHERE id=?').bind(addDays(effectiveFrom,-1),now,access.email,row.id));
   else statements.push(DB.prepare('DELETE FROM staff_work_patterns WHERE id=?').bind(row.id));
  }
  const id=crypto.randomUUID();statements.push(DB.prepare('INSERT INTO staff_work_patterns (id,employee_email,employee_name,effective_from,effective_to,schedule_json,break_minutes,created,created_by,updated,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,person.email,person.fullName,effectiveFrom,effectiveTo,JSON.stringify(schedule),breakMinutes,now,access.email,now,access.email));
  await DB.batch(statements);return Response.json({ok:true,id});
 }catch{return Response.json({error:'სამუშაო გრაფიკი ვერ განახლდა.'},{status:503})}
}
