import {hasPermission} from '@/lib/permissions';
import {getStaffAccess} from '@/lib/staff-access';
import {threadAllowed} from '@/lib/chat';
import {storage} from '@/lib/storage';

export const dynamic='force-dynamic';
const MAX_BYTES=5*1024*1024,ACTIVE_WINDOW=90000;
const headers={'Cache-Control':'private, no-store','Vary':'Authorization, Cookie','X-Content-Type-Options':'nosniff'};
function imageType(bytes:Uint8Array){
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export async function GET(req:Request){
 const access=await getStaffAccess();
 if(!access?.isApproved||!hasPermission(access,'chat.call'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403,headers});
 const params=new URL(req.url).searchParams,id=params.get('id')||'',sessionId=params.get('sessionId')||'',userId=params.get('userId')||access.userId;
 if(!id||id.length>180||!sessionId||sessionId.length>100||userId.length>256)return Response.json({error:'არასწორი მოთხოვნა.'},{status:400,headers});
 const {DB,BUCKET}=storage(),now=Date.now();
 const call=await DB.prepare('SELECT conversation_id,created,ended FROM chat_calls WHERE id=?').bind(id).first<{conversation_id:string;created:number;ended:number|null}>();
 if(!call||call.ended||now-call.created>14400000||!await threadAllowed(call.conversation_id,access))return Response.json({error:'ზარი ვერ მოიძებნა.'},{status:404,headers});
 const member=await DB.prepare('SELECT session_id FROM call_members WHERE call_id=? AND user_id=? AND seen>?').bind(id,access.userId,now-ACTIVE_WINDOW).first<{session_id:string}>();
 if(member?.session_id!==sessionId)return Response.json({error:'ზარის სესია დასრულებულია.'},{status:409,headers});
 if(userId!==access.userId&&!await DB.prepare('SELECT user_id FROM call_members WHERE call_id=? AND user_id=? AND seen>?').bind(id,userId,now-ACTIVE_WINDOW).first())return Response.json({error:'მონაწილე ვერ მოიძებნა.'},{status:404,headers});
 const profile=await DB.prepare('SELECT avatar_key FROM team_members WHERE user_id=? LIMIT 1').bind(userId).first<{avatar_key:string|null}>();
 if(!profile?.avatar_key)return Response.json({dataUrl:null},{headers});
 try{
  const object=await BUCKET.get(profile.avatar_key);
  if(!object||object.size>MAX_BYTES)return Response.json({dataUrl:null},{headers});
  const bytes=new Uint8Array(await object.arrayBuffer()),mime=imageType(bytes);
  if(!mime||bytes.length>MAX_BYTES)return Response.json({dataUrl:null},{headers});
  let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
  return Response.json({dataUrl:`data:${mime};base64,${btoa(binary)}`},{headers});
 }catch{return Response.json({dataUrl:null},{headers})}
}
