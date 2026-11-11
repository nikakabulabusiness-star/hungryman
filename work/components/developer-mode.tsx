'use client';
import {Code2} from 'lucide-react';
import {useEffect,useState} from 'react';

export default function DeveloperMode(){
 const [active,setActive]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  fetch('/api/developer/mode',{cache:'no-store',signal:controller.signal}).then(async response=>{
   if(response.ok)setActive((await response.json() as {previewRole:string|null}).previewRole===null);
  }).catch(()=>{});
  return ()=>controller.abort();
 },[]);
 if(active===null)return null;
 async function toggle(){
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/developer/mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:active?'Senior Editor':'Developer'})});
   if(!response.ok)throw Error('რეჟიმი ვერ შეიცვალა. სცადე ხელახლა.');
   window.location.assign('/team');
  }catch(e){setError((e as Error).message);setBusy(false)}
 }
 return <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8,padding:'6px 16px',background:'#092536'}}>
  {error&&<small role="alert">{error}</small>}<button type="button" className="work-secondary" aria-pressed={active} disabled={busy} onClick={toggle}><Code2 size={18}/>{active?'Developer Mode · გამორთვა':'Developer Mode'}</button>
 </div>
}
