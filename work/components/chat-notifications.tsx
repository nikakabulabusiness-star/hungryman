'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';

export default function ChatNotifications(){
 const path=usePathname();
 useEffect(()=>{
  if(location.pathname.replace(/\/$/,'')==='/chat/embed')return;
  if(!document.getElementById('hm-call-client-script')){const calls=document.createElement('script');calls.id='hm-call-client-script';calls.src='/work/call-client.js?v=58';calls.async=true;document.body.appendChild(calls);}
  if(!document.getElementById('hm-desktop-notices-script')){const notices=document.createElement('script');notices.id='hm-desktop-notices-script';notices.src='/work/desktop-notices.js?v=1';notices.async=true;document.body.appendChild(notices);}
  const small=matchMedia('(max-width:760px)'),standalone=matchMedia('(display-mode: standalone)');
  const mobile=()=>small.matches||standalone.matches||!!(navigator as Navigator&{standalone?:boolean}).standalone;
  const loadDock=()=>{
   if(mobile()||document.getElementById('hm-chat-dock-script'))return;
   const script=document.createElement('script');script.id='hm-chat-dock-script';script.src='/work/chat-dock.js?v=6';script.async=true;document.body.appendChild(script);
  };
  const open=(id:unknown)=>{const thread=typeof id==='string'&&/^[a-zA-Z0-9_-]{1,180}$/.test(id)?id:'';location.assign('/chat'+(thread?'?conversationId='+encodeURIComponent(thread):''))};
  const request=(event:Event)=>{if(!mobile())return;event.stopImmediatePropagation();open((event as CustomEvent).detail?.conversationId)};
  const click=(event:MouseEvent)=>{if(!mobile()||!(event.target instanceof Element))return;const trigger=event.target.closest<HTMLElement>('[data-chat-open]');if(trigger){event.preventDefault();event.stopImmediatePropagation();open(trigger.dataset.conversationId)}};
  loadDock();small.addEventListener('change',loadDock);standalone.addEventListener('change',loadDock);window.addEventListener('hmw:open-chat',request);document.addEventListener('click',click,true);
  return()=>{small.removeEventListener('change',loadDock);standalone.removeEventListener('change',loadDock);window.removeEventListener('hmw:open-chat',request);document.removeEventListener('click',click,true)};
 },[]);
 useEffect(()=>{window.dispatchEvent(new CustomEvent('hmw:chat-route'))},[path]);
 return null;
}
