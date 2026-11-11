'use client';
import {Eye,EyeOff} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';

export default function DevicePassword({email}:{email:string}){
 const field=useRef<HTMLInputElement>(null);
 const [visible,setVisible]=useState(false),[hint,setHint]=useState('');
 useEffect(()=>{
  const clear=()=>{setVisible(false);setHint('');if(field.current)field.current.value=''};
  const hidden=()=>{if(document.hidden)clear()};
  document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',clear);
  const timer=visible?setTimeout(clear,15000):undefined;
  return ()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',clear)};
 },[visible]);
 function toggle(){
  if(!field.current?.value){setHint('აირჩიე ამ ანგარიშის შენახული პაროლი ბრაუზერის პაროლების მენეჯერიდან.');field.current?.focus();return}
  setHint('');setVisible(!visible);
 }
 return <form className="profile-editor" onSubmit={e=>e.preventDefault()}>
  <input type="text" autoComplete="username" name="username" value={email} readOnly hidden/>
  <label htmlFor="device-work-password">ბრაუზერში შენახული პაროლი</label>
  <div style={{display:'flex',alignItems:'center',gap:8}}><input id="device-work-password" ref={field} style={{minWidth:0}} name="password" type={visible?'text':'password'} autoComplete="current-password" placeholder="••••••••" spellCheck={false}/>
   <button type="button" className="outline" aria-label={visible?'პაროლის დაფარვა':'პაროლის ჩვენება'} aria-pressed={visible} onClick={toggle}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
  {hint&&<small role="status">{hint}</small>}
 </form>
}
