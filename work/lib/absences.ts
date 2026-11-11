import {storage} from './storage';
import {timeOffLabels,type TimeOffKind} from './cabinet';

export const absenceKinds=Object.keys(timeOffLabels) as TimeOffKind[];
export {canManageAbsences} from './absence-policy';
export function validAbsenceId(id:string){return /^(?:request-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)}
export type AbsenceRow={id:string;kind:TimeOffKind;employee_user_id:string|null;employee_email:string;employee_name:string;start_date:string;end_date:string;title:string;created:number;created_by:string;status:'approved'|'cancelled';cancelled:number|null;cancelled_by:string|null;reason:string;document_count:number};
export type AbsenceDocument={id:string;absence_id:string;name:string;mime:string;size:number;created:number;created_by:string};
export async function findAbsence(id:string){const db=storage().DB;return await db.prepare("SELECT id,kind,employee_user_id,employee_email,employee_name,start_date,end_date,title,created,created_by,'approved' status,NULL cancelled,NULL cancelled_by,'' reason FROM staff_calendar_events WHERE id=? AND visibility='individual' AND kind IN ('leave','day_off','sick') UNION ALL SELECT id,kind,employee_user_id,employee_email,employee_name,start_date,end_date,title,created,created_by,'cancelled' status,cancelled,cancelled_by,reason FROM staff_absence_archives WHERE id=? LIMIT 1").bind(id,id).first<AbsenceRow>()}
export const absenceExists="EXISTS(SELECT 1 FROM staff_calendar_events WHERE id=? AND kind='sick' AND visibility='individual' UNION ALL SELECT 1 FROM staff_absence_archives WHERE id=? AND kind='sick')";

/** Remove old approval/pending notices and their queued push deliveries. */
export function absenceNoticeCleanup(id:string,includeCancellation=false){
 const requestId=id.startsWith('request-')?id.slice(8):null;
 const prefixes=['calendar-created:'+id+':',...(requestId?['time-off-request:'+requestId+':','time-off-result:'+requestId+':']:[]),...(includeCancellation?['absence-cancelled:'+id+':']:[])];
 const where=prefixes.map(()=>"substr(id,1,?)=?").join(' OR '),args=prefixes.flatMap(prefix=>[prefix.length,prefix]),db=storage().DB;
 return [db.prepare('DELETE FROM work_notification_deliveries WHERE notification_id IN (SELECT id FROM work_notifications WHERE '+where+')').bind(...args),db.prepare('DELETE FROM work_notifications WHERE '+where).bind(...args)];
}
