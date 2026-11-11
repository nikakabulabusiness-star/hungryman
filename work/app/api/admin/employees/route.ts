import {getAdminAccess} from '@/lib/admin';
import {canDeleteAccount,hasPermission} from '@/lib/permissions';
import {canEditEmployee,employeeRole} from '@/lib/employee-policy';
import {validIsoDate} from '@/lib/staff-calendar';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';

export const dynamic='force-dynamic';
type EmployeeBody={id?:unknown;fullName?:unknown;birthDate?:unknown;personalNumber?:unknown;email?:unknown;phone?:unknown;position?:unknown};
const clean=(value:unknown,max:number)=>String(value||'').trim().slice(0,max);
const validEmail=(value:string)=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
function parse(body:EmployeeBody|null){
 if(!body||typeof body!=='object')return {error:'თანამშრომლის მონაცემები არასწორია.'} as const;
 const fullName=clean(body.fullName,150),birthInput=clean(body.birthDate,20),personalNumber=clean(body.personalNumber,30),email=clean(body.email,254).toLowerCase(),phone=clean(body.phone,40),position=clean(body.position,150);
 const legacy=birthInput.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/),birthDate=legacy?`${legacy[3]}-${legacy[2].padStart(2,'0')}-${legacy[1].padStart(2,'0')}`:birthInput;
 if(fullName.length<2||!validIsoDate(birthDate)||!personalNumber||!phone||!position||!validEmail(email))return {error:'შეავსე ყველა ველი და მიუთითე სწორი დაბადების თარიღი.'} as const;
 return {fullName,birthDate,personalNumber,email,phone,position} as const;
}
async function authorize(req:Request){const access=await getAdminAccess();if(!hasPermission(access,'employees.manage'))return {response:Response.json({error:'თანამშრომლების მართვის უფლება არ გაქვს.'},{status:403})};if(!sameOrigin(req))return {response:Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403})};return {access:access!};}
async function duplicateEmail(email:string,id?:string){const row=id?await storage().DB.prepare('SELECT id FROM employees WHERE lower(email)=? AND id<>? LIMIT 1').bind(email,id).first():await storage().DB.prepare('SELECT id FROM employees WHERE lower(email)=? LIMIT 1').bind(email).first();return !!row;}
function emailConflict(error:unknown){return String(error).includes('UNIQUE constraint failed: employees.email')}
async function accountRole(email:string,fallback:string){
 if(email.toLowerCase()==='nikolozkabulashvili0@gmail.com')return 'Developer';
 const {DB}=storage(),admin=await DB.prepare('SELECT role FROM admin_users WHERE lower(email)=? LIMIT 1').bind(email.toLowerCase()).first<{role:string}>();
 if(admin?.role)return admin.role;
 const member=await DB.prepare('SELECT role FROM team_members WHERE lower(email)=? LIMIT 1').bind(email.toLowerCase()).first<{role:string|null}>();
 return member?.role||employeeRole(fallback);
}
const denied=()=>Response.json({error:'ამ თანამშრომლის მართვის უფლება არ გაქვს.'},{status:403});

export async function POST(req:Request){
 const auth=await authorize(req);if(auth.response)return auth.response;
 try{
  const input=parse(await req.json() as EmployeeBody);if('error'in input)return Response.json({error:input.error},{status:400});
  const role=await accountRole(input.email,input.position);
  if(!canEditEmployee(auth.access,role,input.email)||!canEditEmployee(auth.access,employeeRole(input.position),input.email))return denied();
  if(await duplicateEmail(input.email))return Response.json({error:'ამ ელფოსტით თანამშრომელი უკვე არსებობს.'},{status:409});
  const {DB}=storage(),id=crypto.randomUUID(),now=Date.now();
  await DB.batch([
   DB.prepare('INSERT INTO employees (id,full_name,birth_date,personal_number,email,phone,position,created,updated) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,input.fullName,input.birthDate,input.personalNumber,input.email,input.phone,input.position,now,now),
   DB.prepare('INSERT INTO workspace_audit (id,actor,action,target,details,created) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),auth.access.email,'employee.created',id,JSON.stringify({email:input.email,position:input.position}),now),
  ]);
  return Response.json({ok:true,employee:{id,full_name:input.fullName,birth_date:input.birthDate,personal_number:input.personalNumber,email:input.email,phone:input.phone,position:input.position,account_role:role,created:now,updated:now}});
 }catch(error){if(emailConflict(error))return Response.json({error:'ამ ელფოსტით თანამშრომელი უკვე არსებობს.'},{status:409});return Response.json({error:'თანამშრომელი დროებით ვერ დაემატა.'},{status:503})}
}

export async function PATCH(req:Request){
 const auth=await authorize(req);if(auth.response)return auth.response;
 try{
  const body=await req.json() as EmployeeBody|null,id=clean(body?.id,80);if(!id)return Response.json({error:'თანამშრომელი ვერ მოიძებნა.'},{status:400});
  const input=parse(body);if('error'in input)return Response.json({error:input.error},{status:400});
  const {DB}=storage(),current=await DB.prepare('SELECT email,position,created FROM employees WHERE id=? LIMIT 1').bind(id).first<{email:string;position:string;created:number}>();if(!current)return Response.json({error:'თანამშრომელი ვერ მოიძებნა.'},{status:404});
  const currentRole=await accountRole(current.email,current.position),nextRole=await accountRole(input.email,input.position);
  if(!canEditEmployee(auth.access,currentRole,current.email)||!canEditEmployee(auth.access,nextRole,input.email)||!canEditEmployee(auth.access,employeeRole(input.position),input.email))return denied();
  if(await duplicateEmail(input.email,id))return Response.json({error:'ამ ელფოსტით სხვა თანამშრომელი უკვე არსებობს.'},{status:409});
  const updated=Date.now();
  await DB.batch([
   DB.prepare('UPDATE employees SET full_name=?,birth_date=?,personal_number=?,email=?,phone=?,position=?,updated=? WHERE id=?').bind(input.fullName,input.birthDate,input.personalNumber,input.email,input.phone,input.position,updated,id),
   DB.prepare('INSERT INTO workspace_audit (id,actor,action,target,details,created) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),auth.access.email,'employee.updated',id,JSON.stringify({previousEmail:current.email,email:input.email,position:input.position}),updated),
  ]);
  return Response.json({ok:true,employee:{id,full_name:input.fullName,birth_date:input.birthDate,personal_number:input.personalNumber,email:input.email,phone:input.phone,position:input.position,account_role:nextRole,created:current.created,updated}});
 }catch(error){if(emailConflict(error))return Response.json({error:'ამ ელფოსტით სხვა თანამშრომელი უკვე არსებობს.'},{status:409});return Response.json({error:'ცვლილება დროებით ვერ შეინახა.'},{status:503})}
}

export async function DELETE(req:Request){
 const auth=await authorize(req);if(auth.response)return auth.response;
 try{
  const body=await req.json() as EmployeeBody|null,id=clean(body?.id,80);if(!id)return Response.json({error:'თანამშრომელი ვერ მოიძებნა.'},{status:400});
  const {DB}=storage(),employee=await DB.prepare('SELECT email,position FROM employees WHERE id=? LIMIT 1').bind(id).first<{email:string;position:string}>();if(!employee)return Response.json({error:'თანამშრომელი ვერ მოიძებნა.'},{status:404});
  const role=await accountRole(employee.email,employee.position);
  if(!canDeleteAccount(auth.access,role,employee.email))return denied();
  const account=await DB.prepare('SELECT user_id FROM team_members WHERE lower(email)=lower(?) LIMIT 1').bind(employee.email).first<{user_id:string}>(),now=Date.now(),statements=[
   DB.prepare('DELETE FROM employees WHERE id=?').bind(id),
   DB.prepare("UPDATE admin_users SET status='suspended' WHERE lower(email)=lower(?)").bind(employee.email),
   DB.prepare('INSERT INTO workspace_audit (id,actor,action,target,details,created) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),auth.access.email,'employee.offboarded',id,JSON.stringify({email:employee.email}),now),
  ];
  if(account)statements.push(DB.prepare("UPDATE team_members SET status='suspended',updated=?,approved_by=NULL WHERE user_id=?").bind(now,account.user_id),DB.prepare('DELETE FROM staff_sessions WHERE user_id=?').bind(account.user_id),DB.prepare('DELETE FROM push_devices WHERE user_id=?').bind(account.user_id));
  await DB.batch(statements);
  return Response.json({ok:true});
 }catch{return Response.json({error:'თანამშრომელი დროებით ვერ წაიშალა.'},{status:503})}
}
