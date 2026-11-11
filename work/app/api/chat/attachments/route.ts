import {historyStart} from '@/lib/chat-lifecycle';
import {hasPermission} from '@/lib/permissions';
import {getStaffAccess} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {threadAllowed} from '@/lib/chat';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||!hasPermission(a,'chat.view'))return new Response(null,{status:403});
 const id=new URL(req.url).searchParams.get('id')||'',{DB,BUCKET}=storage(),row=await DB.prepare('SELECT * FROM chat_attachments WHERE id=?').bind(id).first<{conversation_id:string;object_key:string;mime:string}>();
 if(!row||!await threadAllowed(row.conversation_id,a))return new Response(null,{status:404});
 const cutoff=await historyStart(row.conversation_id,a.userId);
 if(cutoff&&!await DB.prepare('SELECT id FROM staff_chat_messages WHERE attachment_id=? AND conversation_id=? AND created>? UNION ALL SELECT photo_id AS id FROM chat_settings WHERE conversation_id=? AND photo_id=?').bind(id,row.conversation_id,cutoff,row.conversation_id,id).first())return new Response(null,{status:404});
 const headers:Record<string,string>={'Content-Type':row.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
 const range=req.headers.get('range');
 if(range){
  const metadata=await BUCKET.head(row.object_key);if(!metadata)return new Response(null,{status:404});const size=metadata.size,match=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2])),end=match[1]?(match[2]?Math.min(size-1,Number(match[2])):size-1):size-1;
  if(!Number.isSafeInteger(start)||start>=size||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  const obj=await BUCKET.get(row.object_key,{range:{offset:start,length:end-start+1}});if(!obj)return new Response(null,{status:404});
  return new Response(obj.body,{status:206,headers:{...headers,'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':String(end-start+1)}});
 }
 const obj=await BUCKET.get(row.object_key);return obj?new Response(obj.body,{headers:{...headers,'Content-Length':String(obj.size),'Content-Disposition':`inline; filename="${id}.${row.mime==='audio/wav'?'wav':row.mime==='audio/mp4'?'m4a':row.mime==='image/png'?'png':'jpg'}"`}}):new Response(null,{status:404});
}
export async function POST(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||!hasPermission(a,'chat.attach')||!hasPermission(a,'chat.send')||!sameOrigin(req))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 try{
  const url=new URL(req.url),type=req.headers.get('content-type')||'',isAudio=type.startsWith('audio/'),limit=(isAudio?10:5)*1024*1024;
  if(Number(req.headers.get('content-length')||0)>limit+65536)return Response.json({error:'ფაილი ზედმეტად დიდია.'},{status:413});
  let thread=url.searchParams.get('conversationId')||'team',bytes:Uint8Array;
  if(type.startsWith('multipart/form-data')){const form=await req.formData(),file=form.get('file');thread=String(form.get('conversationId')||thread);if(!file||typeof file==='string'||!file.size||file.size>limit)return Response.json({error:'ფოტო უნდა იყოს 5 MB-მდე.'},{status:400});bytes=new Uint8Array(await file.arrayBuffer())}
  else {if(!await threadAllowed(thread,a))return Response.json({error:'ჩატი ვერ მოიძებნა.'},{status:404});bytes=new Uint8Array(await req.arrayBuffer())}
  if(!await threadAllowed(thread,a))return Response.json({error:'ჩატი ვერ მოიძებნა.'},{status:404});
  if(bytes.length<4||bytes.length>limit)return Response.json({error:'ფაილი ცარიელია ან ზედმეტად დიდია.'},{status:400});
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
  const tag=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end));
  const wav=isAudio&&bytes.length>44&&tag(0,4)==='RIFF'&&tag(8,12)==='WAVE',mp4=isAudio&&bytes.length>24&&tag(4,8)==='ftyp';
  const duration=isAudio?Number(url.searchParams.get('durationMs')):null;
  if(isAudio?(!wav&&!mp4||!Number.isSafeInteger(duration)||duration!<500||duration!>300000):(!jpeg&&!png))return Response.json({error:isAudio?'აირჩიე 1 წამიდან 5 წუთამდე ხმოვანი ჩანაწერი (M4A ან WAV).':'აირჩიე JPG ან PNG ფოტო.'},{status:400});
  const mime=isAudio?(wav?'audio/wav':'audio/mp4'):(jpeg?'image/jpeg':'image/png');
  const id=url.searchParams.get('id')||crypto.randomUUID();if(!/^[a-f\d-]{36}$/i.test(id))return Response.json({error:'არასწორი ფაილის ID.'},{status:400});
  const {DB,BUCKET}=storage(),existing=await DB.prepare('SELECT conversation_id,user_id FROM chat_attachments WHERE id=?').bind(id).first<{conversation_id:string;user_id:string}>();
  if(existing)return existing.user_id===a.userId&&existing.conversation_id===thread?Response.json({id}):Response.json({error:'ფაილის ID უკვე გამოიყენება.'},{status:409});
  const recent=await DB.prepare('SELECT COUNT(*) AS n FROM chat_attachments WHERE user_id=? AND created>?').bind(a.userId,Date.now()-3600000).first<{n:number}>();
  if((recent?.n||0)>=50)return Response.json({error:'საათში მაქსიმუმ 50 ფაილის გაზიარებაა შესაძლებელი.'},{status:429});
  const key='chat/'+id+'/'+crypto.randomUUID();await BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
  const inserted=await DB.prepare('INSERT OR IGNORE INTO chat_attachments (id,conversation_id,user_id,object_key,mime,name,duration_ms,created) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM chat_deleted_conversations WHERE id=?)').bind(id,thread,a.userId,key,mime,isAudio?'ხმოვანი შეტყობინება':'ფოტო',duration,Date.now(),thread).run();
  if(!inserted.meta.changes){await BUCKET.delete(key).catch(()=>{});const retained=await DB.prepare('SELECT conversation_id,user_id FROM chat_attachments WHERE id=?').bind(id).first<{conversation_id:string;user_id:string}>();return retained?.conversation_id===thread&&retained.user_id===a.userId?Response.json({id}):Response.json({error:'ჩატი წაშლილია ან ფაილის ID გამოიყენება.'},{status:409})}
  return Response.json({id},{status:201});
 }catch(e){console.error('chat-attachment-upload',e instanceof Error?e.message:'unknown');return Response.json({error:'ფაილის ატვირთვა შეფერხდა. სცადე ხელახლა.'},{status:503})}
}
