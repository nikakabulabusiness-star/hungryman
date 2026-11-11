'use client';
import DevicePassword from '@/components/device-password';
import {roleLabel} from '@/lib/department-directory';

/* eslint-disable @next/next/no-img-element -- the protected avatar endpoint must receive the viewer's authentication headers directly. */
import {finishSave} from '@/lib/save-feedback';
import {Pencil,Trash2} from 'lucide-react';
import {FormEvent,useMemo,useRef,useState} from 'react';

export type ProfileCardProps={userId:string;fullName:string;role:string|null;email:string;hasAvatar:boolean;profileUpdated:number;developerMode?:boolean};

const initials=(name:string)=>name.trim().split(/\s+/).map(part=>part[0]).join('').slice(0,2).toLocaleUpperCase('ka-GE');

export default function ProfileCard({profile}:{profile:ProfileCardProps}){
 const [fullName,setFullName]=useState(profile.fullName),[nameDraft,setNameDraft]=useState(profile.fullName),[editing,setEditing]=useState(false),[hasAvatar,setHasAvatar]=useState(profile.hasAvatar),[version,setVersion]=useState(profile.profileUpdated||0),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const fileInput=useRef<HTMLInputElement>(null);
 const avatarUrl=useMemo(()=>'/api/team/avatar?userId='+encodeURIComponent(profile.userId)+'&v='+version,[profile.userId,version]);
 async function upload(event:React.ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];event.target.value='';if(!file||busy)return;
  setBusy(true);setNotice('ფოტო იტვირთება…');
  const form=new FormData();form.append('avatar',file);
  try{const response=await fetch('/api/team/avatar',{method:'POST',body:form});const result=await response.json() as {error?:string;version?:number};if(!response.ok)throw new Error(result.error||'ფოტო ვერ აიტვირთა.');setHasAvatar(true);setVersion(result.version||Date.now());setNotice('პროფილის ფოტო განახლებულია.');await finishSave(null,'ფოტო განახლებულია');setEditing(false)}catch(error){setNotice(error instanceof Error?error.message:'ფოტო ვერ აიტვირთა.')}finally{setBusy(false)}
 }
 async function saveName(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;const value=nameDraft.trim().replace(/\s+/g,' ');if(value.length<2){setNotice('ჩაწერე სახელი და გვარი.');return;}
  setBusy(true);setNotice('სახელი ინახება…');
  try{const response=await fetch('/api/team/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fullName:value})});const result=await response.json() as {error?:string;fullName?:string};if(!response.ok)throw new Error(result.error||'სახელი ვერ განახლდა.');setFullName(result.fullName||value);setNameDraft(result.fullName||value);await finishSave(null,'პროფილი განახლებულია');setEditing(false);setNotice('სახელი და გვარი განახლებულია.')}catch(error){setNotice(error instanceof Error?error.message:'სახელი ვერ განახლდა.')}finally{setBusy(false)}
 }
 async function remove(){
  if(!hasAvatar||busy)return;setBusy(true);setNotice('ფოტო იშლება…');
  try{const response=await fetch('/api/team/avatar',{method:'DELETE'});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||'ფოტო ვერ წაიშალა.');setHasAvatar(false);setVersion(Date.now());setNotice('დაყენდა სტანდარტული ავატარი.');await finishSave(null,'ფოტო წაშლილია');setEditing(false)}catch(error){setNotice(error instanceof Error?error.message:'ფოტო ვერ წაიშალა.')}finally{setBusy(false)}
 }
 return <section className={`staff-profile-card ${editing?'is-editing':''}`}>
  <div className="profile-summary">
   <div className="profile-avatar">{hasAvatar?<img key={avatarUrl} src={avatarUrl} alt={fullName}/>:<span>{initials(fullName)}</span>}</div>
   <div className="profile-identity"><h2>{fullName}</h2><p className="role-chip">{roleLabel(profile.role)||'პოზიცია არ არის მინიჭებული'}</p></div>
   <button className="profile-edit-toggle" type="button" aria-expanded={editing} aria-controls="profile-editor" aria-label={editing?'რედაქტირების დახურვა':'პროფილის რედაქტირება'} title="პროფილის რედაქტირება" onClick={()=>{setNotice('');setNameDraft(fullName);setEditing(current=>!current)}}><Pencil size={15}/></button>
  </div>
  {editing?<form id="profile-editor" className="profile-editor" onSubmit={saveName}>
   <label htmlFor="profile-full-name">სახელი და გვარი<input id="profile-full-name" value={nameDraft} onChange={event=>setNameDraft(event.target.value)} minLength={2} maxLength={100} autoComplete="name" autoFocus required/></label>
   <label htmlFor="profile-email">ელფოსტა<input id="profile-email" value={profile.email} readOnly aria-readonly="true"/></label>
   <div className="profile-avatar-actions">
    <button className="outline" type="button" disabled={busy} onClick={()=>fileInput.current?.click()}><Pencil size={14}/>{hasAvatar?'ფოტოს შეცვლა':'ფოტოს ატვირთვა'}</button>
    {hasAvatar?<button className="danger-button" type="button" disabled={busy} onClick={remove}><Trash2 size={14}/>ფოტოს წაშლა</button>:null}
    <input ref={fileInput} className="profile-avatar-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={upload} aria-label="პროფილის ფოტოს არჩევა"/>
   </div>
   <div className="profile-edit-actions"><button className="action" type="submit" disabled={busy}>შენახვა</button><button className="text-button" type="button" disabled={busy} onClick={()=>{setNameDraft(fullName);setNotice('');setEditing(false)}}>გაუქმება</button></div>
   {notice?<p className="staff-notice" role="status" aria-live="polite">{notice}</p>:null}
  </form>:null}
  {editing&&profile.developerMode&&<DevicePassword email={profile.email}/>}
 </section>
}
