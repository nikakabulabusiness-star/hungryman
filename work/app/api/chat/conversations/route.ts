import {publicRole,threadEnabled} from '@/lib/site-controls';
import {getStaffAccess,listApprovedStaff,type StaffAccess,type StaffDirectoryEntry} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {bumpChat,threadAllowed} from '@/lib/chat';
import {conversationPeople,mentionPeople,chatAudience,chatCapabilities} from '@/lib/chat-directory';
import {hasPermission} from '@/lib/permissions';
import {canDeleteConversation} from '@/lib/chat-lifecycle';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
type GroupInput={id?:string;userId?:unknown;title?:unknown;memberIds?:unknown;departmentIds?:unknown;restoreTeam?:boolean};
const denied=()=>Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
const invalid=()=>Response.json({error:'მიუთითე ჯგუფის სახელი და აქტიური თანამშრომლები.'},{status:400});

async function selectedMembers(input:GroupInput,access:StaffAccess,staff:StaffDirectoryEntry[]){
 const members=input.memberIds??[],departmentIds=input.departmentIds??[];
 if(!Array.isArray(members)||!Array.isArray(departmentIds)||members.length>100||departmentIds.length>20||members.some(id=>typeof id!=='string'||!staff.some(p=>p.userId===id))||departmentIds.some(id=>typeof id!=='string'))return {error:invalid()};
 const {departments,roleDepartments}=await chatAudience(access);
 if(departmentIds.some(id=>!departments.some(d=>d.id===id)))return {error:denied()};
 const ids=[...new Set([access.userId,...members,...staff.filter(p=>p.userId&&roleDepartments(p.role).some(id=>departmentIds.includes(id))).map(p=>p.userId!)])];
 if(ids.length>100)return {error:Response.json({error:'ჯგუფში მაქსიმუმ 100 წევრი შეიძლება იყოს.'},{status:400})};
 return {ids};
}

export async function GET(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||!hasPermission(a,'chat.view'))return denied();
 const db=storage().DB,id=new URL(req.url).searchParams.get('id');
 if(id){
  if(!await threadAllowed(id,a))return Response.json({error:'ჩატი ვერ მოიძებნა.'},{status:404});
  const [group,staff,audience]=await Promise.all([db.prepare('SELECT id,title,created_by FROM chat_groups WHERE id=?').bind(id).first(),conversationPeople(id),chatAudience(a)]);
  return Response.json({group,members:mentionPeople(staff).map(p=>({userId:p.userId,name:p.fullName,role:publicRole(p.role),handle:p.handle,hasAvatar:p.hasAvatar,departmentId:audience.roleDepartment(publicRole(p.role)),departmentIds:audience.roleDepartments(publicRole(p.role))})),permissions:{...chatCapabilities(a,audience.departments.length>0),canDelete:id.startsWith('dm_')||canDeleteConversation(a,id,(group as {created_by?:string}|null)?.created_by)}},{headers});
 }
 const [staff,rows,audience]=await Promise.all([listApprovedStaff(),db.prepare(`WITH visible AS (SELECT 'team' AS id,'' AS user_a,'' AS user_b,'საერთო ჩატი' AS title,'team' AS type WHERE NOT EXISTS(SELECT 1 FROM chat_deleted_conversations WHERE id='team') UNION ALL SELECT id,user_a,user_b,'' AS title,'direct' AS type FROM chat_threads WHERE user_a=? OR user_b=? UNION ALL SELECT g.id,'','',g.title,'group' FROM chat_groups g JOIN chat_group_members gm ON gm.conversation_id=g.id WHERE gm.user_id=?)
 SELECT t.*,s.emoji,s.photo_id,s.updated,m.id AS message_id,m.body,m.created,m.author_user_id,m.kind,
 (SELECT COUNT(*) FROM staff_chat_messages x WHERE x.conversation_id=t.id AND x.author_user_id<>? AND x.created>MAX(COALESCE(r.last_read,0),COALESCE(h.cleared_before,0))) AS unread
 FROM visible t LEFT JOIN chat_hidden_threads h ON h.conversation_id=t.id AND h.user_id=? LEFT JOIN chat_settings s ON s.conversation_id=t.id LEFT JOIN chat_reads r ON r.conversation_id=t.id AND r.user_id=?
 LEFT JOIN staff_chat_messages m ON m.id=(SELECT id FROM staff_chat_messages WHERE conversation_id=t.id AND created>COALESCE(h.cleared_before,0) ORDER BY created DESC,id DESC LIMIT 1) WHERE h.hidden IS NULL OR h.hidden=0 OR m.created>h.cleared_before`)
 .bind(a.userId,a.userId,a.userId,a.userId,a.userId,a.userId).all<{id:string;type:string;title:string;user_a:string;user_b:string;emoji:string|null;photo_id:string|null;updated:number|null;message_id:string|null;body:string;created:number;author_user_id:string;kind:string;unread:number}>(),chatAudience(a)]);
 const people=mentionPeople(staff.filter(p=>p.userId&&p.userId!==a.userId)).map(p=>({userId:p.userId!,name:p.fullName,role:publicRole(p.role),departmentId:audience.roleDepartment(publicRole(p.role)),departmentIds:audience.roleDepartments(publicRole(p.role)),handle:p.handle,hasAvatar:p.hasAvatar,active:Date.now()-Number(p.lastSeen||0)<90000}));
 const conversations=rows.results.filter(t=>threadEnabled(t.id,a.features)).flatMap(t=>{const peer=people.find(p=>p.userId===(t.user_a===a.userId?t.user_b:t.user_a));if(t.type==='direct'&&!peer)return [];return [{id:t.id,type:t.type,title:peer?.name||t.title,peer:peer||null,settings:{emoji:t.emoji||'❤️',photoId:t.photo_id,updated:t.updated||0},last:t.message_id?{body:t.body,created:t.created,author_user_id:t.author_user_id,kind:t.kind}:null,unread:Number(t.unread||0)}]});
 const teamDeleted=a.features?.teamChat!==false&&!!a.isDeveloper&&!conversations.some(c=>c.id==='team');
 return Response.json({canRestoreTeam:teamDeleted,conversations:conversations.sort((a,b)=>a.id==='team'?-1:b.id==='team'?1:(b.last?.created||0)-(a.last?.created||0)),people,departments:audience.departments,permissions:chatCapabilities(a,audience.departments.length>0)},{headers});
}

export async function POST(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||!hasPermission(a,'chat.view')||!sameOrigin(req))return denied();
 const b=await req.json().catch(()=>null) as GroupInput|null;if(!b||typeof b!=='object')return invalid();
 const staff=await listApprovedStaff(),db=storage().DB;
 if(b.userId&&a.features?.privateChats===false)return denied();
 if(b.restoreTeam===true){if(!a.isDeveloper)return denied();await db.batch([db.prepare("DELETE FROM chat_deleted_conversations WHERE id='team'"),bumpChat('team',a.email)]);return Response.json({id:'team'})}
 if(b.memberIds!==undefined||b.departmentIds!==undefined){
  if(!hasPermission(a,'chat.create_group'))return denied();
  if(typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>80)return invalid();
  const selected=await selectedMembers(b,a,staff);if(selected.error)return selected.error;if(selected.ids!.length<2)return invalid();
  const id='grp_'+crypto.randomUUID(),now=Date.now();
  await db.batch([db.prepare('INSERT INTO chat_groups (id,title,created_by,created,updated) VALUES (?,?,?,?,?)').bind(id,b.title.trim(),a.userId,now,now),...selected.ids!.map(user=>db.prepare('INSERT INTO chat_group_members (conversation_id,user_id,joined) VALUES (?,?,?)').bind(id,user,now))]);
  return Response.json({id},{status:201});
 }
 if(!hasPermission(a,'chat.send'))return denied();
 const userId=b.userId;if(typeof userId!=='string'||userId===a.userId||!staff.some(p=>p.userId===userId))return Response.json({error:'თანამშრომელი ვერ მოიძებნა.'},{status:404});
 const pair=[a.userId,userId].sort(),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(pair))),id='dm_'+Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
 await db.batch([db.prepare('INSERT OR IGNORE INTO chat_threads (id,user_a,user_b,created) VALUES (?,?,?,?)').bind(id,pair[0],pair[1],Date.now()),db.prepare('UPDATE chat_hidden_threads SET hidden=0 WHERE conversation_id=? AND user_id=?').bind(id,a.userId)]);return Response.json({id});
}

export async function DELETE(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||!hasPermission(a,'chat.view')||!sameOrigin(req))return denied();const b=await req.json().catch(()=>null) as {id?:unknown}|null;if(!b||typeof b.id!=='string')return invalid();
 const db=storage().DB,id=b.id,now=Date.now();
 if(id.startsWith('dm_')){if(!await threadAllowed(id,a))return denied();await db.batch([db.prepare('INSERT INTO chat_hidden_threads (conversation_id,user_id,cleared_before,hidden) VALUES (?,?,?,1) ON CONFLICT(conversation_id,user_id) DO UPDATE SET cleared_before=excluded.cleared_before,hidden=1').bind(id,a.userId,now),db.prepare('UPDATE chat_reads SET last_read=? WHERE conversation_id=? AND user_id=?').bind(now,id,a.userId)]);return Response.json({ok:true,scope:'self',clearedBefore:now})}
 const deleted=await db.prepare('SELECT deleted_by FROM chat_deleted_conversations WHERE id=?').bind(id).first<{deleted_by:string}>();
 if(deleted)return canDeleteConversation(a,id,deleted.deleted_by)?Response.json({ok:true,scope:'everyone'}):denied();
 const group=await db.prepare('SELECT created_by FROM chat_groups WHERE id=?').bind(id).first<{created_by:string}>();
 if(!canDeleteConversation(a,id,group?.created_by)||(id!=='team'&&!group))return denied();
 const files=(await db.prepare('SELECT object_key FROM chat_attachments WHERE conversation_id=?').bind(id).all<{object_key:string}>()).results;
 await db.batch([
 db.prepare('INSERT OR REPLACE INTO chat_deleted_conversations (id,deleted,deleted_by) VALUES (?,?,?)').bind(id,now,a.userId),
 db.prepare('DELETE FROM chat_reactions WHERE message_id IN(SELECT id FROM staff_chat_messages WHERE conversation_id=?)').bind(id),
 db.prepare('DELETE FROM chat_mentions WHERE message_id IN(SELECT id FROM staff_chat_messages WHERE conversation_id=?)').bind(id),
 db.prepare('DELETE FROM staff_chat_messages WHERE conversation_id=?').bind(id),
 db.prepare('DELETE FROM call_signals WHERE call_id IN(SELECT id FROM chat_calls WHERE conversation_id=?)').bind(id),
 db.prepare('DELETE FROM call_members WHERE call_id IN(SELECT id FROM chat_calls WHERE conversation_id=?)').bind(id),
 db.prepare('DELETE FROM chat_call_responses WHERE call_id IN(SELECT id FROM chat_calls WHERE conversation_id=?)').bind(id),
 ...['chat_calls','chat_attachments','chat_settings','chat_reads','chat_preferences','chat_group_members','chat_hidden_threads','push_outbox'].map(table=>db.prepare('DELETE FROM '+table+' WHERE conversation_id=?').bind(id)),db.prepare('DELETE FROM chat_groups WHERE id=?').bind(id),bumpChat(id,a.email)
 ]);
 // Tombstones revoke access before best-effort removal of the object bytes.
 for(let offset=0;offset<files.length;offset+=100)await storage().BUCKET.delete(files.slice(offset,offset+100).map(f=>f.object_key)).catch(()=>{});
 return Response.json({ok:true,scope:'everyone'});
}

export async function PATCH(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||!hasPermission(a,'chat.manage_group')||!sameOrigin(req))return denied();
 const b=await req.json().catch(()=>null) as GroupInput|null;if(!b||typeof b.id!=='string')return invalid();
 if(!await threadAllowed(b.id,a)||!await storage().DB.prepare('SELECT id FROM chat_groups WHERE id=?').bind(b.id).first())return Response.json({error:'ჯგუფი ვერ მოიძებნა.'},{status:404});
 if(b.title!==undefined&&(typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>80))return invalid();
 const selected=await selectedMembers(b,a,await listApprovedStaff());if(selected.error)return selected.error;
 const db=storage().DB,now=Date.now(),statements=[];
 if(typeof b.title==='string')statements.push(db.prepare('UPDATE chat_groups SET title=?,updated=? WHERE id=?').bind(b.title.trim(),now,b.id));
 for(const id of selected.ids!)statements.push(db.prepare('INSERT OR IGNORE INTO chat_group_members (conversation_id,user_id,joined) VALUES (?,?,?)').bind(b.id,id,now));
 if(statements.length)await db.batch(statements);return Response.json({ok:true});
}
