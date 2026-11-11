import {getStaffAccess} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {hasPermission} from '@/lib/permissions';
import {canReviewRequests,canReviewAccounts} from '@/lib/notification-policy';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved)return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 if(a.features?.notifications===false)return Response.json({userId:a.userId,disabled:true,unread:0,requests:0,chatUnread:0,items:[],next:null},{headers:{'Cache-Control':'private, no-store'}});
 const db=storage().DB,params=new URL(req.url).searchParams,before=Number(params.get('before')||Date.now()+1),beforeId=params.get('beforeId')||'~';
 if(!Number.isSafeInteger(before)||before<0||beforeId.length>240)return Response.json({error:'არასწორი გვერდი.'},{status:400});
 const visibility=" AND (target!='requests' OR ?=1) AND (target!='shoot' OR ?=1) AND (target!='accounts' OR ?=1) AND (target NOT IN ('work','work_task') OR ?=1) AND (target!='work' OR EXISTS(SELECT 1 FROM work_videos v WHERE v.id=target_id AND (category!='work_review' OR (?=1 AND EXISTS(SELECT 1 FROM json_each(v.stages_json) WHERE value='review'))))) AND (target!='work_task' OR EXISTS(SELECT 1 FROM work_tasks t WHERE t.id=target_id AND t.scope='assigned' AND t.deleted IS NULL AND (t.creator_id=? OR t.assignee_id=?)))",visibilityArgs=[canReviewRequests(a)?1:0,hasPermission(a,'shoots.view')?1:0,canReviewAccounts(a)?1:0,a.features?.work!==false&&hasPermission(a,'workspace.view')?1:0,a.role==='Owner'?1:0,a.userId,a.userId];
 const [unread,pending,chat,items]=await Promise.all([
 db.prepare('SELECT COUNT(*) n FROM work_notifications WHERE user_id=? AND read_at IS NULL'+visibility).bind(a.userId,...visibilityArgs).first<{n:number}>(),
 canReviewRequests(a)?db.prepare("SELECT (SELECT COUNT(*) FROM staff_time_off_requests WHERE status='pending')+(SELECT COUNT(*) FROM attendance_requests WHERE status='pending') n").first<{n:number}>():null,
 hasPermission(a,'chat.view')?db.prepare(`SELECT COUNT(*) n FROM staff_chat_messages m LEFT JOIN chat_reads r ON r.conversation_id=m.conversation_id AND r.user_id=? LEFT JOIN chat_hidden_threads h ON h.conversation_id=m.conversation_id AND h.user_id=? WHERE m.author_user_id<>? AND m.created>MAX(COALESCE(r.last_read,0),COALESCE(h.cleared_before,0)) AND NOT EXISTS(SELECT 1 FROM chat_deleted_conversations dc WHERE dc.id=m.conversation_id) AND (m.conversation_id='team' OR m.conversation_id IN(SELECT id FROM chat_threads WHERE user_a=? OR user_b=?) OR m.conversation_id IN(SELECT conversation_id FROM chat_group_members WHERE user_id=?))`).bind(a.userId,a.userId,a.userId,a.userId,a.userId,a.userId).first<{n:number}>():null,
 params.get('counts')==='1'?null:db.prepare('SELECT id,category,title,body,target,target_id,important,created,read_at FROM work_notifications WHERE user_id=? AND (created<? OR (created=? AND id<?))'+visibility+' ORDER BY created DESC,id DESC LIMIT 41').bind(a.userId,before,before,beforeId,...visibilityArgs).all()
 ]);
 const rows=items?.results||[],next=rows.length>40?rows[39] as {created:number;id:string}:null;
 return Response.json({userId:a.userId,unread:unread?.n||0,requests:pending?.n||0,chatUnread:chat?.n||0,items:rows.slice(0,40),next:next?{before:next.created,beforeId:next.id}:null},{headers:{'Cache-Control':'private, no-store'}});
}
export async function PATCH(req:Request){const a=await getStaffAccess();if(!a?.isApproved||!sameOrigin(req))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});const b=await req.json().catch(()=>null) as {id?:string;all?:boolean}|null;if(!b||(b.all!==true&&(typeof b.id!=='string'||b.id.length>240)))return Response.json({error:'არასწორი მოთხოვნა.'},{status:400});await storage().DB.prepare('UPDATE work_notifications SET read_at=? WHERE user_id=? AND read_at IS NULL'+(b.all===true?'':' AND id=?')).bind(Date.now(),a.userId,...(b.all===true?[]:[b.id])).run();return Response.json({ok:true})}
