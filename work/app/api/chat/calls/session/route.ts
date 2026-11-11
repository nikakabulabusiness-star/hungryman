import {CALL_ACTIVE_WINDOW,refreshCall,readCall,exposeCall,isGroupCall,answeredStatement,leaveCall} from '@/lib/call-lifecycle';
import {callIce} from '@/lib/call-ice';
import {hasPermission} from '@/lib/permissions';
import {getStaffAccess} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {threadAllowed} from '@/lib/chat';
export const dynamic='force-dynamic';
// Leave brief signaling/network gaps time to recover while media is still connected.
const ACTIVE_WINDOW=CALL_ACTIVE_WINDOW;
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f\d-]{36}$/i.test(v);
async function access(id:string,cleanup=false){const a=await getStaffAccess();if(!a?.isApproved)return null;const c=await readCall(id);if(cleanup&&c?.ended&&await storage().DB.prepare('SELECT user_id FROM call_members WHERE call_id=? AND user_id=?').bind(id,a.userId).first())return {a,c};if(!hasPermission(a,'chat.call'))return null;return c&&await threadAllowed(c.conversation_id,a)?{a,c}:null}
export async function GET(req:Request){
 const url=new URL(req.url),id=url.searchParams.get('id')||'',sessionId=url.searchParams.get('sessionId')||'',v=await access(id,true);if(!v)return Response.json({error:'ზარი ვერ მოიძებნა.'},{status:404});
 const {DB}=storage(),now=Date.now();const current=await refreshCall(v.c);if(current.ended)return Response.json({...exposeCall(current),ended:true,peers:[],signals:[]});
 const me=await DB.prepare('SELECT session_id FROM call_members WHERE call_id=? AND user_id=?').bind(id,v.a.userId).first<{session_id:string}>();if(me?.session_id!==sessionId)return Response.json({error:'ზარის სესია დასრულდა.'},{status:409});
 const after=Math.max(0,Number(url.searchParams.get('after')||0));if(!Number.isSafeInteger(after))return Response.json({error:'არასწორი კურსორი.'},{status:400});
 const [,peers,signals]=await DB.batch([DB.prepare('UPDATE call_members SET seen=? WHERE call_id=? AND user_id=? AND session_id=? AND seen<?').bind(now,id,v.a.userId,sessionId,now-10000),DB.prepare('SELECT user_id AS userId,session_id AS sessionId,name FROM call_members WHERE call_id=? AND seen>? AND user_id<>?').bind(id,now-ACTIVE_WINDOW,v.a.userId),DB.prepare('SELECT seq,sender,payload FROM call_signals WHERE call_id=? AND recipient=? AND recipient_session=? AND seq>? AND created>? ORDER BY seq LIMIT 100').bind(id,v.a.userId,sessionId,after,now-120000)]);
 return Response.json({...exposeCall(current),ended:false,peers:peers.results,signals:(signals.results as {seq:number;sender:string;payload:string}[]).map(s=>({...s,payload:JSON.parse(s.payload)}))},{headers:{'Cache-Control':'no-store'}})
}
export async function POST(req:Request){
 if(!sameOrigin(req))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 if(Number(req.headers.get('content-length')||0)>70000)return Response.json({error:'მოთხოვნა დიდია.'},{status:413});
 const b=await req.json() as {id:string;sessionId:string;action:string;target?:string;targetSession?:string;signalId?:string;payload?:{type?:string;sdp?:string;candidate?:unknown;camera?:unknown}},v=await access(b.id);
 if(!v)return Response.json({error:'ზარი ვერ მოიძებნა.'},{status:404});if(!uuid(b.sessionId))return Response.json({error:'არასწორი სესია.'},{status:400});
 const {DB}=storage(),now=Date.now(),userId=v.a.userId;
 if(b.action==='leave'){const updated=await leaveCall(v.c,userId,'left',b.sessionId);return Response.json({ok:true,...(updated?exposeCall(updated):{})})}
 const current=await refreshCall(v.c);
 if(current.ended)return Response.json({error:'ზარი დასრულდა.'},{status:410});
 if(b.action==='join'){
 let ice;try{ice=await callIce(storage() as unknown as Record<string,unknown>,b.sessionId,now)}catch{return Response.json({error:'ზარის ქსელის სერვისი ვერ მომზადდა. მოგვიანებით სცადე.'},{status:503})}
 await DB.batch([DB.prepare('DELETE FROM call_members WHERE seen<?').bind(now-120000),DB.prepare('DELETE FROM call_signals WHERE created<?').bind(now-120000)]);
 // Member insertion and first answer commit together at the invitation deadline.
 const joinedAt=Date.now();
 await DB.batch([DB.prepare(`INSERT INTO call_members (call_id,user_id,session_id,name,seen) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM chat_calls WHERE id=? AND ended IS NULL AND (created>? OR EXISTS(SELECT 1 FROM workspace_settings WHERE key='call_answered:'||chat_calls.id))) AND (SELECT COUNT(*) FROM call_members WHERE call_id=? AND seen>? AND user_id<>?)<? ON CONFLICT(call_id,user_id) DO UPDATE SET session_id=excluded.session_id,name=excluded.name,seen=excluded.seen`).bind(b.id,userId,b.sessionId,v.a.fullName,joinedAt,b.id,joinedAt-30000,b.id,joinedAt-ACTIVE_WINDOW,userId,isGroupCall(current)?6:2),answeredStatement(b.id,joinedAt),DB.prepare("INSERT INTO chat_call_responses (call_id,user_id,response,updated) SELECT ?,?,'opened',? WHERE EXISTS(SELECT 1 FROM call_members WHERE call_id=? AND user_id=? AND session_id=?) ON CONFLICT(call_id,user_id) DO UPDATE SET response='opened',updated=excluded.updated").bind(b.id,userId,joinedAt,b.id,userId,b.sessionId)]);
 const joined=await DB.prepare('SELECT session_id FROM call_members WHERE call_id=? AND user_id=?').bind(b.id,userId).first<{session_id:string}>();if(joined?.session_id!==b.sessionId){const latest=await refreshCall((await readCall(b.id))!);return latest.ended?Response.json({error:'ზარი დასრულდა.'},{status:410}):Response.json({error:'ზარში თავისუფალი ადგილი აღარ არის.'},{status:409})}
 const answered=await readCall(b.id);if(answered?.ended)return Response.json({error:'ზარი დასრულდა.'},{status:410});
 return Response.json({userId,...exposeCall(answered||current),...ice,maxParticipants:isGroupCall(current)?6:2},{headers:{'Cache-Control':'no-store'}})
 }
 const me=await DB.prepare('SELECT session_id FROM call_members WHERE call_id=? AND user_id=? AND seen>?').bind(b.id,userId,now-ACTIVE_WINDOW).first<{session_id:string}>();if(me?.session_id!==b.sessionId)return Response.json({error:'ზარში ჯერ უნდა შეხვიდე.'},{status:409});
 if(b.action!=='signal'||!uuid(b.signalId)||!uuid(b.targetSession)||b.target===userId||!b.payload||!['offer','answer','ice','media'].includes(b.payload.type||''))return Response.json({error:'არასწორი სიგნალი.'},{status:400});
 if(b.payload.type==='media'&&(typeof b.payload.camera!=='boolean'||Object.keys(b.payload).some(key=>!['type','camera'].includes(key))))return Response.json({error:'არასწორი მედიის მდგომარეობა.'},{status:400});
 if(!await DB.prepare('SELECT user_id FROM call_members WHERE call_id=? AND user_id=? AND session_id=? AND seen>?').bind(b.id,b.target,b.targetSession,now-ACTIVE_WINDOW).first())return Response.json({error:'მონაწილე გამოეთიშა.'},{status:409});
 const data=JSON.stringify({...b.payload,sessionId:b.sessionId});if(data.length>64000)return Response.json({error:'მოთხოვნა დიდია.'},{status:413});
 const n=await DB.prepare('SELECT COUNT(*) AS n FROM call_signals WHERE sender=? AND created>?').bind(userId,now-10000).first<{n:number}>();if((n?.n||0)>300)return Response.json({error:'შეანელე სიგნალები.'},{status:429});
 await DB.prepare('INSERT OR IGNORE INTO call_signals (id,call_id,sender,recipient,recipient_session,payload,created) VALUES (?,?,?,?,?,?,?)').bind(b.signalId,b.id,userId,b.target,b.targetSession,data,now).run();return Response.json({ok:true})
}
