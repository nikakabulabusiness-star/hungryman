import {hasPermission,type PermissionActor} from './permissions';
import {storage} from './storage';

/** A creator can remove their group; granted moderators can remove any group.
 * The shared team conversation is deliberately independent of role grants. */
export function canDeleteConversation(actor:PermissionActor&{userId:string},id:string,creator?:string|null){
 if(actor.isApproved===false||actor.isApprovedStaff===false||!hasPermission(actor,'chat.view'))return false;
 return id==='team'?!!actor.isDeveloper:id.startsWith('grp_')&&(creator===actor.userId||hasPermission(actor,'chat.delete_group'));
}
/** Clearing a direct thread never changes the other participant's history. */
export async function historyStart(conversation:string,userId:string){
 if(!conversation.startsWith('dm_'))return 0;
 const row=await storage().DB.prepare('SELECT cleared_before FROM chat_hidden_threads WHERE conversation_id=? AND user_id=?').bind(conversation,userId).first<{cleared_before:number}>();
 return Number(row?.cleared_before)||0;
}
