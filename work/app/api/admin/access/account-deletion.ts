export type AccountDeletionTarget={
 user_id:string;
 email:string;
 avatar_key:string|null;
};

const deletedName='წაშლილი ანგარიში';
const deletedRole='ყოფილი თანამშრომელი';

async function anonymousIdentity(userId:string){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(userId));
 const suffix=Array.from(new Uint8Array(digest).slice(0,8),byte=>byte.toString(16).padStart(2,'0')).join('');
 return {userId:`deleted:${suffix}`,email:`deleted+${suffix}@invalid.local`};
}

/** Only an avatar stored below this exact account-owned prefix may be removed. */
export function ownsAvatarKey(userId:string,key:string|null){
 if(!key||!userId)return false;
 const prefix=`staff-avatars/${userId}/`;
 return key.startsWith(prefix)&&key.length>prefix.length&&!key.includes('..');
}

/**
 * Erases a staff identity while retaining collaborative history under an anonymous author.
 * Chat attachments, shoot photos and other shared R2 objects are deliberately preserved.
 */
export async function deleteAccountData(db:D1Database,bucket:R2Bucket,target:AccountDeletionTarget,actorEmail:string){
 const anonymous=await anonymousIdentity(target.user_id),email=target.email.toLowerCase(),now=Date.now();

 // Delete only the target account's avatar. An unexpected key is treated as shared/foreign.
 if(ownsAvatarKey(target.user_id,target.avatar_key))await bucket.delete(target.avatar_key!);

 // Medical attachments are private, unlike collaborative chat files: remove them on account deletion.
 const absenceIdsQuery="SELECT id FROM staff_calendar_events WHERE employee_user_id=? OR lower(employee_email)=? UNION SELECT id FROM staff_absence_archives WHERE employee_user_id=? OR lower(employee_email)=?";
 const absenceDocuments=(await db.prepare('SELECT object_key FROM staff_absence_documents WHERE absence_id IN ('+absenceIdsQuery+')').bind(target.user_id,email,target.user_id,email).all<{object_key:string}>()).results;
 for(const document of absenceDocuments)await bucket.delete(document.object_key);

 await db.batch([
  db.prepare('DELETE FROM auth_email_challenges WHERE user_id=? OR email=?').bind(target.user_id,email),
  db.prepare('DELETE FROM site_administrators WHERE email=?').bind(email),
  db.prepare('DELETE FROM staff_absence_documents WHERE absence_id IN ('+absenceIdsQuery+')').bind(target.user_id,email,target.user_id,email),
  db.prepare('DELETE FROM staff_absence_archives WHERE employee_user_id=? OR lower(employee_email)=?').bind(target.user_id,email),
  db.prepare('UPDATE staff_absence_documents SET created_by=? WHERE lower(created_by)=?').bind(anonymous.email,email),
  db.prepare('UPDATE staff_absence_archives SET created_by=CASE WHEN lower(created_by)=? THEN ? ELSE created_by END,cancelled_by=CASE WHEN lower(cancelled_by)=? THEN ? ELSE cancelled_by END WHERE lower(created_by)=? OR lower(cancelled_by)=?').bind(email,anonymous.email,email,anonymous.email,email,email),
  // Private tasks have no shared purpose after their creator is erased. Remove their
  // history first, in this same transaction, including tasks previously soft-deleted.
  db.prepare("DELETE FROM work_task_events WHERE task_id IN (SELECT id FROM work_tasks WHERE scope='private' AND creator_id=?)").bind(target.user_id),
  db.prepare("DELETE FROM work_tasks WHERE scope='private' AND creator_id=?").bind(target.user_id),
  // Preserve collaborative records, but remove the former employee's identity from them.
  // Keep the department so its current managers can recover/reassign shared tasks.
  // Advance the revision to reject edits opened before the account was erased.
  db.prepare(`UPDATE work_tasks SET
   creator_id=CASE WHEN creator_id=? THEN ? ELSE creator_id END,
   creator_name=CASE WHEN creator_id=? THEN ? ELSE creator_name END,
   assignee_id=CASE WHEN assignee_id=? THEN ? ELSE assignee_id END,
   assignee_name=CASE WHEN assignee_id=? THEN ? ELSE assignee_name END,
   updated_by=CASE WHEN updated_by=? THEN ? ELSE updated_by END,
   version=version+1,updated=?,mutation_id=?
   WHERE scope='assigned' AND (creator_id=? OR assignee_id=? OR updated_by=?)`)
   .bind(target.user_id,anonymous.userId,target.user_id,deletedName,target.user_id,anonymous.userId,target.user_id,deletedName,target.user_id,anonymous.userId,now,crypto.randomUUID(),target.user_id,target.user_id,target.user_id),
  db.prepare('UPDATE work_task_events SET actor_id=? WHERE actor_id=?').bind(anonymous.userId,target.user_id),
  db.prepare(`UPDATE staff_chat_messages SET author_user_id=?,author_email=?,author_name=?,author_role=?
   WHERE author_user_id=? OR lower(author_email)=?`).bind(anonymous.userId,anonymous.email,deletedName,deletedRole,target.user_id,email),
  db.prepare('UPDATE staff_chat_messages SET pinned_by=? WHERE pinned_by=?').bind(anonymous.userId,target.user_id),
  db.prepare('UPDATE chat_attachments SET user_id=? WHERE user_id=?').bind(anonymous.userId,target.user_id),
  db.prepare('UPDATE shoot_photos SET user_id=? WHERE user_id=?').bind(anonymous.userId,target.user_id),
  db.prepare('UPDATE chat_calls SET created_by=?,creator_name=? WHERE created_by=?').bind(anonymous.userId,deletedName,target.user_id),
  db.prepare('UPDATE chat_groups SET created_by=? WHERE created_by=?').bind(anonymous.userId,target.user_id),
  db.prepare('UPDATE chat_settings SET updated_by=? WHERE updated_by=?').bind(anonymous.userId,target.user_id),
  db.prepare('UPDATE push_outbox SET sender=? WHERE sender=?').bind(anonymous.userId,target.user_id),
  db.prepare('UPDATE chat_threads SET user_a=CASE WHEN user_a=? THEN ? ELSE user_a END,user_b=CASE WHEN user_b=? THEN ? ELSE user_b END WHERE user_a=? OR user_b=?').bind(target.user_id,anonymous.userId,target.user_id,anonymous.userId,target.user_id,target.user_id),
  db.prepare(`UPDATE shoots SET created_by=CASE WHEN lower(created_by)=? THEN ? ELSE created_by END,
   updated_by=CASE WHEN lower(updated_by)=? THEN ? ELSE updated_by END
   WHERE lower(created_by)=? OR lower(updated_by)=?`).bind(email,anonymous.email,email,anonymous.email,email,email),
  db.prepare(`UPDATE shoot_tasks SET assignee_email=?,assignee_name=?,assignee_role=?
   WHERE lower(assignee_email)=?`).bind(anonymous.email,deletedName,deletedRole,email),
  db.prepare(`UPDATE staff_calendar_events SET employee_user_id=?,employee_email=?,employee_name=?
   WHERE employee_user_id=? OR lower(employee_email)=?`).bind(anonymous.userId,anonymous.email,deletedName,target.user_id,email),
  db.prepare(`UPDATE staff_calendar_events SET created_by=CASE WHEN lower(created_by)=? THEN ? ELSE created_by END,
   updated_by=CASE WHEN lower(updated_by)=? THEN ? ELSE updated_by END
   WHERE lower(created_by)=? OR lower(updated_by)=?`).bind(email,anonymous.email,email,anonymous.email,email,email),
  db.prepare(`UPDATE workspace_audit SET actor=CASE WHEN lower(actor)=? THEN ? ELSE actor END,
   target=CASE WHEN lower(target)=? THEN ? ELSE target END
   WHERE lower(actor)=? OR lower(target)=?`).bind(email,anonymous.email,email,anonymous.email,email,email),
  db.prepare('UPDATE staff_time_off_requests SET resolved_by=? WHERE lower(resolved_by)=?').bind(anonymous.email,email),
  db.prepare('UPDATE admin_users SET created_by=? WHERE lower(created_by)=?').bind(anonymous.email,email),
  db.prepare('UPDATE staff_positions SET updated_by=? WHERE lower(updated_by)=?').bind(anonymous.email,email),
  db.prepare(`UPDATE staff_departments SET
   head_name=CASE WHEN head_user_id=? THEN ? ELSE head_name END,
   director_name=CASE WHEN director_user_id=? THEN ? ELSE director_name END,
   head_user_id=CASE WHEN head_user_id=? THEN NULL ELSE head_user_id END,
   director_user_id=CASE WHEN director_user_id=? THEN NULL ELSE director_user_id END,
   updated_by=CASE WHEN lower(updated_by)=? THEN ? ELSE updated_by END
   WHERE head_user_id=? OR director_user_id=? OR lower(updated_by)=?`).bind(target.user_id,deletedName,target.user_id,deletedName,target.user_id,target.user_id,email,anonymous.email,target.user_id,target.user_id,email),
  db.prepare('UPDATE staff_work_patterns SET created_by=? WHERE lower(created_by)=?').bind(anonymous.email,email),
  db.prepare('UPDATE staff_work_patterns SET updated_by=? WHERE lower(updated_by)=?').bind(anonymous.email,email),
  db.prepare('UPDATE staff_leave_entitlements SET updated_by=? WHERE lower(updated_by)=?').bind(anonymous.email,email),
  db.prepare('UPDATE staff_day_off_entitlements SET updated_by=? WHERE lower(updated_by)=?').bind(anonymous.email,email),
  db.prepare('UPDATE workspace_settings SET updated_by=? WHERE lower(updated_by)=?').bind(anonymous.email,email),
  db.prepare('UPDATE social_monthly_metrics SET updated_by=? WHERE lower(updated_by)=?').bind(anonymous.email,email),
  db.prepare('UPDATE applications SET submitter=? WHERE lower(submitter)=?').bind(`admin:${anonymous.email}`,`admin:${email}`),

  // Remove authentication, private profile and user-specific workspace state.
  db.prepare('DELETE FROM staff_sessions WHERE user_id=?').bind(target.user_id),
  db.prepare('DELETE FROM push_devices WHERE user_id=?').bind(target.user_id),
  db.prepare('DELETE FROM chat_reads WHERE user_id=?').bind(target.user_id),
  db.prepare('DELETE FROM chat_preferences WHERE user_id=?').bind(target.user_id),
  db.prepare('DELETE FROM chat_group_members WHERE user_id=?').bind(target.user_id),
  db.prepare('DELETE FROM chat_mentions WHERE user_id=?').bind(target.user_id),
  db.prepare('DELETE FROM chat_reactions WHERE user_id=?').bind(target.user_id),
  db.prepare('DELETE FROM chat_call_responses WHERE user_id=?').bind(target.user_id),
  db.prepare('DELETE FROM call_members WHERE user_id=?').bind(target.user_id),
  db.prepare('DELETE FROM call_signals WHERE sender=? OR recipient=?').bind(target.user_id,target.user_id),
  db.prepare('DELETE FROM private_calendar_notes WHERE user_id=?').bind(target.user_id),
  db.prepare('DELETE FROM staff_time_off_requests WHERE user_id=? OR lower(email)=?').bind(target.user_id,email),
  db.prepare('DELETE FROM staff_attendance WHERE user_id=? OR lower(email)=?').bind(target.user_id,email),
  db.prepare('DELETE FROM staff_work_patterns WHERE lower(employee_email)=?').bind(email),
  db.prepare('DELETE FROM staff_leave_entitlements WHERE lower(employee_email)=?').bind(email),
  db.prepare('DELETE FROM staff_day_off_entitlements WHERE lower(email)=?').bind(email),
  db.prepare("DELETE FROM workspace_settings WHERE key=?").bind(`social.links.${target.user_id}`),
  db.prepare('DELETE FROM employees WHERE lower(email)=?').bind(email),
  db.prepare('DELETE FROM admin_users WHERE lower(email)=?').bind(email),
  db.prepare('DELETE FROM team_members WHERE user_id=?').bind(target.user_id),
  db.prepare('INSERT INTO workspace_audit (id,actor,action,target,details,created) VALUES (?,?,?,?,?,?)')
   .bind(crypto.randomUUID(),actorEmail.toLowerCase()===email?anonymous.email:actorEmail,'account.deleted',anonymous.email,JSON.stringify({deletedAt:now}),now),
 ]);

 return {anonymousUserId:anonymous.userId,anonymousEmail:anonymous.email};
}
