import {publicRole,threadEnabled} from './site-controls';
import {historyStart} from './chat-lifecycle';
import {getStaffAccess,type StaffAccess} from './staff-access';
import {storage} from './storage';
import {hasPermission} from './permissions';
export const CHAT_COLUMNS='id,author_user_id,author_name,author_role,body,kind,reference_id,conversation_id,reply_to,attachment_id,duration_ms,created,pinned,pinned_by,pinned_at';
export type ChatRow={id:string;author_user_id:string;author_name:string;author_role:string;body:string;kind:string;reference_id:string|null;conversation_id:string;reply_to:string|null;attachment_id:string|null;duration_ms:number|null;created:number;pinned:number;pinned_at:number|null};
export function publicMessage(r:ChatRow){return {id:r.id,authorUserId:r.author_user_id,authorName:r.author_name,authorRole:publicRole(r.author_role),body:r.body,kind:r.kind,referenceId:r.reference_id,conversationId:r.conversation_id,replyTo:r.reply_to,attachmentId:r.attachment_id,durationMs:r.duration_ms,created:r.created,pinned:!!r.pinned,pinnedAt:r.pinned_at}}
export async function threadAllowed(id:string,access:StaffAccess){
 if(!access.isApproved||!threadEnabled(id,access.features)||!hasPermission(access,'chat.view'))return false;
 // One statement keeps the tombstone and membership decision in the same snapshot.
 return !!await storage().DB.prepare(`SELECT ? AS id WHERE NOT EXISTS(SELECT 1 FROM chat_deleted_conversations WHERE id=?) AND
  (?='team' OR EXISTS(SELECT 1 FROM chat_threads WHERE id=? AND (user_a=? OR user_b=?)) OR
   EXISTS(SELECT 1 FROM chat_group_members WHERE conversation_id=? AND user_id=?))`)
  .bind(id,id,id,id,access.userId,access.userId,id,access.userId).first();
}
export async function messageAccess(id:string){const access=await getStaffAccess();if(!access?.isApproved)return null;const message=await storage().DB.prepare('SELECT conversation_id,created FROM staff_chat_messages WHERE id=?').bind(id).first<{conversation_id:string;created:number}>();return message&&await threadAllowed(message.conversation_id,access)&&message.created>await historyStart(message.conversation_id,access.userId)?{access,conversationId:message.conversation_id}:null}
export function revisionKey(id:string){return id==='team'?'chat_revision':'chat_revision:'+id}
export function bumpChat(id:string,email:string){return storage().DB.prepare('INSERT INTO workspace_settings (key,value,updated,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated,updated_by=excluded.updated_by').bind(revisionKey(id),crypto.randomUUID(),Date.now(),email)}
