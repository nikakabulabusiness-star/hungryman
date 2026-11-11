import {hasPermission,type PermissionActor} from './permissions';
export type NoticeTarget='shoot'|'requests'|'attendance'|'calendar'|'chat'|'notifications'|'accounts'|'work'|'work_task';
export type AttendanceAnswer='late'|'absent'|'remote';
export const attendanceAnswers:Record<AttendanceAnswer,string>={late:'მაგვიანდება',absent:'არ ვმუშაობ',remote:'დისტანციურზე ვარ'};
export const reviewRoles=['Developer','Owner','HR'];
export function isAttendanceAnswer(value:unknown):value is AttendanceAnswer{return typeof value==='string'&&Object.hasOwn(attendanceAnswers,value)}
export function noticeHref(target:NoticeTarget,id:string){return target==='work'?'/work/tasks/video/'+encodeURIComponent(id):target==='work_task'?'/work/tasks?view=mine&task='+encodeURIComponent(id):target==='accounts'?'/admin/access':target==='shoot'?'/shoots#shoot-'+encodeURIComponent(id):target==='requests'?'/admin/time-off':target==='chat'?'/chat?conversationId='+encodeURIComponent(id):target==='attendance'||target==='calendar'?'/team':'/team/notifications'}

export function canReviewRequests(actor:PermissionActor|null|undefined){return !!actor&&(actor.isSiteAdmin||reviewRoles.includes(actor.role||''))&&hasPermission(actor,'calendar.manage')}

export function canReviewAccounts(actor:PermissionActor|null|undefined){return !!actor&&(actor.isSiteAdmin||reviewRoles.includes(actor.role||''))&&hasPermission(actor,'accounts.view')&&hasPermission(actor,'accounts.manage')}
