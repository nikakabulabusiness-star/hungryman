import {hasPermission} from '@/lib/permissions';
import {getAdminAccess} from '@/lib/admin';
import {roles} from '@/lib/questions';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';

export const dynamic='force-dynamic';

const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const positions=Object.values(roles) as string[];

export async function POST(req:Request){
 const access=await getAdminAccess();
 if(!access||!hasPermission(access,'applications.edit'))return Response.json({error:'კანდიდატის დამატების უფლება არ გაქვს.'},{status:403});
 if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{
  const body=await req.json() as {name?:unknown;email?:unknown;phone?:unknown;position?:unknown};
  const name=String(body.name||'').trim().slice(0,160),email=String(body.email||'').trim().toLowerCase().slice(0,254),phone=String(body.phone||'').trim().slice(0,40),position=String(body.position||'').trim();
  if(name.length<2)return Response.json({error:'მიუთითე კანდიდატის სახელი და გვარი.'},{status:400});
  if(!emailPattern.test(email))return Response.json({error:'მიუთითე სწორი ელფოსტა.'},{status:400});
  if(phone.replace(/\D/g,'').length<7)return Response.json({error:'მიუთითე სწორი ტელეფონის ნომერი.'},{status:400});
  if(!positions.includes(position))return Response.json({error:'აირჩიე სწორი პოზიცია.'},{status:400});
  const role=Object.entries(roles).find(([,label])=>label===position)?.[0]||'';
  const id=crypto.randomUUID(),created=Date.now();
  const answers=JSON.stringify({schemaVersion:'manual',manualEntry:'yes',role,name,email,phone,position,addedBy:access.email});
  await storage().DB.prepare('INSERT INTO applications (id,created,name,email,position,answers,file_key,file_name,file_type,submitter,status,rating,form_rating,manual_order,admin_note,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,created,name,email,position,answers,null,null,null,'admin:'+access.email,'new',0,0,created,'',created).run();
  return Response.json({ok:true,row:{id,created,name,email,position,answers,file_name:null,status:'new',rating:0,form_rating:0,manual_order:created,admin_note:''}},{status:201});
 }catch(error){console.error('Manual candidate creation failed',error);return Response.json({error:'კანდიდატი ვერ დაემატა.'},{status:503});}
}
