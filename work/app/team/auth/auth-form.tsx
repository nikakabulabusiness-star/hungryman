'use client';

import {useEmailFlow,codeTime} from '@/mobile/src/lib/email-flow';

async function authRequest(path:string,body:Record<string,unknown>){
 const response=await fetch(`/api/auth/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20_000)});
 const result=await response.json().catch(()=>null) as {error?:string;returnTo?:string;challengeId?:string;expiresAt?:number;resendAt?:number;serverNow?:number;grant?:string;message?:string}|null;
 if(!response.ok)throw new Error(typeof result?.error==='string'?result.error:'მოქმედება ვერ შესრულდა. სცადე თავიდან.');
 return result||{};
}
export default function StaffAuthForm({registration=true}:{registration?:boolean}){
 const f=useEmailFlow(authRequest,async(email,password)=>{
  const returnTo=new URLSearchParams(window.location.search).get('return_to')||(window.matchMedia('(max-width: 767px)').matches?'/work':'/team');
  const result=await authRequest('login',{email,password,returnTo});
  window.location.assign(typeof result?.returnTo==='string'?result.returnTo:'/team');
 });
 const login=f.mode==='login',passwordStep=f.step==='password',codeStep=f.step==='code';
 if(f.step==='done')return <div className="auth-success" role="status"><span aria-hidden="true">✓</span><h2>{f.mode==='reset'?'პაროლი შეიცვალა':'ელფოსტა დადასტურებულია'}</h2><p>{f.message}</p><button className="action" type="button" onClick={()=>f.changeMode('login')}>ავტორიზაციაზე გადასვლა</button></div>;
 return <>
  {f.mode==='reset'?<div className="auth-flow-heading"><button type="button" disabled={f.busy} onClick={()=>f.changeMode('login')}>← ავტორიზაცია</button><h2>პაროლის აღდგენა</h2></div>:<div className="auth-tabs" role="tablist" aria-label="ანგარიშის მოქმედება">
   <button type="button" role="tab" aria-selected={login} className={login?'active':''} disabled={f.busy} onClick={()=>f.changeMode('login')}>ავტორიზაცია</button>
   {registration&&<button type="button" role="tab" aria-selected={!login} className={!login?'active':''} disabled={f.busy} onClick={()=>f.changeMode('register')}>რეგისტრაცია</button>}
  </div>}
  {!login&&<div className="auth-steps" aria-label="დადასტურების ეტაპები">{['ელფოსტა','კოდი','პაროლი'].map((title,i)=><span key={title} className={i===(codeStep?1:passwordStep?2:0)?'current':''}>{i+1} · {title}</span>)}</div>}
  <form className="staff-auth-form" onSubmit={event=>{event.preventDefault();void f.submit()}} noValidate aria-busy={f.busy}>
   {f.step==='email'?<label htmlFor="staff-auth-email">ელფოსტა<input id="staff-auth-email" type="email" autoComplete="email" inputMode="email" required maxLength={254} disabled={f.busy} value={f.email} onChange={event=>f.setEmail(event.target.value)} placeholder="name@example.com"/></label>:<div className="auth-email-summary"><span>{f.email}</span><button type="button" disabled={f.busy} onClick={f.back}>შეცვლა</button></div>}
   {!login&&f.step==='email'&&<p className="auth-help">{f.mode==='reset'?'გამოგიგზავნით ერთჯერად კოდს. დადასტურების შემდეგ ახალ პაროლს შექმნი.':'ანგარიშის შესაქმნელად ჯერ ელფოსტა უნდა დაადასტურო ერთჯერადი კოდით.'}</p>}
   {codeStep&&<>
    <p className="auth-help">კოდი გაგზავნილია. შეამოწმე ელფოსტა და სპამის საქაღალდე.</p>
    <label htmlFor="staff-auth-code">ერთჯერადი კოდი<input id="staff-auth-code" className="auth-code-input" type="text" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" required maxLength={6} autoFocus disabled={f.busy||f.seconds===0} value={f.code} onChange={event=>f.setCode(event.target.value)} placeholder="000000" aria-describedby="auth-code-timer"/></label>
    <div className="auth-code-status"><span id="auth-code-timer" className={f.seconds===0?'expired':''}>{f.seconds>0?`დარჩენილი დრო · ${codeTime(f.seconds)}`:'კოდის ვადა ამოიწურა'}</span><button type="button" disabled={f.busy||f.resendSeconds>0} onClick={()=>void f.resend()}>{f.resendSeconds>0?`ხელახლა · ${codeTime(f.resendSeconds)}`:'ახალი კოდის გაგზავნა'}</button></div>
   </>}
   {(login||passwordStep)&&<label htmlFor="staff-auth-password">{login?'პაროლი':'ახალი პაროლი'}<input id="staff-auth-password" type="password" autoComplete={login?'current-password':'new-password'} required minLength={8} maxLength={128} disabled={f.busy} value={f.password} onChange={event=>f.setPassword(event.target.value)} placeholder="მინიმუმ 8 სიმბოლო"/></label>}
   {passwordStep&&<label htmlFor="staff-auth-confirm">გაიმეორე პაროლი<input id="staff-auth-confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={f.busy} value={f.confirmation} onChange={event=>f.setConfirmation(event.target.value)} placeholder="იგივე პაროლი"/></label>}
   {login&&<button className="auth-forgot" type="button" disabled={f.busy} onClick={()=>f.changeMode('reset')}>დაგავიწყდა პაროლი?</button>}
   {f.error&&<p className="error" role="alert">{f.error}</p>}
   <button className="action" type="submit" disabled={f.busy||(codeStep&&(f.seconds===0||f.code.length!==6))}>{f.busy?'მუშავდება…':login?'შესვლა':codeStep?'კოდის დადასტურება':passwordStep?(f.mode==='reset'?'პაროლის შენახვა':'ანგარიშის შექმნა'):'კოდის გაგზავნა'}</button>
  </form>
 </>;
}
