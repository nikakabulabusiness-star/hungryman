import {cookies,headers} from 'next/headers';
import {mobileBearer} from '@/lib/mobile-auth';
import {redirect} from 'next/navigation';
import {storage} from '@/lib/storage';

export const STAFF_SESSION_COOKIE='hm_staff_session';
export const STAFF_EMBEDDED_SESSION_COOKIE='__Host-hm_staff_session_embed';
export const STAFF_SESSION_TTL_SECONDS=60*60*24*30;
export const OWNER_EMAIL='nikolozkabulashvili0@gmail.com';
// Cloudflare Workers currently caps Web Crypto PBKDF2 at 100,000 iterations.
const PASSWORD_ITERATIONS=100_000;
const textEncoder=new TextEncoder();

export type SessionUser={
 userId:string;
 email:string;
 fullName:string;
 phone:string;
 role:string|null;
 status:string;
};

type SessionRow={
 user_id:string;
 email:string;
 full_name:string;
 phone:string;
 member_role:string|null;
 member_status:string;
 admin_role:string|null;
 admin_status:string|null;
 last_seen:number;
};

export function normalizeEmail(value:unknown){return String(value||'').trim().toLowerCase()}
export function validEmail(email:string){return email.length>3&&email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
export function validPassword(password:string){return password.length>=8&&password.length<=128}

function bytesToHex(bytes:Uint8Array){return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('')}
function hexToBytes(value:string){if(value.length%2||!/^[0-9a-f]+$/i.test(value))return null;const bytes=new Uint8Array(value.length/2);for(let i=0;i<bytes.length;i++)bytes[i]=Number.parseInt(value.slice(i*2,i*2+2),16);return bytes}
function randomHex(length:number){const bytes=new Uint8Array(length);crypto.getRandomValues(bytes);return bytesToHex(bytes)}

async function pbkdf2(password:string,salt:Uint8Array,iterations:number){
 const key=await crypto.subtle.importKey('raw',textEncoder.encode(password),'PBKDF2',false,['deriveBits']);
 const normalizedSalt=new Uint8Array(salt.length);normalizedSalt.set(salt);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:normalizedSalt.buffer,iterations},key,256));
}

function constantTimeEqual(left:Uint8Array,right:Uint8Array){
 let mismatch=left.length===right.length?0:1;const max=Math.max(left.length,right.length);
 for(let i=0;i<max;i++)mismatch|=(left[i%left.length]||0)^(right[i%right.length]||0);
 return mismatch===0;
}

export async function createPasswordRecord(password:string){
 const saltHex=randomHex(16),hash=await pbkdf2(password,hexToBytes(saltHex)!,PASSWORD_ITERATIONS);
 return {salt:saltHex,hash:`pbkdf2-sha256:${PASSWORD_ITERATIONS}:${bytesToHex(hash)}`};
}

export async function verifyPassword(password:string,storedHash:string|null|undefined,storedSalt:string|null|undefined){
 const parts=String(storedHash||'').split(':'),iterations=Number(parts[1]),expected=hexToBytes(parts[2]||''),salt=hexToBytes(String(storedSalt||''));
 if(parts[0]!=='pbkdf2-sha256'||!Number.isSafeInteger(iterations)||iterations!==PASSWORD_ITERATIONS||!expected||expected.length!==32||!salt||salt.length<16)return false;
 const actual=await pbkdf2(password,salt,iterations);
 return constantTimeEqual(actual,expected);
}

export async function hashSessionToken(token:string){return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',textEncoder.encode(token))))}

export function newSessionToken(){return randomHex(32)}

export function sessionCookie(token:string,maxAge=STAFF_SESSION_TTL_SECONDS){
 return `${STAFF_SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0,Math.floor(maxAge))}`;
}

export function embeddedSessionCookie(token:string,maxAge=STAFF_SESSION_TTL_SECONDS){
 return `${STAFF_EMBEDDED_SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${Math.max(0,Math.floor(maxAge))}`;
}

export function clearSessionCookie(){return `${STAFF_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
export function clearEmbeddedSessionCookie(){return `${STAFF_EMBEDDED_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`}

export async function getSessionUser():Promise<SessionUser|null>{
 const requestHeaders=await headers(),cookieStore=await cookies();
 // An invalid bearer must never fall back to a different signed-in browser user.
 const bearer=requestHeaders.has('authorization');
 const token=bearer?mobileBearer(requestHeaders):cookieStore.get(STAFF_SESSION_COOKIE)?.value||cookieStore.get(STAFF_EMBEDDED_SESSION_COOKIE)?.value;
 if(!token||!(bearer?/^hmw_[0-9a-f]{64}$/i:/^[0-9a-f]{64}$/i).test(token))return null;
 let db:D1Database;
 try{db=storage().DB}catch{return null}
 const now=Date.now(),tokenHash=await hashSessionToken(token);
 let row:SessionRow|null;
 try{row=await db.prepare(`SELECT t.user_id,t.email,t.full_name,t.phone,t.role AS member_role,t.status AS member_status,
   a.role AS admin_role,a.status AS admin_status,s.last_seen
   FROM staff_sessions s JOIN team_members t ON t.user_id=s.user_id
   LEFT JOIN admin_users a ON lower(a.email)=lower(t.email)
   WHERE s.token_hash=? AND s.expires>? LIMIT 1`).bind(tokenHash,now).first<SessionRow>()}catch{return null}
 if(!row)return null;
 const email=normalizeEmail(row.email);
 if(now-Number(row.last_seen||0)>60_000){
  try{await db.batch([
   db.prepare('UPDATE staff_sessions SET last_seen=? WHERE token_hash=?').bind(now,tokenHash),
   db.prepare('UPDATE team_members SET last_seen=? WHERE user_id=?').bind(now,row.user_id),
  ])}catch{}
 }
 return {userId:row.user_id,email,fullName:row.full_name||email.split('@')[0]||'თანამშრომელი',phone:row.phone||'',role:row.admin_role||row.member_role,status:row.admin_status||row.member_status||'pending'};
}

export async function requireSessionUser(returnTo:string):Promise<SessionUser>{
 const user=await getSessionUser();
 if(user)return user;
 redirect(`/team/auth?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`);
}

export function safeReturnPath(value:string|null|undefined){
 const candidate=String(value||'/team');
 if(!candidate.startsWith('/')||candidate.startsWith('//'))return'/team';
 try{const url=new URL(candidate,'https://app.local');return url.origin==='https://app.local'&&!url.pathname.startsWith('/api/auth')?`${url.pathname}${url.search}${url.hash}`:'/team'}catch{return'/team'}
}

export async function consumeAuthRateLimit(request:Request,action:'login'|'register',email:string){
 const now=Date.now(),windowMs=action==='login'?15*60_000:60*60_000,limit=20,windowStart=Math.floor(now/windowMs)*windowMs;
 const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
 const source=action==='register'
  ?`${action}|${windowStart}|${ip}|${request.headers.get('user-agent')||'unknown'}`
  :`${action}|${windowStart}|${ip}|${request.headers.get('user-agent')||'unknown'}|${email}`;
 const rateKey=bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',textEncoder.encode(source))));
 const db=storage().DB;
 await db.prepare(`INSERT INTO auth_rate_limits (rate_key,action,window_start,attempts,updated) VALUES (?,?,?,?,?)
  ON CONFLICT(rate_key) DO UPDATE SET attempts=auth_rate_limits.attempts+1,updated=excluded.updated`).bind(rateKey,action,windowStart,1,now).run();
 const row=await db.prepare('SELECT attempts FROM auth_rate_limits WHERE rate_key=? LIMIT 1').bind(rateKey).first<{attempts:number}>();
 if(Math.random()<0.02)try{await db.prepare('DELETE FROM auth_rate_limits WHERE updated<?').bind(now-24*60*60_000).run()}catch{}
 return Number(row?.attempts||1)<=limit;
}
