import {after} from 'next/server';
import {storage} from '@/lib/storage';
import {codeDigest,emailConfig,sendAuthEmail,AuthFlowError} from '@/lib/auth-email';
import {createPasswordRecord,hashSessionToken,newSessionToken,normalizeEmail,validEmail,validPassword} from '@/lib/staff-auth';
import {getSiteFeatures} from '@/lib/site-controls-store';
import {accountReviewers,noticeStatements,dispatchNotices} from '@/lib/notifications';

export {AuthFlowError};
type Purpose='register'|'reset';
type Challenge={challenge_id:string;email:string;purpose:Purpose;user_id:string|null;password_version:string|null;code_hash:string;expires:number;sent_at:number|null;attempts:number;verified_at:number|null;grant_hash:string|null;grant_expires:number|null;consumed_at:number|null};
const CODE_TTL=120_000,RESEND_WAIT=60_000,GRANT_TTL=10*60_000;
const invalidCode=()=>new AuthFlowError(400,'კოდი არასწორია, გამოყენებულია ან ვადა ამოიწურა.');
const invalidGrant=()=>new AuthFlowError(400,'დადასტურების ვადა ამოიწურა. მოითხოვე ახალი კოდი.');

export async function authBody(request:Request):Promise<Record<string,unknown>>{
 const reader=request.body?.getReader();if(!reader)throw new AuthFlowError(400,'მონაცემები არასწორია.');
 let size=0,text='';const decoder=new TextDecoder();
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new AuthFlowError(413,'მოთხოვნა ზედმეტად დიდია.')}text+=decoder.decode(value,{stream:true})}text+=decoder.decode();const body=JSON.parse(text);if(!body||Array.isArray(body)||typeof body!=='object')throw new Error();return body}catch(error){if(error instanceof AuthFlowError)throw error;throw new AuthFlowError(400,'მონაცემები არასწორია.')}
}
function identity(body:Record<string,unknown>){
 const email=normalizeEmail(body.email),purpose=body.purpose;
 if(!validEmail(email))throw new AuthFlowError(400,'მიუთითე სწორი ელფოსტა.');
 if(purpose!=='register'&&purpose!=='reset')throw new AuthFlowError(400,'მოთხოვნა არასწორია.');
 return {email,purpose:purpose as Purpose};
}
async function limit(key:string,action:string,windowMs:number,max:number){
 const now=Date.now(),start=Math.floor(now/windowMs)*windowMs,hash=await hashSessionToken(`${action}|${start}|${key}`);
 const row=await storage().DB.prepare(`INSERT INTO auth_rate_limits(rate_key,action,window_start,attempts,updated) VALUES(?,?,?,?,?) ON CONFLICT(rate_key) DO UPDATE SET attempts=auth_rate_limits.attempts+1,updated=excluded.updated RETURNING attempts`).bind(hash,action,start,1,now).first<{attempts:number}>();
 if(!row||row.attempts>max)throw new AuthFlowError(429,'ძალიან ბევრი მცდელობაა. მოგვიანებით სცადე.');
}
async function requestLimits(request:Request,email:string,action:'send'|'verify'|'complete'){
 // User-Agent is deliberately excluded: changing it cannot reset a limit.
 const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
 await limit(ip,`email-${action}-ip`,60*60_000,action==='send'?30:100);
 await limit(email,`email-${action}-address`,60*60_000,action==='send'?5:30);
 if(action==='send')await limit('site','email-send-global',86400_000,80);
}
function newCode(){const bytes=new Uint32Array(1);do{crypto.getRandomValues(bytes)}while(bytes[0]>=4_294_000_000);return String(bytes[0]%1_000_000).padStart(6,'0')}

export async function requestEmailCode(request:Request,body:Record<string,unknown>){
 const {email,purpose}=identity(body);emailConfig();
 if(purpose==='register'&&!(await getSiteFeatures()).registration)throw new AuthFlowError(403,'რეგისტრაცია დროებით გამორთულია.');
 await requestLimits(request,email,'send');
 const db=storage().DB,now=Date.now(),id=newSessionToken(),code=newCode(),hash=await codeDigest(purpose,email,id,code);
 const user=await db.prepare('SELECT user_id,password_hash FROM team_members WHERE lower(email)=?').bind(email).first<{user_id:string;password_hash:string|null}>();
 const row=await db.prepare(`INSERT INTO auth_email_challenges(email,purpose,challenge_id,user_id,password_version,code_hash,expires,updated) VALUES(?,?,?,?,?,?,?,?)
  ON CONFLICT(email,purpose) DO UPDATE SET challenge_id=excluded.challenge_id,user_id=excluded.user_id,password_version=excluded.password_version,code_hash=excluded.code_hash,expires=excluded.expires,updated=excluded.updated,sent_at=NULL,attempts=0,verified_at=NULL,grant_hash=NULL,grant_expires=NULL,consumed_at=NULL,mutation_id=NULL
  WHERE auth_email_challenges.updated<=? RETURNING challenge_id`).bind(email,purpose,id,user?.user_id||null,user?.password_hash||null,hash,now+CODE_TTL,now,now-RESEND_WAIT).first<{challenge_id:string}>();
 if(!row)throw new AuthFlowError(429,'ახალი კოდის მოთხოვნამდე დაელოდე 1 წუთს.');
 try{
  // The same delivery path and response apply to unknown accounts. Only a mailbox
  // owner who supplies the code can learn whether that address can be recovered.
  await sendAuthEmail(email,id,purpose,code);
  const sentAt=Date.now();
  await db.prepare('UPDATE auth_email_challenges SET sent_at=?,expires=? WHERE challenge_id=?').bind(sentAt,sentAt+CODE_TTL,id).run();
  return {ok:true,challengeId:id,expiresAt:sentAt+CODE_TTL,resendAt:Math.max(sentAt,now+RESEND_WAIT),serverNow:sentAt};
 }catch(error){await db.prepare('DELETE FROM auth_email_challenges WHERE challenge_id=?').bind(id).run();throw error}
 finally{after(async()=>{try{await db.prepare('DELETE FROM auth_email_challenges WHERE updated<?').bind(Date.now()-86400_000).run()}catch{}})}
}

export async function verifyEmailCode(request:Request,body:Record<string,unknown>){
 const {email,purpose}=identity(body),id=String(body.challengeId||''),code=String(body.code||'');
 if(!/^[0-9a-f]{64}$/.test(id)||!/^\d{6}$/.test(code))throw invalidCode();
 await requestLimits(request,email,'verify');
 const db=storage().DB,now=Date.now();
 const row=await db.prepare(`UPDATE auth_email_challenges SET attempts=attempts+1 WHERE email=? AND purpose=? AND challenge_id=? AND sent_at IS NOT NULL AND expires>? AND attempts<5 AND verified_at IS NULL AND consumed_at IS NULL RETURNING *`).bind(email,purpose,id,now).first<Challenge>();
 if(!row)throw invalidCode();
 const expected=await codeDigest(purpose,email,id,code),grant=newSessionToken(),grantHash=await hashSessionToken(grant),verifiedNow=Date.now();
 const updated=await db.prepare(`UPDATE auth_email_challenges SET verified_at=?,grant_hash=?,grant_expires=? WHERE challenge_id=? AND code_hash=? AND attempts<=5 AND verified_at IS NULL AND consumed_at IS NULL AND expires>? RETURNING user_id`).bind(verifiedNow,grantHash,verifiedNow+GRANT_TTL,id,expected,verifiedNow).first<{user_id:string|null}>();
 if(!updated)throw invalidCode();
 if(purpose==='reset'&&!updated.user_id)throw new AuthFlowError(400,'ამ ელფოსტით ანგარიში ვერ მოიძებნა. შეამოწმე მისამართი ან გაიარე რეგისტრაცია.');
 return {ok:true,grant,expiresAt:verifiedNow+GRANT_TTL};
}

export async function completeEmailFlow(request:Request,body:Record<string,unknown>,purpose:Purpose){
 const {email}=identity({...body,purpose}),password=typeof body.password==='string'?body.password:'',confirmation=body.passwordConfirmation,grant=String(body.grant||'');
 if(!validPassword(password))throw new AuthFlowError(400,'პაროლი უნდა შეიცავდეს 8–128 სიმბოლოს.');
 if(password!==confirmation)throw new AuthFlowError(400,'პაროლები ერთმანეთს არ ემთხვევა.');
 if(!/^[0-9a-f]{64}$/.test(grant))throw invalidGrant();
 if(purpose==='register'&&!(await getSiteFeatures()).registration)throw new AuthFlowError(403,'რეგისტრაცია დროებით გამორთულია.');
 await requestLimits(request,email,'complete');
 const db=storage().DB,grantHash=await hashSessionToken(grant),row=await db.prepare('SELECT * FROM auth_email_challenges WHERE email=? AND purpose=? AND grant_hash=? AND grant_expires>? AND consumed_at IS NULL').bind(email,purpose,grantHash,Date.now()).first<Challenge>();
 if(!row||row.verified_at===null)throw invalidGrant();
 if(purpose==='register'&&row.password_version)throw new AuthFlowError(409,'ამ ელფოსტით ანგარიში უკვე არსებობს. შედი ანგარიშზე ან აღადგინე პაროლი.');
 const {hash,salt}=await createPasswordRecord(password),now=Date.now(),mutation=crypto.randomUUID(),userId=row.user_id||crypto.randomUUID();
 // Claim and every mutation share one D1 transaction. A resend, deletion, parallel
 // completion or intervening password change makes the complete transaction a no-op.
 const accountGuard=purpose==='reset'
  ?'EXISTS(SELECT 1 FROM team_members t WHERE t.user_id=c.user_id AND lower(t.email)=c.email AND t.password_hash IS c.password_version)'
  :'(c.user_id IS NULL AND NOT EXISTS(SELECT 1 FROM team_members t WHERE lower(t.email)=c.email)) OR (c.password_version IS NULL AND EXISTS(SELECT 1 FROM team_members t WHERE t.user_id=c.user_id AND lower(t.email)=c.email AND t.password_hash IS NULL))';
 const claim=db.prepare(`UPDATE auth_email_challenges AS c SET consumed_at=?,mutation_id=? WHERE challenge_id=? AND grant_hash=? AND grant_expires>? AND consumed_at IS NULL AND (${accountGuard})`).bind(now,mutation,row.challenge_id,grantHash,now);
 const gate='EXISTS(SELECT 1 FROM auth_email_challenges WHERE challenge_id=? AND mutation_id=?)',args=[row.challenge_id,mutation];
 const statements=[claim];
 if(purpose==='reset'){
  statements.push(db.prepare(`UPDATE team_members SET password_hash=?,password_salt=?,email_verified_at=?,updated=? WHERE user_id=? AND ${gate}`).bind(hash,salt,now,now,userId,...args));
 }else if(row.user_id){
  statements.push(db.prepare(`UPDATE team_members SET password_hash=?,password_salt=?,email_verified_at=?,updated=?,role=NULL,status='pending',approved_by=NULL WHERE user_id=? AND ${gate}`).bind(hash,salt,now,now,userId,...args));
 }else{
  statements.push(db.prepare(`INSERT INTO team_members(user_id,email,full_name,phone,status,password_hash,password_salt,email_verified_at,created,updated) SELECT ?,?,?,'','pending',?,?,?,?,? WHERE ${gate}`).bind(userId,email,email.split('@')[0],hash,salt,now,now,now,...args));
 }
 if(purpose==='register'){
  statements.push(db.prepare(`UPDATE admin_users SET status='pending' WHERE lower(email)=? AND ${gate}`).bind(email,...args));
  statements.push(...noticeStatements(await accountReviewers(),{key:'account-registration:'+userId,category:'account',title:'ახალი რეგისტრაციის მოთხოვნა',body:email+' ელოდება ანგარიშის დამტკიცებას.',target:'accounts',targetId:userId,important:true,created:now},{query:gate,values:args}));
 }
 statements.push(db.prepare(`DELETE FROM staff_sessions WHERE user_id=? AND ${gate}`).bind(userId,...args));
 statements.push(db.prepare(`DELETE FROM push_devices WHERE user_id=? AND ${gate}`).bind(userId,...args));
 statements.push(db.prepare(`DELETE FROM auth_email_challenges WHERE email=? AND challenge_id<>? AND ${gate}`).bind(email,row.challenge_id,...args));
 const results=await db.batch(statements);
 if(!results[0].meta.changes)throw invalidGrant();
 if(purpose==='register')dispatchNotices();
 else after(async()=>{try{await sendAuthEmail(email,mutation,'changed')}catch{console.error('auth-password-change-email-undelivered')}});
 return {ok:true,status:purpose==='register'?'pending':'reset',message:purpose==='register'?'ელფოსტა დადასტურებულია. რეგისტრაციის მოთხოვნა გაგზავნილია ადმინისტრაციასთან.':'პაროლი შეიცვალა. შედი ახალი პაროლით.'};
}
