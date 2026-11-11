import {getStaffAccess} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {absenceNoticeCleanup,absenceKinds,canManageAbsences,findAbsence,validAbsenceId,type AbsenceRow,type AbsenceDocument} from '@/lib/absences';
import {noticeStatements,dispatchNotices} from '@/lib/notifications';
import {timeOffLabels} from '@/lib/cabinet';
export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private, no-store'};
const denied=()=>Response.json({error:'წვდომა მხოლოდ HR-სა და დამფუძნებელს აქვს.'},{status:403,headers:privateHeaders});
export async function GET(req:Request){
 const actor=await getStaffAccess();if(!actor?.isApproved||!canManageAbsences(actor))return denied();
 const url=new URL(req.url),period=url.searchParams.get('period')||'current',kind=url.searchParams.get('kind')||'',q=(url.searchParams.get('q')||'').trim().slice(0,100),offset=Number(url.searchParams.get('offset')||0);
 if(!['current','upcoming','all','cancelled'].includes(period)||kind&&!absenceKinds.includes(kind as never)||!Number.isInteger(offset)||offset<0||offset>100000)return Response.json({error:'ფილტრი არასწორია.'},{status:400});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tbilisi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const filters=["1=1"],args:unknown[]=[];
 if(period==='current'){filters.push("status='approved' AND start_date<=? AND end_date>=?");args.push(today,today)}
 if(period==='upcoming'){filters.push("status='approved' AND start_date>?");args.push(today)}
 if(period==='cancelled')filters.push("status='cancelled'");
 if(kind){filters.push('kind=?');args.push(kind)}
 if(q){filters.push("(employee_name LIKE ? ESCAPE '\\' OR employee_email LIKE ? ESCAPE '\\')");const term='%'+q.replace(/[\\%_]/g,'\\$&')+'%';args.push(term,term)}
 const db=storage().DB,rows=(await db.prepare(`SELECT a.*,(SELECT COUNT(*) FROM staff_absence_documents d WHERE d.absence_id=a.id) document_count FROM (
 SELECT id,kind,employee_user_id,COALESCE(employee_email,'') employee_email,COALESCE(employee_name,employee_email,'') employee_name,start_date,end_date,title,created,created_by,'approved' status,NULL cancelled,NULL cancelled_by,'' reason FROM staff_calendar_events WHERE visibility='individual' AND kind IN ('leave','day_off','sick')
 UNION ALL SELECT id,kind,employee_user_id,employee_email,employee_name,start_date,end_date,title,created,created_by,'cancelled' status,cancelled,cancelled_by,reason FROM staff_absence_archives
 ) a WHERE ${filters.join(' AND ')} ORDER BY start_date DESC,id LIMIT 51 OFFSET ?`).bind(...args,offset).all<AbsenceRow>()).results;
 const ids=rows.slice(0,50).map(row=>row.id),documents=ids.length?(await db.prepare(`SELECT id,absence_id,name,mime,size,created,created_by FROM staff_absence_documents WHERE absence_id IN (${ids.map(()=>'?').join(',')}) ORDER BY created DESC`).bind(...ids).all<AbsenceDocument>()).results:[];
 return Response.json({items:rows.slice(0,50),documents,hasMore:rows.length>50,today},{headers:privateHeaders});
}
export async function PATCH(req:Request){
 const actor=await getStaffAccess();if(!actor?.isApproved||!canManageAbsences(actor)||!sameOrigin(req))return denied();
 const body=await req.json().catch(()=>null) as {id?:unknown;action?:unknown;reason?:unknown}|null;
 if(!body||typeof body.id!=='string'||!validAbsenceId(body.id)||body.action!=='cancel'||body.reason!=null&&typeof body.reason!=='string'||String(body.reason||'').length>1000)return Response.json({error:'მონაცემები არასწორია.'},{status:400});
 const row=await findAbsence(body.id);if(!row)return Response.json({error:'ჩანაწერი ვერ მოიძებნა.'},{status:404});if(row.status==='cancelled')return Response.json({error:'უკვე გაუქმებულია.'},{status:409});
 const db=storage().DB,now=Date.now(),reason=String(body.reason||'').trim();
 const result=await db.batch([
  db.prepare("INSERT OR IGNORE INTO staff_absence_archives (id,kind,employee_user_id,employee_email,employee_name,start_date,end_date,title,created,created_by,cancelled,cancelled_by,reason) SELECT id,kind,employee_user_id,COALESCE(employee_email,''),COALESCE(employee_name,employee_email,''),start_date,end_date,title,created,created_by,?,?,? FROM staff_calendar_events WHERE id=? AND visibility='individual' AND kind IN ('leave','day_off','sick')").bind(now,actor.email,reason,row.id),
  db.prepare("DELETE FROM staff_calendar_events WHERE id=? AND EXISTS(SELECT 1 FROM staff_absence_archives WHERE id=?)").bind(row.id,row.id),
  db.prepare("UPDATE staff_time_off_requests SET status='cancelled',resolved=?,resolved_by=?,response=?,seen=NULL WHERE 'request-'||id=? AND status='approved' AND EXISTS(SELECT 1 FROM staff_absence_archives WHERE id=?)").bind(now,actor.email,reason,row.id,row.id),
  db.prepare("INSERT INTO workspace_audit (id,actor,action,target,details,created) SELECT ?,?,'absence_cancelled',?,?,? WHERE EXISTS(SELECT 1 FROM staff_absence_archives WHERE id=? AND cancelled=?)").bind(crypto.randomUUID(),actor.email,row.id,JSON.stringify({kind:row.kind}),now,row.id,now),
  ...absenceNoticeCleanup(row.id),
  ...noticeStatements([row.employee_user_id],{key:'absence-cancelled:'+row.id,category:'leave',title:timeOffLabels[row.kind]+' გაუქმებულია',body:row.start_date+' — '+row.end_date+(reason?' · '+reason:''),target:'calendar',targetId:row.start_date,important:true},{query:'EXISTS(SELECT 1 FROM staff_absence_archives WHERE id=?)',values:[row.id]})
 ]);
 if(!result[0].meta.changes)return Response.json({error:'ჩანაწერი უკვე შეიცვალა. განაახლე გვერდი.'},{status:409});
 dispatchNotices();return Response.json({ok:true},{headers:privateHeaders});
}
export async function DELETE(req:Request){
 const actor=await getStaffAccess();if(!actor?.isApproved||!canManageAbsences(actor)||!sameOrigin(req))return denied();
 const body=await req.json().catch(()=>null) as {id?:unknown;confirm?:unknown}|null;
 if(!body||typeof body.id!=='string'||!validAbsenceId(body.id)||body.confirm!=='DELETE')return Response.json({error:'წაშლის დასადასტურებლად მიუთითე DELETE.'},{status:400});
 const row=await findAbsence(body.id);if(!row)return Response.json({error:'ჩანაწერი ვერ მოიძებნა.'},{status:404});
 const {DB,BUCKET}=storage(),documents=(await DB.prepare('SELECT object_key FROM staff_absence_documents WHERE absence_id=?').bind(row.id).all<{object_key:string}>()).results;
 // DB deletion is atomic; storage is private and orphaned files cannot be retrieved through the API.
 await DB.batch([
  DB.prepare('DELETE FROM staff_calendar_events WHERE id=?').bind(row.id),
  DB.prepare("DELETE FROM staff_time_off_requests WHERE 'request-'||id=?").bind(row.id),
  DB.prepare('DELETE FROM staff_absence_archives WHERE id=?').bind(row.id),
  DB.prepare('DELETE FROM staff_absence_documents WHERE absence_id=?').bind(row.id),
  ...absenceNoticeCleanup(row.id,true),
  DB.prepare("INSERT INTO workspace_audit (id,actor,action,target,details,created) VALUES (?,?,'absence_deleted',?,?,?)").bind(crypto.randomUUID(),actor.email,row.id,JSON.stringify({kind:row.kind,documents:documents.length}),Date.now()),
 ]);
 const cleanup=await Promise.allSettled(documents.map(file=>BUCKET.delete(file.object_key)));
 return Response.json({ok:true,...(cleanup.some(r=>r.status==='rejected')?{warning:'ჩანაწერი წაიშალა; ფაილის საცავიდან გასუფთავება დროებით ვერ დასრულდა.'}:{})},{headers:privateHeaders});
}
