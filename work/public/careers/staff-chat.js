(()=>{
 const ping=()=>{if(document.visibilityState==='visible')fetch('/api/chat/presence',{method:'POST'}).catch(()=>{})};
 ping();
 window.setInterval(ping,30000);
 document.addEventListener('visibilitychange',ping);
 const trigger=document.querySelector('.staff-chat-trigger');
 const panel=document.getElementById('staff-chat-panel');
 const close=panel?.querySelector('.staff-chat-close');
 const backdrop=document.querySelector('.staff-chat-backdrop');
 const frame=panel?.querySelector('iframe[data-src]');
 if(!trigger||!panel)return;
 const setOpen=(open)=>{
  panel.classList.toggle('is-open',open);
  backdrop?.classList.toggle('is-open',open);
  panel.setAttribute('aria-hidden',String(!open));
  trigger.setAttribute('aria-expanded',String(open));
  document.documentElement.classList.toggle('staff-chat-open',open);
  if(open&&frame&&!frame.getAttribute('src'))frame.setAttribute('src',frame.dataset.src||'/chat/embed');
  if(open)close?.focus();else trigger.focus();
 };
 trigger.addEventListener('click',()=>setOpen(trigger.getAttribute('aria-expanded')!=='true'));
 close?.addEventListener('click',()=>setOpen(false));
 backdrop?.addEventListener('click',()=>setOpen(false));
 document.addEventListener('keydown',event=>{
  if(!panel.classList.contains('is-open'))return;
  if(event.key==='Escape'){setOpen(false);return}
  if(event.key!=='Tab')return;
  const focusable=[...panel.querySelectorAll('a[href],button:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])')].filter(element=>!element.hasAttribute('hidden'));
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1],active=document.activeElement;
  if(event.shiftKey&&active===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&active===last){event.preventDefault();first.focus()}
 });
})();
