import {useEffect,useRef,useState} from 'react';

export type EmailMode='login'|'register'|'reset';
type Reply={challengeId?:string;expiresAt?:number;resendAt?:number;serverNow?:number;grant?:string;message?:string};
type Transport=(path:string,body:Record<string,unknown>)=>Promise<Reply>;
type Challenge={id:string;expiresAt:number;resendAt:number;offset:number};

/** Shared by web/PWA and native. Codes, grants and passwords only live in memory. */
export function useEmailFlow(send:Transport,login:(email:string,password:string)=>Promise<void>){
 const [mode,setMode]=useState<EmailMode>('login'),[step,setStep]=useState<'email'|'code'|'password'|'done'>('email');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[code,setCodeValue]=useState('');
 const [challenge,setChallenge]=useState<Challenge|null>(null),[grant,setGrant]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[clock,setClock]=useState(()=>Date.now());
 const locked=useRef(false);
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>{clearInterval(timer)}},[]);
 function changeMode(next:EmailMode){if(locked.current)return;setMode(next);setStep('email');setChallenge(null);setGrant('');setPassword('');setConfirmation('');setCodeValue('');setError('');setMessage('')}
 async function run(action:()=>Promise<void>){if(locked.current)return;locked.current=true;setBusy(true);setError('');try{await action()}catch(e){setError(e instanceof Error?e.message:'კავშირი ვერ დამყარდა. სცადე თავიდან.')}finally{locked.current=false;setBusy(false)}}
 async function requestCode(){
  const result=await send('email-code/request',{email:email.trim(),purpose:mode});
  if(!result.challengeId||!result.expiresAt||!result.resendAt||!result.serverNow)throw Error('კოდის გაგზავნა ვერ დადასტურდა. სცადე თავიდან.');
  setChallenge({id:result.challengeId,expiresAt:result.expiresAt,resendAt:result.resendAt,offset:result.serverNow-Date.now()});
  setCodeValue('');setGrant('');setClock(Date.now());setStep('code');
 }
 async function submit(){await run(async()=>{
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw Error('მიუთითე სწორი ელფოსტა.');
  if(mode==='login'){await login(email.trim(),password);return}
  if(step==='email'){await requestCode();return}
  if(step==='code'){
   if(!challenge||challenge.expiresAt<=Date.now()+challenge.offset)throw Error('კოდის ვადა ამოიწურა. მოითხოვე ახალი კოდი.');
   if(!/^\d{6}$/.test(code))throw Error('ჩაწერე 6-ნიშნა კოდი.');
   const result=await send('email-code/verify',{email:email.trim(),purpose:mode,challengeId:challenge.id,code});
   if(!result.grant)throw Error('დადასტურება ვერ მოხერხდა.');
   setGrant(result.grant);setCodeValue('');setStep('password');return;
  }
  if(step==='password'){
   if(password.length<8||password.length>128)throw Error('პაროლი უნდა შეიცავდეს 8–128 სიმბოლოს.');
   if(password!==confirmation)throw Error('პაროლები ერთმანეთს არ ემთხვევა.');
   const result=await send(mode==='register'?'register':'password-reset',{email:email.trim(),grant,password,passwordConfirmation:confirmation});
   setMessage(result.message||'შესრულებულია.');setStep('done');setPassword('');setConfirmation('');setGrant('');setChallenge(null);
  }
 })}
 const now=clock+(challenge?.offset||0),seconds=challenge?Math.max(0,Math.ceil((challenge.expiresAt-now)/1000)):0,resendSeconds=challenge?Math.max(0,Math.ceil((challenge.resendAt-now)/1000)):0;
 return {mode,step,email,setEmail,password,setPassword,confirmation,setConfirmation,code,setCode:(value:string)=>setCodeValue(value.replace(/\D/g,'').slice(0,6)),busy,error,message,seconds,resendSeconds,changeMode,submit,
  resend:()=>run(async()=>{if(challenge&&Date.now()+challenge.offset<challenge.resendAt)return;await requestCode()}),
  back:()=>{if(locked.current)return;setStep('email');setChallenge(null);setGrant('');setPassword('');setConfirmation('');setCodeValue('');setError('')},
 };
}
export function codeTime(seconds:number){return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}
