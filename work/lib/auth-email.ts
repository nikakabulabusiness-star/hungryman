import {env} from 'cloudflare:workers';

type MailEnvironment={WORK_AUTH_EMAIL_FROM?:string;WORK_AUTH_RESEND_API_KEY?:string;WORK_AUTH_CODE_SECRET?:string};
export class AuthFlowError extends Error{constructor(public status:number,message:string){super(message)}}
export function emailConfig(){
 const values=env as unknown as MailEnvironment;
 const from=values.WORK_AUTH_EMAIL_FROM?.trim()||'',key=values.WORK_AUTH_RESEND_API_KEY||'',secret=values.WORK_AUTH_CODE_SECRET||'';
 // Production has no development bypass, fallback recipient, or plaintext-code response.
 if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from)||!key||secret.length<32)
  throw new AuthFlowError(503,'ელფოსტით დადასტურება ჯერ არ არის ჩართული. სცადე მოგვიანებით.');
 return {from,key,secret};
}
export async function codeDigest(purpose:string,email:string,id:string,code:string){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(emailConfig().secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(JSON.stringify([purpose,email,id,code]))));
 return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
export async function sendAuthEmail(email:string,id:string,kind:'register'|'reset'|'changed',code?:string){
 const {from,key}=emailConfig();
 const subject=kind==='changed'?'პაროლი შეიცვალა':kind==='reset'?'პაროლის აღდგენის კოდი':'ელფოსტის დადასტურების კოდი';
 const text=kind==='changed'
  ?'შენი Hungryman Work ანგარიშის პაროლი შეიცვალა. ყველა ძველი სესია დასრულებულია. თუ ეს შენ არ გაგიკეთებია, დაუკავშირდი ადმინისტრაციას.'
  :`${subject}: ${code}\n\nკოდი ერთჯერადია და მოქმედებს 2 წუთი. არავის გაუზიარო. თუ მოთხოვნა შენ არ გაგიგზავნია, უგულებელყავი ეს წერილი.\n\nHungryman Work`;
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`work-auth-${kind}-${id}`},body:JSON.stringify({from:`Hungryman Work <${from}>`,to:[email],subject:`Hungryman Work · ${subject}`,text}),signal:AbortSignal.timeout(10_000)});
  if(!response.ok)throw new Error('delivery rejected');
  const result=await response.json() as {id?:unknown};
  if(typeof result.id!=='string')throw new Error('delivery unconfirmed');
 }catch{throw new AuthFlowError(503,'კოდის გაგზავნა ვერ მოხერხდა. ცოტა ხანში სცადე ხელახლა.')}
}
