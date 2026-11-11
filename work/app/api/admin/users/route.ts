import {DEVELOPER_EMAIL,getAdminAccess,type AdminAccess} from '@/lib/admin';
import {canDeleteAccount,canManageRole,hasPermission} from '@/lib/permissions';
import {getAssignablePositions,getPosition} from '@/lib/positions';
import {clearEmbeddedSessionCookie,clearSessionCookie} from '@/lib/staff-auth';
import {storage} from '@/lib/storage';
import type {TeamRole,TeamStatus} from '@/lib/team-roles';
import {sameOrigin} from '@/lib/visitor';
import {deleteAccountData} from '../access/account-deletion';

export const dynamic='force-dynamic';
const normalize=(value:unknown)=>String(value||'').trim().toLowerCase();
const validEmail=(email:string)=>email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validManagedStatus=(value:unknown):value is Exclude<TeamStatus,'pending'>=>value==='approved'||value==='suspended';

type AccessBody={email?:unknown;role?:unknown;status?:unknown};
type Target={user_id:string;email:string;full_name:string;role:TeamRole|null;status:TeamStatus;created:number;password_hash:string|null;avatar_key:string|null};
type ParsedInput={email:string;role:TeamRole;status:Exclude<TeamStatus,'pending'>};

async function authorize(req:Request,permission:'accounts.manage'|'accounts.delete'){
 const access=await getAdminAccess();
 if(!hasPermission(access,permission))return {response:Response.json({error:'ანგარიშების მართვის უფლება არ გაქვს.'},{status:403})};
 if(permission==='accounts.manage'&&!access?.isDeveloper&&!access?.isSiteAdmin&&!['Owner','HR'].includes(access?.role||''))return {response:Response.json({error:'ანგარიშების დამტკიცება და როლის მინიჭება მხოლოდ Developer-ს, Owner-სა და HR-ს შეუძლია.'},{status:403})};
 if(!sameOrigin(req))return {response:Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403})};
 return {access:access!};
}

async function target(email:string){
 return await storage().DB.prepare(`
  SELECT t.user_id,t.email,t.full_name,COALESCE(a.role,t.role) AS role,t.status,t.created,t.password_hash,t.avatar_key
  FROM team_members t LEFT JOIN admin_users a ON lower(a.email)=lower(t.email)
  WHERE lower(t.email)=? LIMIT 1
 `).bind(email).first<Target>()||null;
}

function targetRole(row:Target):TeamRole|null{
 return row.email.toLowerCase()===DEVELOPER_EMAIL?'Developer':row.role;
}

async function parse(body:AccessBody,access:AdminAccess,current:Target):Promise<ParsedInput|{error:string;status?:number}>{
 const email=normalize(body.email);
 if(!validEmail(email)||email!==current.email.toLowerCase())return {error:'მიუთითე სწორი ელფოსტა.'};
 if(email===DEVELOPER_EMAIL)return {error:'Developer-ის სისტემური როლი და სტატუსი აქედან არ იცვლება.',status:403};
 if(!validManagedStatus(body.status))return {error:'აირჩიე აქტიური ან შეჩერებული სტატუსი.'};
 const role=typeof body.role==='string'?body.role.trim():'';
 if(!role)return {error:'ანგარიშის გასააქტიურებლად აირჩიე პოზიცია.'};
 const existingRole=targetRole(current),ownerPosition=role==='Owner'?await getPosition('Owner'):null,known=(await getAssignablePositions()).includes(role)||!!ownerPosition?.active||(existingRole===role&&body.status==='suspended');
 if(!known)return {error:'აირჩიე სწორი პოზიცია.'};
 if(existingRole&&!canManageRole(access,existingRole))return {error:'ამ ანგარიშის სტატუსისა და პოზიციის შეცვლის უფლება არ გაქვს.',status:403};
 if(!canManageRole(access,role))return {error:'ამ პოზიციის მინიჭების უფლება არ გაქვს.',status:403};
 return {email,role,status:body.status};
}

const resultAccount=(row:Target)=>({
 email:row.email,
 fullName:row.full_name,
 role:targetRole(row),
 status:row.email.toLowerCase()===DEVELOPER_EMAIL?'approved':row.status,
 created:row.created,
});

async function save(input:ParsedInput,actor:string){
 const db=storage().DB,existing=await target(input.email);
 if(!existing?.password_hash)return null;
 const now=Date.now(),approvedBy=input.status==='approved'?actor:null;
 const statements=[
  db.prepare('UPDATE team_members SET role=?,status=?,updated=?,approved_by=? WHERE lower(email)=?').bind(input.role,input.status,now,approvedBy,input.email),
  db.prepare('UPDATE employees SET position=?,updated=? WHERE lower(email)=?').bind(input.role,now,input.email),
  db.prepare(`INSERT INTO admin_users (email,role,status,created,created_by)
   VALUES (?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,status=excluded.status`)
   .bind(input.email,input.role,input.status,existing.created,actor),
  db.prepare('INSERT INTO workspace_audit (id,actor,action,target,details,created) VALUES (?,?,?,?,?,?)')
   .bind(crypto.randomUUID(),actor,'account.access.changed',input.email,JSON.stringify({before:{role:targetRole(existing),status:existing.status},after:{role:input.role,status:input.status}}),now),
 ];
 if(input.status==='suspended')statements.push(db.prepare('DELETE FROM staff_sessions WHERE user_id=?').bind(existing.user_id));
 await db.batch(statements);
 return await target(input.email);
}

async function change(req:Request){
 const auth=await authorize(req,'accounts.manage');if(auth.response)return auth.response;
 try{
  const body=await req.json() as AccessBody,email=normalize(body.email);
  if(!validEmail(email))return Response.json({error:'მიუთითე სწორი ელფოსტა.'},{status:400});
  const existing=await target(email);
  if(!existing?.password_hash)return Response.json({error:'ანგარიში ვერ მოიძებნა.'},{status:404});
  const input=await parse(body,auth.access,existing);
  if('error'in input)return Response.json({error:input.error},{status:input.status||400});
  const row=await save(input,auth.access.email);
  if(!row)return Response.json({error:'ანგარიში ვერ მოიძებნა.'},{status:404});
  return Response.json({ok:true,account:resultAccount(row)});
 }catch(error){
  console.error('Account access change failed',error);
  return Response.json({error:'წვდომის ცვლილება დროებით ვერ შეინახა.'},{status:503});
 }
}

export const POST=change;
export const PATCH=change;

export async function DELETE(req:Request){
 const auth=await authorize(req,'accounts.delete');if(auth.response)return auth.response;
 try{
  const body=await req.json() as {email?:unknown;confirmation?:unknown},email=normalize(body.email),confirmation=normalize(body.confirmation);
  if(!validEmail(email))return Response.json({error:'მიუთითე სწორი ელფოსტა.'},{status:400});
  if(confirmation!==email)return Response.json({error:'წაშლის დასადასტურებლად ზუსტად ჩაწერე ანგარიშის ელფოსტა.'},{status:400});
  const existing=await target(email);
  if(!existing?.password_hash)return Response.json({error:'ანგარიში ვერ მოიძებნა.'},{status:404});
  if(!canDeleteAccount(auth.access,targetRole(existing),email))return Response.json({error:'ამ ანგარიშის წაშლის უფლება არ გაქვს.'},{status:403});
  const self=auth.access.email.toLowerCase()===email,{DB,BUCKET}=storage();
  await deleteAccountData(DB,BUCKET,existing,auth.access.email);
  const headers=new Headers({'Cache-Control':'no-store'});
  if(self){headers.append('Set-Cookie',clearSessionCookie());headers.append('Set-Cookie',clearEmbeddedSessionCookie())}
  return Response.json({ok:true,self},{headers});
 }catch(error){
  console.error('Account deletion failed',error);
  return Response.json({error:'ანგარიში დროებით ვერ წაიშალა.'},{status:503});
 }
}
