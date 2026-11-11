/* One notification channel for work events and chat. No permission prompts on load. */
(() => {
 if (window.__hmDesktopNotices || location.pathname === '/chat/embed') return;
 window.__hmDesktopNotices = true;
 const started = Date.now(), tabId = crypto.randomUUID(), memory = new Set();
 let siteEnabled=true, audioContext, unlocked = false, lastSound = 0, user = '', stopped = false, timer, busy = false;
 const prefKey = 'hmw-desktop-sound';
 const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
 const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
 const enabled = () => siteEnabled && read(prefKey, true) !== false;
 const announce = () => window.dispatchEvent(new CustomEvent('hmw:desktop-state', {detail:{sound:enabled(),unlocked}}));
 function unlock() {
  if(audioContext?.state === 'running') return;
  try {
   const AudioContext = window.AudioContext || window.webkitAudioContext;
   if (!AudioContext) return;
   audioContext ||= new AudioContext();
   void audioContext.resume().then(() => { unlocked = audioContext.state === 'running'; announce(); }).catch(() => {});
  } catch {}
 }
 function sound(force = false) {
  if ((!force && !enabled()) || !audioContext || audioContext.state !== 'running' || Date.now() - lastSound < 900) return;
  lastSound = Date.now();
  const at = audioContext.currentTime;
  for (const [offset, hz] of [[0,740],[.10,990]]) {
   const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
   oscillator.type = 'sine'; oscillator.frequency.value = hz;
   gain.gain.setValueAtTime(0, at + offset); gain.gain.linearRampToValueAtTime(.10, at + offset + .012);
   gain.gain.exponentialRampToValueAtTime(.001, at + offset + .17);
   oscillator.connect(gain); gain.connect(audioContext.destination);
   oscillator.start(at + offset); oscillator.stop(at + offset + .18);
   oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
 }
 for (const event of ['pointerdown','keydown']) document.addEventListener(event,unlock,{passive:true});
 function href(target, id) {
  if (target === 'accounts') return '/admin/access';
  if (target === 'shoot') return '/shoots#shoot-' + encodeURIComponent(id);
  if (target === 'work') return '/work/tasks/video/' + encodeURIComponent(id);
  if (target === 'work_task') return '/work/tasks?view=mine&task=' + encodeURIComponent(id);
  if (target === 'requests') return '/admin/time-off';
  if (target === 'chat') return '/chat?conversationId=' + encodeURIComponent(id);
  if (target === 'calendar' || target === 'attendance') return '/team';
  return '/team/notifications';
 }
 async function claim(id, recipient) {
  const key = 'hmw-desktop-delivered:' + recipient;
  const take = () => {
   const recent = read(key, []).filter(item => Array.isArray(item) && item[1] > Date.now()-86400000);
   if (memory.has(recipient+':'+id) || recent.some(item=>item[0]===id)) return false;
   memory.add(recipient+':'+id); write(key, [...recent,[id,Date.now(),tabId]].slice(-250)); return true;
  };
  if (navigator.locks?.request) return navigator.locks.request(key,take);
  return take();
 }
 window.hmDesktopNotify = async event => {
  if (!siteEnabled || !event || !event.id || !event.userId) return;
  // A locked background tab must not consume the audio event before an unlocked tab.
  if(enabled() && audioContext?.state === 'running' && await claim('audio:'+event.id,event.userId)) sound();
  if ('Notification' in window && Notification.permission === 'granted' && (document.hidden || !document.hasFocus()) && await claim('banner:'+event.id,event.userId)) {
   try {
    // Keep private message/HR details inside the authenticated site, off the OS lock screen.
    const notice = new Notification('Hungryman Work', {body:event.chat?'ახალი შეტყობინება ჩატში':'ახალი შეტყობინება სამუშაო სივრცეში',icon:'/hungryman.svg',tag:'hmw-'+event.id,silent:true});
    notice.onclick = () => { window.focus(); notice.close(); location.assign(href(event.target,event.targetId||'')); };
    setTimeout(()=>notice.close(),12000);
   } catch {}
  }
 };
 window.addEventListener('hmw:desktop-toggle', event => { write(prefKey,event.detail?.enabled !== false); unlock(); announce(); });
 window.addEventListener('hmw:desktop-test', () => { unlock(); if(audioContext)void audioContext.resume().then(()=>sound(true)).catch(()=>{}); });
 window.addEventListener('storage',event=>{if(event.key===prefKey)announce();});
 let seen = new Set(), baseline = false;
 async function poll() {
  if (busy || stopped) return;
  if (location.pathname.startsWith('/team/auth') || location.pathname.startsWith('/apply/') || location.pathname === '/careers') { timer=setTimeout(poll,10000); return; }
  busy = true;
  try {
   const response = await fetch('/api/notifications?desktop=1',{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if (response.status === 401 || response.status === 403) { user='';seen.clear();baseline=false;return; }
   if (!response.ok) return;
   const data=await response.json();
   siteEnabled=!data.disabled;if(!siteEnabled){baseline=false;return;}
   if (!data.userId) return;
   if(user!==data.userId){user=data.userId;seen.clear();baseline=false;}
   const items=Array.isArray(data.items)?data.items:[];
   for(const item of [...items].reverse()) {
    if(!seen.has(item.id)&&!item.read_at&&(baseline||item.created>=started-5000))void window.hmDesktopNotify({id:'work:'+item.id,userId:user,target:item.target,targetId:item.target_id});
    seen.add(item.id);
   }
   if(seen.size>500)seen=new Set(items.map(item=>item.id));
   baseline=true;
   window.dispatchEvent(new CustomEvent('hmw:desktop-counts',{detail:{unread:data.unread,requests:data.requests,chatUnread:data.chatUnread}}));
  } catch {} finally { busy=false;timer=setTimeout(poll,document.hidden?12000:5000); }
 }
 window.addEventListener('hmw-work-updated',()=>{clearTimeout(timer);void poll();});
 document.addEventListener('visibilitychange',()=>{clearTimeout(timer);void poll();});
 window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);});
 window.addEventListener('pageshow',()=>{if(stopped){stopped=false;void poll();}});
 void poll();
})();
