import {parseSystemPermissions} from '@/lib/site-controls';
import {getAdminAccess,DEVELOPER_EMAIL} from '@/lib/admin';
import {storage} from '@/lib/storage';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
/** Explicit projections: credentials, password verifiers, push tokens and session hashes never leave the server. */
export async function GET(req:Request){
 const actor=await getAdminAccess();if(!actor?.isDeveloper||actor.email!==DEVELOPER_EMAIL)return json({error:'მხოლოდ დეველოპერისთვის.'},403);
 try{
  const {DB}=storage(),url=new URL(req.url),id=url.searchParams.get('id');
  if(id){
   const account=await DB.prepare(`SELECT t.user_id,t.email,t.full_name,t.phone,t.role AS profile_role,COALESCE(a.role,t.role) AS position,t.status,a.status AS access_status,a.created AS access_created,a.created_by AS access_created_by,t.last_seen,t.created,t.updated,t.approved_by,CASE WHEN t.avatar_key IS NULL THEN 0 ELSE 1 END AS has_avatar,CASE WHEN t.password_hash IS NULL THEN 0 ELSE 1 END AS password_configured,s.granted,s.granted_by,s.permissions_json FROM team_members t LEFT JOIN admin_users a ON a.email=t.email LEFT JOIN site_administrators s ON s.email=t.email WHERE t.user_id=?`).bind(id).first<{email:string;[key:string]:unknown}>();
   if(!account)return json({error:'ანგარიში ვერ მოიძებნა.'},404);
   const email=account.email;
   const [employee,attendance,calendar,requests,patterns,leave,daysOff,sessions,devices,activity]=await Promise.all([
    DB.prepare('SELECT id,full_name,birth_date,personal_number,email,phone,position,created,updated FROM employees WHERE lower(email)=?').bind(email).first(),
    DB.prepare('SELECT work_date,mode,office_minutes,first_arrival,last_departure,last_confirmed,source FROM staff_attendance WHERE user_id=? ORDER BY work_date DESC LIMIT 100').bind(id).all(),
    DB.prepare('SELECT id,kind,title,start_date,end_date,start_time,end_time,duration_minutes FROM staff_calendar_events WHERE employee_user_id=? OR lower(employee_email)=? ORDER BY start_date DESC LIMIT 100').bind(id,email).all(),
    DB.prepare('SELECT id,kind,start_date,end_date,status,comment,response,created,resolved,resolved_by FROM staff_time_off_requests WHERE user_id=? ORDER BY created DESC LIMIT 100').bind(id).all(),
    DB.prepare('SELECT effective_from,effective_to,schedule_json,break_minutes,updated,updated_by FROM staff_work_patterns WHERE lower(employee_email)=? ORDER BY effective_from DESC LIMIT 100').bind(email).all(),
    DB.prepare('SELECT year,allowance_days,carryover_days FROM staff_leave_entitlements WHERE lower(employee_email)=? ORDER BY year DESC').bind(email).all(),
    DB.prepare('SELECT year,days FROM staff_day_off_entitlements WHERE lower(email)=? ORDER BY year DESC').bind(email).all(),
    DB.prepare('SELECT created,expires,last_seen FROM staff_sessions WHERE user_id=? AND expires>? ORDER BY last_seen DESC LIMIT 100').bind(id,Date.now()).all(),
    DB.prepare('SELECT COUNT(*) AS count,MAX(updated) AS updated FROM push_devices WHERE user_id=?').bind(id).first(),
    DB.prepare('SELECT action,target,actor,created FROM workspace_audit WHERE lower(actor)=? OR lower(target)=? OR target=? ORDER BY created DESC LIMIT 100').bind(email,email,id).all(),
   ]);
   return json({account:{...account,permissions_json:undefined,systemPermissions:account.granted?parseSystemPermissions(account.permissions_json as string|null):[],systemRole:email===DEVELOPER_EMAIL?'Developer':account.granted?'Administrator':null},employee,attendance:attendance.results,calendar:calendar.results,requests:requests.results,patterns:patterns.results,leave:leave.results,daysOff:daysOff.results,sessions:sessions.results,devices,activity:activity.results});
  }
  const q=(url.searchParams.get('q')||'').trim().slice(0,100),page=Math.max(0,Math.min(10000,Math.floor(Number(url.searchParams.get('page'))||0))),filter=url.searchParams.get('filter')||'all';
  const where=`WHERE (t.email LIKE ? OR t.full_name LIKE ?)${filter==='administrators'?" AND (s.email IS NOT NULL OR t.email=?)":filter==='pending'?" AND t.status='pending'":''}`;
  const args=[`%${q}%`,`%${q}%`,...(filter==='administrators'?[DEVELOPER_EMAIL]:[])];
  const from=' FROM team_members t LEFT JOIN admin_users a ON a.email=t.email LEFT JOIN site_administrators s ON s.email=t.email ';
  const [rows,total]=await Promise.all([
   DB.prepare('SELECT t.user_id,t.email,t.full_name,COALESCE(a.role,t.role) AS position,t.status,t.created,t.last_seen,s.granted,s.granted_by'+from+where+' ORDER BY t.created DESC,t.user_id LIMIT 30 OFFSET ?').bind(...args,page*30).all<{email:string;granted:number|null}>(),
   DB.prepare('SELECT COUNT(*) AS count'+from+where).bind(...args).first<{count:number}>(),
  ]);
  return json({rows:rows.results.map(r=>({...r,systemRole:r.email===DEVELOPER_EMAIL?'Developer':r.granted?'Administrator':null})),total:total?.count||0,page});
 }catch{return json({error:'ბაზა დროებით მიუწვდომელია. სცადე ხელახლა.'},503)}
}
