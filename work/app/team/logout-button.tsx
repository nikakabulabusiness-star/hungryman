'use client';

import {LogOut} from 'lucide-react';
import {useState} from 'react';

export default function LogoutButton(){
 const [busy,setBusy]=useState(false);
 async function logout(){
  if(busy)return;setBusy(true);window.dispatchEvent(new Event('hmw-work-logout'));
  try{
   if('serviceWorker'in navigator){navigator.serviceWorker.controller?.postMessage({type:'HMW_PUSH_LOGOUT'});void navigator.serviceWorker.getRegistration('/').then(async reg=>{if(!reg)return;for(const n of await reg.getNotifications())n.close();const subscription=await reg.pushManager.getSubscription();if(subscription)await subscription.unsubscribe()}).catch(()=>{});}
   await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});}finally{window.location.assign('/');}
 }
 return <button className="staff-round-link staff-logout-button" type="button" onClick={logout} disabled={busy} aria-label="გასვლა" title="გასვლა"><LogOut/></button>;
}
