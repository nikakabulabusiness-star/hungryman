import {validSystemPermissions,parseSystemPermissions} from '@/lib/site-controls';
import {getAdminAccess,DEVELOPER_EMAIL} from '@/lib/admin';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
export const dynamic='force-dynamic';
export async function PATCH(req:Request){
 const actor=await getAdminAccess();
 if(!actor?.isDeveloper||actor.email!==DEVELOPER_EMAIL||!sameOrigin(req))return Response.json({error:'მხოლოდ დეველოპერისთვის.'},{status:403});
 try{
  const body=await req.json() as {email?:unknown;administrator?:unknown;role?:unknown;permissions?:unknown};
  if(body.permissions!==undefined&&!validSystemPermissions(body.permissions))return Response.json({error:'უფლებების სია არასწორია.'},{status:400});
  const email=String(body.email||'').trim().toLowerCase();
  if(typeof body.administrator!=='boolean'||body.role!==undefined||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return Response.json({error:'არასწორი მოთხოვნა.'},{status:400});
  if(email===DEVELOPER_EMAIL)return Response.json({error:'დეველოპერი ერთადერთია და მისი სისტემური სტატუსი უცვლელია.'},{status:403});
  const {DB}=storage(),target=await DB.prepare('SELECT t.user_id,t.status,a.status AS access_status FROM team_members t LEFT JOIN admin_users a ON a.email=t.email WHERE t.email=?').bind(email).first<{user_id:string;status:string;access_status:string}>();
  if(!target)return Response.json({error:'ანგარიში ვერ მოიძებნა.'},{status:404});
  if(body.administrator&&(target.status!=='approved'||target.access_status!=='approved'))return Response.json({error:'ჯერ დაამტკიცე ანგარიში.'},{status:409});
  const previous=await DB.prepare('SELECT permissions_json FROM site_administrators WHERE email=?').bind(email).first<{permissions_json:string|null}>();
  const permissions=body.permissions??(previous?parseSystemPermissions(previous.permissions_json):[]);
  await DB.batch([
   body.administrator?DB.prepare('INSERT INTO site_administrators(email,granted,granted_by,permissions_json) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET permissions_json=excluded.permissions_json').bind(email,Date.now(),actor.email,JSON.stringify(permissions)):DB.prepare('DELETE FROM site_administrators WHERE email=?').bind(email),
   DB.prepare('INSERT INTO workspace_audit(id,actor,action,target,details,created) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.email,'system.administrator.changed',email,JSON.stringify({administrator:body.administrator,permissions}),Date.now()),
  ]);
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'ცვლილება ვერ შეინახა. სცადე ხელახლა.'},{status:503})}
}
