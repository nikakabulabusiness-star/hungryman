import {consumeAuthRateLimit,embeddedSessionCookie,hashSessionToken,newSessionToken,normalizeEmail,safeReturnPath,sessionCookie,STAFF_SESSION_TTL_SECONDS,validEmail,validPassword,verifyPassword} from '@/lib/staff-auth';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {nativeAuthRequest} from '@/lib/mobile-auth';

export const dynamic='force-dynamic';
const DUMMY_SALT='4f2a864546058a07055371cefa9f0386';
const DUMMY_HASH='pbkdf2-sha256:100000:2bbf196337b39943ee82016441cba147cfc7b55a4a1b60b733666b349fefc6aa';

export async function POST(request:Request){
 const native=nativeAuthRequest(request);
 if(!native&&!sameOrigin(request))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{
  const body=await request.json() as {email?:unknown;password?:unknown;returnTo?:unknown},email=normalizeEmail(body.email),password=typeof body.password==='string'?body.password:'';
  if(!validEmail(email)||!validPassword(password))return Response.json({error:'ელფოსტა ან პაროლი არასწორია.'},{status:401});
  if(!await consumeAuthRateLimit(request,'login',email))return Response.json({error:'ძალიან ბევრი მცდელობაა. მოგვიანებით სცადე.'},{status:429});
  const db=storage().DB,row=await db.prepare('SELECT user_id,password_hash,password_salt,status FROM team_members WHERE lower(email)=? LIMIT 1').bind(email).first<{user_id:string;password_hash:string|null;password_salt:string|null;status:string}>();
  const valid=await verifyPassword(password,row?.password_hash||DUMMY_HASH,row?.password_salt||DUMMY_SALT);
  if(!row||!valid)return Response.json({error:'ელფოსტა ან პაროლი არასწორია.'},{status:401,headers:{'Cache-Control':'no-store'}});
  const token=(native?'hmw_':'')+newSessionToken(),tokenHash=await hashSessionToken(token),now=Date.now(),expires=now+STAFF_SESSION_TTL_SECONDS*1000;
  const result=await db.batch([
   db.prepare('DELETE FROM staff_sessions WHERE expires<=?').bind(now),
   db.prepare('INSERT INTO staff_sessions (token_hash,user_id,created,expires,last_seen) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM team_members WHERE user_id=? AND password_hash=? AND password_salt=?)').bind(tokenHash,row.user_id,now,expires,now,row.user_id,row.password_hash,row.password_salt),
   db.prepare('UPDATE team_members SET last_seen=? WHERE user_id=? AND EXISTS(SELECT 1 FROM staff_sessions WHERE token_hash=?)').bind(now,row.user_id,tokenHash),
  ]);
  if(!result[1].meta.changes)return Response.json({error:'ელფოსტა ან პაროლი შეიცვალა. შედი თავიდან.'},{status:401,headers:{'Cache-Control':'no-store'}});
  if(native)return Response.json({ok:true,token,expiresAt:expires},{headers:{'Cache-Control':'no-store','Pragma':'no-cache'}});
  const response=Response.json({ok:true,status:row.status,returnTo:safeReturnPath(typeof body.returnTo==='string'?body.returnTo:'/team')},{headers:{'Cache-Control':'no-store'}});
  response.headers.append('Set-Cookie',sessionCookie(token));
  response.headers.append('Set-Cookie',embeddedSessionCookie(token));
  return response;
 }catch(error){
  console.error('Staff login failed',error);
  return Response.json({error:'ავტორიზაცია დროებით ვერ შესრულდა.'},{status:503});
 }
}
