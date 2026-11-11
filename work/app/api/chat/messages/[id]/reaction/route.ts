import {hasPermission} from '@/lib/permissions';
import {messageAccess,bumpChat} from '@/lib/chat';
import {getStaffAccess} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
export const dynamic='force-dynamic';
const allowed=['❤️','😂','👍','😮','😢','🙌'];
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){const access=await getStaffAccess();if(!access?.isApproved||!hasPermission(access,'chat.send')||!sameOrigin(req))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});const {id}=await params,{emoji}=await req.json() as {emoji:string};if(!allowed.includes(emoji))return Response.json({error:'არასწორი რეაქცია.'},{status:400});const {DB}=storage();const permitted=await messageAccess(id);if(!permitted)return Response.json({error:'შეტყობინება ვერ მოიძებნა.'},{status:404});const previous=await DB.prepare('SELECT emoji FROM chat_reactions WHERE message_id=? AND user_id=?').bind(id,access.userId).first<{emoji:string}>(),now=Date.now();await DB.batch([previous?.emoji===emoji?DB.prepare('DELETE FROM chat_reactions WHERE message_id=? AND user_id=?').bind(id,access.userId):DB.prepare('INSERT INTO chat_reactions (message_id,user_id,emoji,created) VALUES (?,?,?,?) ON CONFLICT(message_id,user_id) DO UPDATE SET emoji=excluded.emoji,created=excluded.created').bind(id,access.userId,emoji,now),bumpChat(permitted.conversationId,access.email)]);return Response.json({ok:true})}
