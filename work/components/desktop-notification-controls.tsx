'use client';
import {useEffect,useState} from 'react';
import {Bell,Volume2,VolumeX} from 'lucide-react';

export function DesktopNotificationControls(){
 const [sound,setSound]=useState(true),[permission,setPermission]=useState<NotificationPermission|'unsupported'>('default'),[message,setMessage]=useState('');
 useEffect(()=>{
  const sync=()=>{try{setSound(JSON.parse(localStorage.getItem('hmw-desktop-sound')||'true')!==false)}catch{}setPermission('Notification' in window?Notification.permission:'unsupported')};
  sync();window.addEventListener('hmw:desktop-state',sync);window.addEventListener('focus',sync);
  return()=>{window.removeEventListener('hmw:desktop-state',sync);window.removeEventListener('focus',sync)};
 },[]);
 async function enableBanners(){
  if(!('Notification' in window))return;
  try{const result=await Notification.requestPermission();setPermission(result);setMessage(result==='granted'?'ბრაუზერის შეტყობინებები ჩართულია.':result==='denied'?'შეტყობინებები დაბლოკილია. ჩართე ბრაუზერში, ამ საიტის პარამეტრებიდან.':'შეგიძლია მოგვიანებით ჩართო.')}catch{setMessage('ამ ბრაუზერში შეტყობინებების ჩართვა ვერ მოხერხდა.')}
 }
 return <section className="desktop-notice-controls" aria-label="შეტყობინებების პარამეტრები" style={{display:'grid',gap:9,padding:'12px 0'}}>
  <button className="work-secondary" type="button" aria-pressed={sound} onClick={()=>{const next=!sound;setSound(next);window.dispatchEvent(new CustomEvent('hmw:desktop-toggle',{detail:{enabled:next}}))}}>{sound?<Volume2 size={16}/>:<VolumeX size={16}/>} ხმა {sound?'ჩართულია':'გამორთულია'}</button>
  <button className="work-secondary" type="button" onClick={()=>window.dispatchEvent(new Event('hmw:desktop-test'))}>ხმის მოსმენა</button>
  {permission==='default'&&<button className="work-secondary" type="button" onClick={()=>void enableBanners()}><Bell size={16}/>ბრაუზერის შეტყობინებების ჩართვა</button>}
  {permission==='granted'&&<small className="work-help">ბრაუზერის შეტყობინებები ჩართულია</small>}
  {permission==='denied'&&<small className="work-help">ბანერებისთვის დაუშვი შეტყობინებები ბრაუზერის საიტის პარამეტრებში.</small>}
  {message&&<small role="status" className="work-help">{message}</small>}
 </section>;
}
