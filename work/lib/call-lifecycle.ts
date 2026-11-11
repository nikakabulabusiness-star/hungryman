import {storage} from '@/lib/storage';
import {bumpChat} from '@/lib/chat';
export const CALL_ACTIVE_WINDOW=90000;
export const CALL_RING_WINDOW=30000;
export type CallRow={id:string;conversation_id:string;created_by:string;creator_name:string;room:string;mode:'audio'|'video';created:number;ended:number|null;answered_at?:number|null;ended_reason?:string|null;active_count?:number};
const answeredKey=(id:string)=>'call_answered:'+id;
const reasonKey=(id:string)=>'call_end_reason:'+id;
export const callColumns=`c.*,(SELECT CAST(value AS INTEGER) FROM workspace_settings WHERE key='call_answered:'||c.id) AS answered_at,(SELECT value FROM workspace_settings WHERE key='call_end_reason:'||c.id) AS ended_reason`;
export const isGroupCall=(c:CallRow)=>!c.conversation_id.startsWith('dm_');
export function exposeCall(c:CallRow){return {id:c.id,conversationId:c.conversation_id,createdBy:c.created_by,creatorName:c.creator_name,created:c.created,ended:c.ended,mode:c.mode,isGroup:isGroupCall(c),ringUntil:c.created+CALL_RING_WINDOW,answeredAt:c.answered_at||null,durationSeconds:c.answered_at?Math.max(0,Math.floor(((c.ended||Date.now())-c.answered_at)/1000)):0,endedReason:c.ended_reason||null}}
export function readCall(id:string){return storage().DB.prepare(`SELECT ${callColumns},(SELECT COUNT(*) FROM call_members WHERE call_id=c.id AND seen>?) AS active_count FROM chat_calls c WHERE c.id=?`).bind(Date.now()-CALL_ACTIVE_WINDOW,id).first<CallRow>()}
export async function refreshCall(c:CallRow){const now=Date.now();if(c.ended)return c;const expired=now-c.created>=14400000||(!c.answered_at&&now-c.created>=CALL_RING_WINDOW)||(!!c.answered_at&&(c.active_count??6)<(isGroupCall(c)?1:2));return expired?(await endCall(c,c.answered_at?'disconnected':'missed',now,expiration(now)))!:c}
const expiration=(now:number)=>`(c.created<${now-14400000} OR (c.created<=${now-CALL_RING_WINDOW} AND NOT EXISTS(SELECT 1 FROM workspace_settings WHERE key='call_answered:'||c.id)) OR (EXISTS(SELECT 1 FROM workspace_settings WHERE key='call_answered:'||c.id) AND (SELECT COUNT(*) FROM call_members m WHERE m.call_id=c.id AND m.seen>${now-CALL_ACTIVE_WINDOW})<CASE WHEN c.conversation_id LIKE 'dm_%' THEN 2 ELSE 1 END))`;
// End timestamp, reason and deterministic caller-authored summary are committed together.
// SQL rechecks optional expiration/empty-room conditions to avoid racing a new join.
export async function endCall(c:CallRow,reason:string,now=Date.now(),condition='1',conditionValues:(string|number)[]=[]){
 const db=storage().DB,summary='call:'+c.id;
 const message=`CASE WHEN c.mode='video' THEN 'ვიდეოზარი' ELSE 'აუდიოზარი' END || CASE WHEN CAST(s.value AS INTEGER)>0 THEN ' · ხანგრძლივობა ' || CAST(MAX(0,(c.ended-CAST(s.value AS INTEGER))/1000)/60 AS INTEGER) || ':' || printf('%02d',CAST(MAX(0,(c.ended-CAST(s.value AS INTEGER))/1000) AS INTEGER)%60) WHEN r.value='declined' THEN ' · უარყოფილია' WHEN r.value='missed' THEN ' · უპასუხოდ დარჩა' ELSE ' · გაუქმებულია' END`;
 await db.batch([
  db.prepare(`UPDATE chat_calls AS c SET ended=? WHERE id=? AND ended IS NULL AND (${condition})`).bind(now,c.id,...conditionValues),
  db.prepare('INSERT INTO workspace_settings (key,value,updated,updated_by) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM chat_calls WHERE id=? AND ended IS NOT NULL) ON CONFLICT(key) DO NOTHING').bind(reasonKey(c.id),reason,now,'call-system',c.id),
  db.prepare(`INSERT OR IGNORE INTO staff_chat_messages (id,author_user_id,author_email,author_name,author_role,body,kind,reference_id,conversation_id,duration_ms,created)
   SELECT ?,c.created_by,COALESCE(t.email,''),c.creator_name,COALESCE(t.role,''),${message},'message',c.id,c.conversation_id,CASE WHEN CAST(s.value AS INTEGER)>0 THEN MAX(0,c.ended-CAST(s.value AS INTEGER)) ELSE 0 END,c.ended
   FROM chat_calls c LEFT JOIN team_members t ON t.user_id=c.created_by LEFT JOIN workspace_settings s ON s.key='call_answered:'||c.id LEFT JOIN workspace_settings r ON r.key='call_end_reason:'||c.id
   WHERE c.id=? AND c.ended IS NOT NULL AND NOT EXISTS(SELECT 1 FROM chat_deleted_conversations WHERE id=c.conversation_id)`).bind(summary,c.id),
  db.prepare('DELETE FROM call_members WHERE call_id=? AND EXISTS(SELECT 1 FROM chat_calls WHERE id=? AND ended IS NOT NULL)').bind(c.id,c.id),
  db.prepare('DELETE FROM call_signals WHERE call_id=? AND EXISTS(SELECT 1 FROM chat_calls WHERE id=? AND ended IS NOT NULL)').bind(c.id,c.id),
  bumpChat(c.conversation_id,'call-system'),
 ]);
 return readCall(c.id);
}
export async function expireCalls(id?:string){
 const now=Date.now(),db=storage().DB,condition=expiration(now);
 const rows=await db.prepare(`SELECT ${callColumns} FROM chat_calls c WHERE c.ended IS NULL AND ${condition}${id?' AND c.id=?':''} LIMIT 50`).bind(...(id?[id]:[])).all<CallRow>();
 for(const c of rows.results)await endCall(c,c.answered_at?'disconnected':'missed',now,condition);
}
// Run in the same database batch as member insertion: expiry cannot split join/answer.
export function answeredStatement(id:string,now:number){
 return storage().DB.prepare(`INSERT INTO workspace_settings (key,value,updated,updated_by) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM chat_calls WHERE id=? AND ended IS NULL AND created>?) AND (SELECT COUNT(*) FROM call_members WHERE call_id=? AND seen>?)>=2 ON CONFLICT(key) DO NOTHING`).bind(answeredKey(id),String(now),now,'call-system',id,now-CALL_RING_WINDOW,id,now-CALL_ACTIVE_WINDOW);
}
export async function leaveCall(c:CallRow,userId:string,response:'left'|'declined',sessionId?:string){
 const db=storage().DB,now=Date.now();
 // Direct leave and session ownership must be checked in the same transaction.
 // Otherwise a replacement can join between removing the old member and ending.
 if(!isGroupCall(c))return endCall(c,response==='declined'?'declined':c.answered_at?'completed':'cancelled',now,sessionId?'EXISTS(SELECT 1 FROM call_members WHERE call_id=c.id AND user_id=? AND session_id=?)':'1',sessionId?[userId,sessionId]:[]);
 const member=await db.prepare('SELECT session_id FROM call_members WHERE call_id=? AND user_id=?').bind(c.id,userId).first<{session_id:string}>();
 // A stale device cleanup must never disconnect its replacement session.
 if(sessionId&&member?.session_id!==sessionId)return readCall(c.id);
 const removed=await db.prepare(`DELETE FROM call_members WHERE call_id=? AND user_id=?${sessionId?' AND session_id=?':''}`).bind(c.id,userId,...(sessionId?[sessionId]:[])).run();
 if(sessionId&&!removed.meta.changes)return readCall(c.id);
 await db.prepare('INSERT INTO chat_call_responses (call_id,user_id,response,updated) VALUES (?,?,?,?) ON CONFLICT(call_id,user_id) DO UPDATE SET response=excluded.response,updated=excluded.updated').bind(c.id,userId,response,now).run();
 if(member||c.created_by===userId)return endCall(c,c.answered_at?'completed':'cancelled',now,`NOT EXISTS(SELECT 1 FROM call_members WHERE call_id=c.id AND seen>${now-CALL_ACTIVE_WINDOW})`);
 return readCall(c.id);
}
