import {notificationRuntime} from '@/lib/notification-runtime';
import {getStaffAccess} from '@/lib/staff-access';
import {attendancePlan,localDate,officeConfig} from '@/lib/attendance';
import {salaryEvents} from '@/lib/calendar-payday';
import {storage} from '@/lib/storage';
export const dynamic='force-dynamic';
export async function GET(){const a=await getStaffAccess();if(!a?.isApproved)return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});const from=localDate(),to=localDate(Date.now()+14*86400000);const [days,salaries,office,requests]=await Promise.all([attendancePlan(a.email,a.userId,from,to),salaryEvents(from,to),officeConfig(),storage().DB.prepare('SELECT work_date FROM attendance_requests WHERE user_id=? AND work_date>=?').bind(a.userId,from).all<{work_date:string}>()]);return Response.json({serverScheduling:notificationRuntime().serverScheduling,days:(a.features?.attendance===false?[]:days).map(d=>({...d,requested:requests.results.some(r=>r.work_date===d.date)})),salaries:salaries.map(s=>s.start_date),office:a.features?.attendance===false?null:office},{headers:{'Cache-Control':'private, no-store'}})}
