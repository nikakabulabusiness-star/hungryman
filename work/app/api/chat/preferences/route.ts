import {hasPermission} from '@/lib/permissions';
import {getStaffAccess} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {threadAllowed} from '@/lib/chat';
export const dynamic='force-dynamic';
export async function GET(){
 const a=await getStaffAccess();if(!a?.isApproved||!hasPermission(a,'chat.view'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 const rows=await storage().DB.prepare("SELECT conversation_id FROM chat_preferences WHERE user_id=? AND muted=1 AND (conversation_id='team' OR conversation_id IN (SELECT id FROM chat_threads WHERE user_a=? OR user_b=?) OR conversation_id IN (SELECT conversation_id FROM chat_group_members WHERE user_id=?))").bind(a.userId,a.userId,a.userId,a.userId).all<{conversation_id:string}>();
 return Response.json({mutedIds:rows.results.map(r=>r.conversation_id)},{headers:{'Cache-Control':'private, no-store'}});
}
export async function PATCH(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||!hasPermission(a,'chat.view')||!sameOrigin(req))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 let b:{conversationId?:string;muted?:boolean};try{b=await req.json()}catch{return Response.json({error:'არასწორი მოთხოვნა.'},{status:400})}
 if(!b||typeof b.conversationId!=='string'||typeof b.muted!=='boolean')return Response.json({error:'არასწორი მოთხოვნა.'},{status:400});
 if(!await threadAllowed(b.conversationId,a))return Response.json({error:'ჩატი ვერ მოიძებნა.'},{status:404});
 await storage().DB.prepare('INSERT INTO chat_preferences (conversation_id,user_id,muted,updated) VALUES (?,?,?,?) ON CONFLICT(conversation_id,user_id) DO UPDATE SET muted=excluded.muted,updated=excluded.updated').bind(b.conversationId,a.userId,b.muted?1:0,Date.now()).run();
 return GET();
}
