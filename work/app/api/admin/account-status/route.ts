import {getAdminAccess,DEVELOPER_EMAIL} from '@/lib/admin';
import {canControl} from '@/lib/site-controls';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
export const dynamic='force-dynamic';
export async function PATCH(req:Request){
 const a=await getAdminAccess();if(!canControl(a,'accounts.manage')||!sameOrigin(req))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 const b=await req.json().catch(()=>null) as {email?:string;status?:string}|null;
 if(!b||typeof b.email!=='string'||!['approved','suspended'].includes(b.status||''))return Response.json({error:'არასწორი მოთხოვნა.'},{status:400});
 const email=b.email.trim().toLowerCase(),{DB}=storage(),row=await DB.prepare('SELECT t.user_id,COALESCE(a.role,t.role) AS role,t.status FROM team_members t LEFT JOIN admin_users a ON a.email=t.email WHERE t.email=?').bind(email).first<{user_id:string;role:string|null;status:string}>();
 if(!row)return Response.json({error:'ანგარიში ვერ მოიძებნა.'},{status:404});
 if(email===DEVELOPER_EMAIL||!a!.isDeveloper&&row.role==='Owner')return Response.json({error:'დაცული ანგარიშის დეაქტივაცია აკრძალულია.'},{status:403});
 if(!row.role||row.status==='pending')return Response.json({error:'ახალი ანგარიში ჯერ დაამტკიცე ანგარიშების განყოფილებიდან.'},{status:409});
 const now=Date.now(),statements=[DB.prepare('UPDATE team_members SET status=?,updated=? WHERE user_id=?').bind(b.status,now,row.user_id),DB.prepare('UPDATE admin_users SET status=? WHERE email=?').bind(b.status,email),DB.prepare('INSERT INTO workspace_audit(id,actor,action,target,details,created) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),a!.email,'account.status.changed',email,JSON.stringify({before:row.status,after:b.status}),now)];
 if(b.status==='suspended')statements.push(DB.prepare('DELETE FROM staff_sessions WHERE user_id=?').bind(row.user_id));
 await DB.batch(statements);return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
