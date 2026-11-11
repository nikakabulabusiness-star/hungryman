import {canManageAbsences} from '@/lib/absence-policy';
import {getAdminAccess} from '@/lib/admin';
import {listApprovedStaff} from '@/lib/staff-access';
import {calendarEventKinds,validIsoDate,validTime,type CalendarVisibility} from '@/lib/staff-calendar';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const access=await getAdminAccess();if(!access?.canManageCalendar)return Response.json({error:'კალენდრის მართვის უფლება არ გაქვს.'},{status:403});
 if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{
  const {id}=await params;if(!uuid(id))return Response.json({error:'ჩანაწერი ვერ მოიძებნა.'},{status:404});
  const existing=await storage().DB.prepare('SELECT kind,visibility FROM staff_calendar_events WHERE id=?').bind(id).first<{kind:string;visibility:string}>();
  if(existing&&['leave','day_off','sick'].includes(existing.kind)&&existing.visibility==='individual'&&!canManageAbsences(access))return Response.json({error:'შვებულების მართვა მხოლოდ HR-სა და დამფუძნებელს შეუძლია.'},{status:403});
  const body=await req.json() as Record<string,unknown>,kind=String(body.kind||''),visibility=String(body.visibility||'individual') as CalendarVisibility,title=String(body.title||'').trim().slice(0,120),startDate=String(body.startDate||''),endDate=String(body.endDate||''),employeeEmail=String(body.employeeEmail||'').trim().toLowerCase(),startTime=nullable(body.startTime),endTime=nullable(body.endTime),durationMinutes=body.durationMinutes==null||body.durationMinutes===''?null:Number(body.durationMinutes),recurring=kind==='holiday'&&body.recurringYearly===true;
  if(['leave','day_off','sick'].includes(kind)&&visibility==='individual'&&!canManageAbsences(access))return Response.json({error:'შვებულების მართვა მხოლოდ HR-სა და დამფუძნებელს შეუძლია.'},{status:403});
  if(existing?.kind==='sick'&&kind!=='sick'&&await storage().DB.prepare('SELECT id FROM staff_absence_documents WHERE absence_id=? LIMIT 1').bind(id).first())return Response.json({error:'საბუთიანი ბიულეტენის ტიპი ვერ შეიცვლება. გამოიყენე შვებულებების გვერდი.'},{status:409});
  if(!calendarEventKinds.includes(kind as never)||!['all','individual'].includes(visibility)||!validIsoDate(startDate)||!validIsoDate(endDate)||endDate<startDate)return Response.json({error:'კალენდრის მონაცემები არასწორია.'},{status:400});
  if((startTime&&!validTime(startTime))||(endTime&&!validTime(endTime))||Boolean(startTime)!==Boolean(endTime)||startTime&&endTime&&endTime<=startTime||durationMinutes!=null&&(!Number.isFinite(durationMinutes)||durationMinutes<0||durationMinutes>1440))return Response.json({error:'დროის მონაცემები არასწორია.'},{status:400});
  let email:string|null=null,name:string|null=null,userId:string|null=null;if(visibility==='individual'){const person=(await listApprovedStaff()).find(item=>item.email.toLowerCase()===employeeEmail);if(!person)return Response.json({error:'აირჩიე აქტიური თანამშრომელი.'},{status:400});email=person.email;name=person.fullName;userId=person.userId}
  if(['leave','sick','overtime'].includes(kind)&&visibility!=='individual')return Response.json({error:'შვებულება, ბიულეტენი და ოვერთაიმი კონკრეტულ თანამშრომელს უნდა მიენიჭოს.'},{status:400});
  if(kind==='holiday'&&visibility!=='all')return Response.json({error:'სახელმწიფო დასვენების დღე ყველასთვის უნდა გამოჩნდეს.'},{status:400});
  if(kind==='overtime'&&startDate!==endDate)return Response.json({error:'ოვერთაიმი ერთ კონკრეტულ დღეზე მიუთითე.'},{status:400});
  const result=await storage().DB.prepare(`UPDATE staff_calendar_events SET kind=?,title=?,start_date=?,end_date=?,employee_user_id=?,employee_email=?,employee_name=?,recurring_yearly=?,visibility=?,start_time=?,end_time=?,duration_minutes=?,updated=?,updated_by=? WHERE id=?`).bind(kind,title||fallback(kind),startDate,endDate,userId,email,name,recurring?1:0,visibility,startTime,endTime,durationMinutes,Date.now(),access.email,id).run();
  return result.meta.changes?Response.json({ok:true}):Response.json({error:'ჩანაწერი ვერ მოიძებნა.'},{status:404});
 }catch{return Response.json({error:'ჩანაწერი ვერ განახლდა.'},{status:503})}
}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 const access=await getAdminAccess();if(!access?.canManageCalendar)return Response.json({error:'კალენდრის მართვის უფლება არ გაქვს.'},{status:403});
 if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{const {id}=await params;if(!uuid(id))return Response.json({error:'ჩანაწერი ვერ მოიძებნა.'},{status:404});const existing=await storage().DB.prepare('SELECT kind,visibility FROM staff_calendar_events WHERE id=?').bind(id).first<{kind:string;visibility:string}>();if(existing&&['leave','day_off','sick'].includes(existing.kind)&&existing.visibility==='individual')return Response.json({error:'ამ ჩანაწერის გაუქმებისთვის ან წაშლისთვის გახსენი შვებულებების გვერდი.',href:'/admin/absences'},{status:409});const result=await storage().DB.prepare('DELETE FROM staff_calendar_events WHERE id=?').bind(id).run();return result.meta.changes?Response.json({ok:true}):Response.json({error:'ჩანაწერი ვერ მოიძებნა.'},{status:404})}catch{return Response.json({error:'ჩანაწერი ვერ წაიშალა.'},{status:503})}
}

const uuid=(value:string)=>/^[0-9a-f-]{36}$/i.test(value);
const nullable=(value:unknown)=>{const text=String(value||'').trim();return text||null};
const fallback=(kind:string)=>kind==='sick'?'ბიულეტენი':kind==='leave'?'შვებულება':kind==='overtime'?'ოვერთაიმი':kind==='holiday'?'დასვენების დღე':kind==='day_off'?'დასვენების დღე':'ინფორმაცია';
