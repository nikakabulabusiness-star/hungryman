import {getStaffAccess,listApprovedStaff} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {attendancePlan,localDate} from '@/lib/attendance';
import {attendanceAnswers,isAttendanceAnswer,canReviewRequests} from '@/lib/notification-policy';
import {noticeStatements,reviewers,dispatchNotices} from '@/lib/notifications';
export const dynamic='force-dynamic';
export type AttendanceRequest={id:string;user_id:string;email:string;employee_name:string;work_date:string;answer:keyof typeof attendanceAnswers;status:string;comment:string;response:string;created:number};
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:Request){const a=await getStaffAccess();if(!a?.isApproved||a.features?.attendance===false)return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});const review=new URL(req.url).searchParams.get('review')==='1';if(review&&!canReviewRequests(a))return Response.json({error:'განხილვის უფლება არ გაქვს.'},{status:403});const rows=await storage().DB.prepare('SELECT id,user_id,email,employee_name,work_date,answer,status,comment,response,created FROM attendance_requests'+(review?'':' WHERE user_id=?')+" ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,created DESC LIMIT 100").bind(...(review?[]:[a.userId])).all();return Response.json({requests:rows.results},{headers})}
export async function POST(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||a.features?.attendance===false||!sameOrigin(req))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});const b=await req.json().catch(()=>null) as {answer?:unknown;comment?:unknown;date?:unknown}|null,date=localDate();
 if(!b||!isAttendanceAnswer(b.answer)||typeof (b.comment??'')!=='string'||String(b.comment||'').length>1000||b.date!==undefined&&b.date!==date)return Response.json({error:'აირჩიე დღევანდელი სამუშაო სტატუსი.'},{status:400});
 const db=storage().DB,existing=await db.prepare('SELECT id,answer FROM attendance_requests WHERE user_id=? AND work_date=?').bind(a.userId,date).first<{id:string;answer:string}>();
 if(existing)return existing.answer===b.answer?Response.json({ok:true,id:existing.id,replayed:true}):Response.json({error:'დღევანდელი მოთხოვნა უკვე გაგზავნილია.'},{status:409});
 const [day]=await attendancePlan(a.email,a.userId,date,date);if(!day||day.planned!=='work'||day.mode!=='pending'||day.firstArrival)return Response.json({error:'ეს დღე უკვე აღრიცხულია ან სამუშაო დღე არ არის.'},{status:409});
 const id='attendance:'+a.userId+':'+date,now=Date.now(),reviewerIds=await reviewers(),comment=String(b.comment||'').trim();
 const inserted=await db.batch([db.prepare('INSERT OR IGNORE INTO attendance_requests (id,user_id,email,employee_name,work_date,answer,comment,created) VALUES (?,?,?,?,?,?,?,?)').bind(id,a.userId,a.email,a.fullName,date,b.answer,comment,now),...noticeStatements(reviewerIds,{key:'attendance-request:'+id,category:'request',title:a.fullName+' · '+attendanceAnswers[b.answer as keyof typeof attendanceAnswers],body:date+(comment?' · '+comment:''),target:'requests',targetId:id,important:b.answer==='remote',created:now})]);
 const saved=await db.prepare('SELECT id,answer FROM attendance_requests WHERE user_id=? AND work_date=?').bind(a.userId,date).first<{id:string;answer:string}>();
 if(!saved||saved.answer!==b.answer)return Response.json({error:'დღევანდელი მოთხოვნა უკვე გაგზავნილია.'},{status:409});
 dispatchNotices();return Response.json({ok:true,id:saved.id,replayed:!inserted[0].meta.changes},{status:inserted[0].meta.changes?201:200});
}
export async function PATCH(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||a.features?.attendance===false||!canReviewRequests(a)||!sameOrigin(req))return Response.json({error:'განხილვის უფლება არ გაქვს.'},{status:403});const b=await req.json().catch(()=>null) as {id?:string;action?:string;response?:string}|null;
 if(!b||typeof b.id!=='string'||b.id.length>240||!['approved','rejected'].includes(b.action||'')||typeof(b.response??'')!=='string'||String(b.response||'').length>1000)return Response.json({error:'მოთხოვნა არასწორია.'},{status:400});
 const db=storage().DB,row=await db.prepare('SELECT * FROM attendance_requests WHERE id=?').bind(b.id).first<AttendanceRequest>();if(!row)return Response.json({error:'მოთხოვნა ვერ მოიძებნა.'},{status:404});
 if(row.status!=='pending')return row.status===b.action?Response.json({ok:true,replayed:true}):Response.json({error:'უკვე განხილულია.'},{status:409});
 if(b.action==='approved'&&row.answer!=='late'){
  const active=(await listApprovedStaff()).some(person=>person.userId===row.user_id&&person.email===row.email);
  const [day]=active?await attendancePlan(row.email,row.user_id,row.work_date,row.work_date):[];
  if(!day||day.planned!=='work'||day.mode!=='pending'||day.firstArrival)return Response.json({error:'თანამშრომლის სამუშაო დღე უკვე შეიცვალა. გადაამოწმე დასწრება.'},{status:409});
 }
 const token=crypto.randomUUID(),now=Date.now(),mode=row.answer==='remote'?'remote':'day_off',response=String(b.response||'').trim();
 const statements=[db.prepare("UPDATE attendance_requests SET status=?,response=?,resolved=?,resolved_by=?,decision_token=? WHERE id=? AND status='pending' AND (?!='approved' OR answer='late' OR NOT EXISTS(SELECT 1 FROM staff_attendance s WHERE s.user_id=attendance_requests.user_id AND s.work_date=attendance_requests.work_date AND (s.first_arrival IS NOT NULL OR s.open_since IS NOT NULL OR s.mode!='pending')))").bind(b.action,response,now,a.email,token,row.id,b.action)];
 if(b.action==='approved'&&row.answer!=='late')statements.push(db.prepare("INSERT INTO staff_attendance (user_id,email,work_date,mode,updated,source) SELECT user_id,email,work_date,?,?,'hr' FROM attendance_requests WHERE id=? AND decision_token=? ON CONFLICT(user_id,work_date) DO UPDATE SET mode=excluded.mode,updated=excluded.updated,source='hr'").bind(mode,now,row.id,token));
 statements.push(db.prepare("INSERT OR IGNORE INTO work_notifications (id,user_id,category,title,body,target,target_id,important,created,push_enabled) SELECT ?,user_id,'attendance',?,?,'attendance',work_date,1,?,1 FROM attendance_requests WHERE id=? AND decision_token=?").bind('attendance-result:'+row.id+':'+row.user_id,attendanceAnswers[row.answer]+' · '+(b.action==='approved'?'დადასტურებულია':'უარყოფილია'),row.work_date+(response?' · '+response.slice(0,450):''),now,row.id,token));
 const result=await db.batch(statements);if(!result[0].meta.changes)return Response.json({error:'სხვა ადმინისტრატორმა უკვე განიხილა.'},{status:409});
 dispatchNotices();return Response.json({ok:true});
}
