import {hasPermission} from '@/lib/permissions';
import {getStaffAccess} from '@/lib/staff-access';
import {threadAllowed} from '@/lib/chat';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
export const dynamic='force-dynamic';
export async function POST(req:Request){const a=await getStaffAccess();if(!a?.isApproved||!sameOrigin(req))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});const {conversationId='team',readAt,typing}=await req.json() as {conversationId:string;readAt?:number;typing?:boolean};if(!await threadAllowed(conversationId,a))return Response.json({error:'ჩატი ვერ მოიძებნა.'},{status:404});const now=Date.now(),read=Number.isSafeInteger(readAt)?Math.min(now,Math.max(0,readAt!)):0;await storage().DB.prepare('INSERT INTO chat_reads (conversation_id,user_id,last_read,typing_until) VALUES (?,?,?,?) ON CONFLICT(conversation_id,user_id) DO UPDATE SET last_read=MAX(last_read,excluded.last_read),typing_until=excluded.typing_until').bind(conversationId,a.userId,read,typing&&hasPermission(a,'chat.send')?now+7000:0).run();return Response.json({ok:true})}
