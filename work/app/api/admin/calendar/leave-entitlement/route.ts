import {getAdminAccess} from '@/lib/admin';
import {listApprovedStaff} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';

export async function PUT(req:Request){
 const access=await getAdminAccess();if(!access?.canManageCalendar)return Response.json({error:'კალენდრის მართვის უფლება არ გაქვს.'},{status:403});
 if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{
  const body=await req.json() as Record<string,unknown>,email=String(body.employeeEmail||'').trim().toLowerCase(),year=Number(body.year),allowance=Number(body.allowanceDays),carryover=Number(body.carryoverDays||0);
  if(!Number.isInteger(year)||year<2020||year>2100||!Number.isFinite(allowance)||allowance<0||allowance>366||!Number.isFinite(carryover)||carryover<0||carryover>366)return Response.json({error:'შვებულების ლიმიტი არასწორია.'},{status:400});
  const person=(await listApprovedStaff()).find(item=>item.email.toLowerCase()===email);if(!person)return Response.json({error:'აირჩიე აქტიური თანამშრომელი.'},{status:400});
  await storage().DB.prepare(`INSERT INTO staff_leave_entitlements (employee_email,year,allowance_days,carryover_days,updated,updated_by) VALUES (?,?,?,?,?,?)
   ON CONFLICT(employee_email,year) DO UPDATE SET allowance_days=excluded.allowance_days,carryover_days=excluded.carryover_days,updated=excluded.updated,updated_by=excluded.updated_by`).bind(person.email,year,allowance,carryover,Date.now(),access.email).run();
  return Response.json({ok:true});
 }catch{return Response.json({error:'შვებულების ლიმიტი ვერ განახლდა.'},{status:503})}
}
