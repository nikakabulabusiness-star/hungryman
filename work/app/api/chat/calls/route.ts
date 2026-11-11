import {hasPermission} from '@/lib/permissions';
import {queuePush,dispatchPush} from '@/lib/push';
import {getStaffAccess} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {threadAllowed} from '@/lib/chat';
import {callColumns,readCall,exposeCall,expireCalls,refreshCall,leaveCall,type CallRow} from '@/lib/call-lifecycle';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||!hasPermission(a,'chat.view')||!hasPermission(a,'chat.call'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 const db=storage().DB,id=new URL(req.url).searchParams.get('id');
 if(id){const before=await readCall(id);if(!before||!await threadAllowed(before.conversation_id,a))return Response.json({error:'ზარი ვერ მოიძებნა.'},{status:404});return Response.json({call:exposeCall(await refreshCall(before))},{headers})}
 await expireCalls();
 const calls=await db.prepare(`SELECT ${callColumns} FROM chat_calls c WHERE c.ended IS NULL AND (c.conversation_id='team' OR c.conversation_id IN (SELECT id FROM chat_threads WHERE user_a=? OR user_b=?) OR c.conversation_id IN (SELECT conversation_id FROM chat_group_members WHERE user_id=?)) AND NOT EXISTS (SELECT 1 FROM chat_call_responses r WHERE r.call_id=c.id AND r.user_id=? AND r.response IN ('declined','left')) ORDER BY c.created DESC LIMIT 20`).bind(a.userId,a.userId,a.userId,a.userId).all<CallRow>();
 const muted=await db.prepare('SELECT conversation_id FROM chat_preferences WHERE user_id=? AND muted=1').bind(a.userId).all<{conversation_id:string}>(),ids=new Set(calls.results.map(c=>c.conversation_id));
 return Response.json({userId:a.userId,mutedIds:muted.results.filter(r=>ids.has(r.conversation_id)).map(r=>r.conversation_id),calls:calls.results.map(exposeCall)},{headers});
}
export async function POST(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||!hasPermission(a,'chat.call')||!sameOrigin(req))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 const {conversationId='team',mode='video'}=await req.json() as {conversationId:string;mode:'audio'|'video'};
 if(!['audio','video'].includes(mode))return Response.json({error:'არასწორი ზარის ტიპი.'},{status:400});if(!await threadAllowed(conversationId,a))return Response.json({error:'ჩატი ვერ მოიძებნა.'},{status:404});
 await expireCalls();const db=storage().DB,now=Date.now(),active=await db.prepare(`SELECT ${callColumns} FROM chat_calls c WHERE conversation_id=? AND ended IS NULL ORDER BY created DESC LIMIT 1`).bind(conversationId).first<CallRow>();
 if(active)return Response.json({userId:a.userId,call:exposeCall(active)},{headers});
 const rate=await db.prepare('SELECT COUNT(*) AS n FROM chat_calls WHERE created_by=? AND created>?').bind(a.userId,now-10000).first<{n:number}>();if((rate?.n||0)>=4)return Response.json({error:'რამდენიმე წამში სცადე ხელახლა.'},{status:429});
 const c:CallRow={id:crypto.randomUUID(),conversation_id:conversationId,created_by:a.userId,creator_name:a.fullName,room:'HungrymanWork'+crypto.randomUUID().replaceAll('-',''),mode,created:now,ended:null};
 await db.prepare('INSERT INTO chat_calls (id,conversation_id,created_by,creator_name,room,mode,created) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM chat_deleted_conversations WHERE id=?) AND NOT EXISTS (SELECT 1 FROM chat_calls WHERE conversation_id=? AND ended IS NULL)').bind(c.id,c.conversation_id,c.created_by,c.creator_name,c.room,c.mode,c.created,conversationId,conversationId).run();
 const started=await db.prepare(`SELECT ${callColumns} FROM chat_calls c WHERE conversation_id=? AND ended IS NULL ORDER BY created DESC LIMIT 1`).bind(conversationId).first<CallRow>();if(!started)return Response.json({error:'ჩატი წაშლილია.'},{status:404});
 if(started.id===c.id){await queuePush(c.id,conversationId,a.userId,a.fullName,mode==='audio'?'შემომავალი აუდიოზარი':'შემომავალი ვიდეოზარი',c.id).run();dispatchPush()}
 return Response.json({userId:a.userId,call:exposeCall(started)},{status:started.id===c.id?201:200,headers});
}
export async function PATCH(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||!hasPermission(a,'chat.call')||!sameOrigin(req))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 const {id,action}=await req.json() as {id:string;action:string},c=await readCall(id);if(!c||!await threadAllowed(c.conversation_id,a))return Response.json({error:'ზარი ვერ მოიძებნა.'},{status:404});
 if(!['opened','declined','left','end'].includes(action))return Response.json({error:'არასწორი მოქმედება.'},{status:400});
 if(action==='opened')return Response.json({ok:true,call:exposeCall(c)},{headers});
 const updated=await leaveCall(c,a.userId,action==='declined'?'declined':'left');
 return Response.json({ok:true,call:updated?exposeCall(updated):null},{headers});
}
