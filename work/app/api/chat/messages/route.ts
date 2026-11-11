import {historyStart} from '@/lib/chat-lifecycle';
import {hasPermission} from '@/lib/permissions';
import {conversationPeople,mentionedUsers} from '@/lib/chat-directory';
import {queuePush,dispatchPush} from '@/lib/push';
import {getStaffAccess} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {CHAT_COLUMNS,publicMessage,threadAllowed,revisionKey,bumpChat,type ChatRow} from '@/lib/chat';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const access=await getStaffAccess(),url=new URL(req.url),thread=url.searchParams.get('conversationId')||'team';
 if(!access?.isApproved||!hasPermission(access,'chat.view'))return Response.json({error:'ჩატი მხოლოდ თანამშრომლებისთვისაა.'},{status:403});
 if(!await threadAllowed(thread,access))return Response.json({error:'ჩატი ვერ მოიძებნა.'},{status:404});
 try{const db=storage().DB;let cutoff=await historyStart(thread,access.userId);const after=Number(url.searchParams.get('afterCreated')||0),afterId=url.searchParams.get('afterId')||'',before=Number(url.searchParams.get('beforeCreated')||0),beforeId=url.searchParams.get('beforeId')||'',hasCursor=Number.isSafeInteger(after)&&after>0&&!!afterId,older=Number.isSafeInteger(before)&&before>0&&!!beforeId;
 // Existing web clients use long-polling; mobile threads use short incremental requests.
 if(hasCursor&&url.searchParams.get('wait')==='1'){
  const revision=url.searchParams.get('revision')||'',until=Date.now()+10000;
  while(Date.now()<until&&!req.signal.aborted){
   const current=await db.prepare(`SELECT (SELECT value FROM workspace_settings WHERE key=?) AS revision,
    EXISTS(SELECT 1 FROM staff_chat_messages WHERE conversation_id=? AND created>? AND (created>? OR (created=? AND id>?))) AS newer`).bind(revisionKey(thread),thread,cutoff,after,after,afterId).first<{revision:string|null;newer:number}>();
   if(current?.newer||(current?.revision||'')!==revision)break;
   await new Promise(resolve=>setTimeout(resolve,1200));
  }
  // A role can be suspended or its chat access revoked while this long poll waits.
  const refreshed=await getStaffAccess();
  if(!refreshed?.isApproved||!await threadAllowed(thread,refreshed))return Response.json({error:'ჩატზე წვდომა შეიცვალა.'},{status:403});
  cutoff=await historyStart(thread,access.userId);
 }
 const query=hasCursor?db.prepare(`SELECT ${CHAT_COLUMNS} FROM staff_chat_messages WHERE conversation_id=? AND created>? AND (created>? OR (created=? AND id>?)) ORDER BY created,id LIMIT 100`).bind(thread,cutoff,after,after,afterId):older?db.prepare(`SELECT ${CHAT_COLUMNS} FROM staff_chat_messages WHERE conversation_id=? AND created>? AND (created<? OR (created=? AND id<?)) ORDER BY created DESC,id DESC LIMIT 50`).bind(thread,cutoff,before,before,beforeId):db.prepare(`SELECT ${CHAT_COLUMNS} FROM staff_chat_messages WHERE conversation_id=? AND created>? ORDER BY created DESC,id DESC LIMIT 50`).bind(thread,cutoff);
 const [recent,pins,state,activity]=await Promise.all([query.all<ChatRow>(),db.prepare(`SELECT ${CHAT_COLUMNS} FROM staff_chat_messages WHERE conversation_id=? AND created>? AND pinned=1 ORDER BY pinned_at DESC LIMIT 50`).bind(thread,cutoff).all<ChatRow>(),db.prepare('SELECT value FROM workspace_settings WHERE key=?').bind(revisionKey(thread)).first<{value:string}>(),db.prepare('SELECT r.user_id,r.last_read,r.typing_until,t.full_name FROM chat_reads r LEFT JOIN team_members t ON t.user_id=r.user_id WHERE r.conversation_id=? AND r.user_id<>?').bind(thread,access.userId).all<{user_id:string;last_read:number;typing_until:number;full_name:string}>()]);
 const messages=(hasCursor?recent.results:[...recent.results].reverse()).map(publicMessage),pinned=pins.results.map(publicMessage);
 const scope=hasCursor?(await db.prepare('SELECT id FROM staff_chat_messages WHERE conversation_id=? AND created>? ORDER BY created DESC,id DESC LIMIT 150').bind(thread,cutoff).all<{id:string}>()).results.map(r=>r.id):messages.map(r=>r.id),ids=[...new Set([...scope,...pinned.map(m=>m.id)])];
 const chunks=<T,>(values:T[])=>Array.from({length:Math.ceil(values.length/80)},(_,i)=>values.slice(i*80,(i+1)*80));
 const reactions=(await Promise.all(chunks(ids).map(async part=>(await db.prepare(`SELECT message_id,emoji,COUNT(*) AS count,MAX(CASE WHEN user_id=? THEN 1 ELSE 0 END) AS mine FROM chat_reactions WHERE message_id IN (${part.map(()=>'?').join(',')}) GROUP BY message_id,emoji`).bind(access.userId,...part).all<{message_id:string;emoji:string;count:number;mine:number}>()).results))).flat();
 const replyIds=[...new Set([...recent.results,...pins.results].map(r=>r.reply_to).filter(Boolean))];
 const replies=(await Promise.all(chunks(replyIds).map(async part=>(await db.prepare(`SELECT id,body,author_name,kind FROM staff_chat_messages WHERE conversation_id=? AND created>? AND id IN (${part.map(()=>'?').join(',')})`).bind(thread,cutoff,...part).all<{id:string;body:string;author_name:string;kind:string}>()).results))).flat();
 const decorate=(m:ReturnType<typeof publicMessage>)=>({...m,reply:replies.find(r=>r.id===m.replyTo)?{id:m.replyTo,body:replies.find(r=>r.id===m.replyTo)!.body,authorName:replies.find(r=>r.id===m.replyTo)!.author_name,kind:replies.find(r=>r.id===m.replyTo)!.kind}:null,reactions:reactions.filter(r=>r.message_id===m.id).map(r=>({emoji:r.emoji,count:r.count,mine:!!r.mine}))});
 return Response.json({historyStart:cutoff,messages:messages.map(decorate),pinned:pinned.map(decorate),revision:state?.value||'',reactionScope:ids,reactionState:reactions,activity:activity.results,hasMore:!hasCursor&&recent.results.length===50},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'ჩატი დროებით მიუწვდომელია.'},{status:503})}
}
export async function POST(req:Request){
 if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});const access=await getStaffAccess();if(!access?.isApproved||!hasPermission(access,'chat.send'))return Response.json({error:'ჩატი მხოლოდ თანამშრომლებისთვისაა.'},{status:403});
 try{const input=await req.json() as {id:string;body:string;conversationId?:string;replyTo?:string;attachmentId?:string},thread=input.conversationId||'team',id=input.id,body=typeof input.body==='string'?input.body.trim():'';
 if(!await threadAllowed(thread,access))return Response.json({error:'ჩატი ვერ მოიძებნა.'},{status:404});
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||body.length>4000||(!body&&!input.attachmentId))return Response.json({error:'შეიყვანე შეტყობინება (მაქსიმუმ 4000 სიმბოლო). '},{status:400});
 const db=storage().DB,cutoff=await historyStart(thread,access.userId),existing=await db.prepare(`SELECT ${CHAT_COLUMNS} FROM staff_chat_messages WHERE id=?`).bind(id).first<ChatRow>();
 if(existing)return existing.created>cutoff&&existing.author_user_id===access.userId&&existing.conversation_id===thread?Response.json({message:publicMessage(existing)}):Response.json({error:'შეტყობინების ID უკვე გამოყენებულია.'},{status:409});
 if(input.replyTo&&!await db.prepare('SELECT id FROM staff_chat_messages WHERE id=? AND conversation_id=? AND created>?').bind(input.replyTo,thread,cutoff).first())return Response.json({error:'საპასუხო შეტყობინება ვერ მოიძებნა.'},{status:400});
 const attachment=input.attachmentId?await db.prepare('SELECT id,mime,duration_ms FROM chat_attachments WHERE id=? AND conversation_id=? AND user_id=?').bind(input.attachmentId,thread,access.userId).first<{id:string;mime:string;duration_ms:number|null}>():null;
 if(input.attachmentId&&!hasPermission(access,'chat.attach'))return Response.json({error:'ფაილის გაზიარების უფლება შეზღუდულია.'},{status:403});
 if(input.attachmentId&&!attachment)return Response.json({error:'ფაილი ვერ მოიძებნა.'},{status:400});
 const kind=attachment?(attachment.mime.startsWith('audio/')?'audio':'image'):'message';
 const now=Date.now(),recent=await db.prepare('SELECT COUNT(*) AS count FROM staff_chat_messages WHERE author_user_id=? AND created>?').bind(access.userId,now-10000).first<{count:number}>();if(Number(recent?.count||0)>=24)return Response.json({error:'რამდენიმე წამში სცადე ხელახლა.'},{status:429});
 // Most messages contain no mention; avoid loading the complete staff directory for them.
 const mentions=/(?:^|[\s(])@[\p{L}\p{N}_.-]+/u.test(body)?mentionedUsers(body,await conversationPeople(thread)).filter(id=>id!==access.userId):[];
 await db.batch([db.prepare('INSERT INTO staff_chat_messages (id,author_user_id,author_email,author_name,author_role,body,kind,conversation_id,reply_to,attachment_id,duration_ms,created) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM chat_deleted_conversations WHERE id=?)').bind(id,access.userId,access.email,access.fullName||'თანამშრომელი',access.role||'',body,kind,thread,input.replyTo||null,input.attachmentId||null,attachment?.duration_ms??null,now,thread),...mentions.map(user=>db.prepare('INSERT INTO chat_mentions (message_id,user_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM staff_chat_messages WHERE id=?)').bind(id,user,id)),bumpChat(thread,access.email),queuePush(id,thread,access.userId,access.fullName,body||(kind==='audio'?'🎤 ხმოვანი შეტყობინება':'📷 ფოტო'))]);
 dispatchPush();
 const row=await db.prepare(`SELECT ${CHAT_COLUMNS} FROM staff_chat_messages WHERE id=?`).bind(id).first<ChatRow>();return row?Response.json({message:publicMessage(row)},{status:201}):Response.json({error:'ჩატი წაშლილია.'},{status:404});
 }catch{return Response.json({error:'შეტყობინება ვერ გაიგზავნა.'},{status:503})}
}
