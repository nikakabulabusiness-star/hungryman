/* Browser call coordinator. All signaling is authorized by the staff API. */
(()=>{
 if(location.pathname.replace(/\/$/,'')==='/chat/embed'||window.__hmCallsLoaded)return;
 window.__hmCallsLoaded=true;
 const origin=location.origin,tab=crypto.randomUUID(),leaseKey='hmw-call-sound-owner';
 let user='',checked=0,deniedUntil=0,active=null,incoming=null,busy=false,startSequence=0,polling=false,ringKind=null,frame=null,bootTimer=null,ringTimer=null,incomingTimer=null;
 const dismissed=new Set(),sounds={incoming:new Audio('/work/call-incoming.wav'),outgoing:new Audio('/work/call-outgoing.wav')};
 Object.values(sounds).forEach(sound=>{sound.loop=true;sound.volume=.35});
 const root=document.createElement('div');root.className='hm-call-root';
 root.innerHTML='<section class="hm-call-incoming" hidden role="alert"><strong data-name></strong><span data-kind></span><button data-accept>პასუხი</button><button data-decline>უარყოფა</button></section><button class="hm-call-unlock" data-sound hidden>ზარის ხმის ჩართვა</button><section class="hm-call-window" hidden role="dialog" aria-modal="true" aria-label="ზარი"><header><strong>Hungryman · ზარი</strong><button data-close>გათიშვა</button></header><p data-status role="status">ზარი მზადდება…</p><div data-frame></div></section><div class="hm-call-error" hidden role="alert"><span></span><button data-dismiss>დახურვა</button></div>';
 document.body.appendChild(root);
 const $=selector=>root.querySelector(selector),banner=$('.hm-call-incoming'),modal=$('.hm-call-window'),status=$('[data-status]');
 const errorBox=$('.hm-call-error');
 function error(text){errorBox.querySelector('span').textContent=text;errorBox.hidden=false}
 $('[data-dismiss]').onclick=()=>errorBox.hidden=true;
 async function request(path,method='GET',body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'ზარი ვერ შესრულდა.'),{status:response.status});return data}finally{clearTimeout(timer)}
 }
 function ownsSound(){try{const now=Date.now(),lease=JSON.parse(localStorage.getItem(leaseKey)||'null');if(lease&&lease.tab!==tab&&lease.until>now)return false;localStorage.setItem(leaseKey,JSON.stringify({tab,until:now+6000}));return true}catch{return true}}
 function ring(kind){
  if(kind===ringKind)return;
  Object.values(sounds).forEach(s=>{s.pause();s.currentTime=0});ringKind=kind;$('[data-sound]').hidden=true;
  if(kind)void sounds[kind].play().catch(()=>{if(ringKind===kind)$('[data-sound]').hidden=false});
 }
 $('[data-sound]').onclick=()=>{if(ringKind)void sounds[ringKind].play().then(()=>$('[data-sound]').hidden=true).catch(()=>{})};
 // Prime browser audio only after an actual interaction. Never hide autoplay failure.
 document.addEventListener('pointerdown',()=>{if(ringKind){void sounds[ringKind].play().catch(()=>{});return}for(const sound of Object.values(sounds)){sound.muted=true;void sound.play().then(()=>{sound.pause();sound.currentTime=0;sound.muted=false}).catch(()=>{sound.muted=false})}},{once:true});
 function post(value){frame?.contentWindow?.postMessage({type:'hmw:call-native',...value},origin)}
 function init(){if(active)post({init:{sessionId:active.sessionId,userId:user,layout:'responsive',mode:active.call.mode,name:active.call.creatorName,isGroup:active.call.isGroup??!active.call.conversationId.startsWith('dm_'),ringUntil:active.call.ringUntil??active.call.created+30000,answeredAt:active.call.answeredAt??null,autoJoin:true,outgoing:active.call.createdBy===user}})}
 function clear(){startSequence++;clearTimeout(bootTimer);clearTimeout(ringTimer);clearTimeout(incomingTimer);ring(null);frame?.remove();frame=null;active=null;incoming=null;modal.hidden=true;banner.hidden=true}
 async function finish(notifyServer=true){const old=active;if(!old){clear();return;}post({stop:true,notifyServer:false});clear();window.dispatchEvent(new CustomEvent('hmw:open-chat',{detail:{conversationId:old.call.conversationId}}));if(notifyServer)await request('/api/chat/calls','PATCH',{id:old.call.id,action:'left'}).catch(()=>{});void poll()}
 $('[data-close]').onclick=()=>void finish();
 async function open(call){
  if(active)return;
  dismissed.add(call.id);incoming=null;clearTimeout(incomingTimer);banner.hidden=true;ring(null);
  active={call,sessionId:crypto.randomUUID(),connected:false};modal.hidden=false;status.hidden=false;status.textContent='ზარი მზადდება…';
  frame=document.createElement('iframe');frame.title=call.mode==='audio'?'აუდიოზარი':'ვიდეოზარი';frame.allow='camera; microphone; autoplay';frame.src='/work/call.html?v=58';frame.onload=init;$('[data-frame]').appendChild(frame);
  const session=active.sessionId;bootTimer=setTimeout(()=>{if(active?.sessionId===session){status.hidden=false;status.textContent='ზარის ეკრანი ვერ ჩაიტვირთა. დახურე და სცადე ხელახლა.';ring(null)}},12000);
  if(call.createdBy===user){ring('outgoing');ringTimer=setTimeout(()=>{if(active?.sessionId!==session)return;ring(null);if(active.connected)return;void request('/api/chat/calls?id='+encodeURIComponent(call.id)).then(data=>{if(active?.sessionId===session){active.call=data.call;if(data.call.ended)void finish(false)}}).catch(()=>{})},Math.max(0,(call.ringUntil??call.created+30000)-Date.now()));}
 }
 async function start(conversationId,mode){
  if(active||busy)return;if(typeof conversationId!=='string'||!['audio','video'].includes(mode))return;
  busy=true;incoming=null;banner.hidden=true;ring(null);const attempt=++startSequence;modal.hidden=false;status.hidden=false;status.textContent='ვრეკავთ…';errorBox.hidden=true;
  try{const data=await request('/api/chat/calls','POST',{conversationId,mode});user=data.userId||user;if(attempt!==startSequence){if(data.call.createdBy===user)void request('/api/chat/calls','PATCH',{id:data.call.id,action:'left'}).catch(()=>{});return}await open(data.call)}catch(e){if(attempt===startSequence){clear();error(e.message||'ზარი ვერ შესრულდა.')}}finally{busy=false}
 }
 window.__hmStartCall=start;
 window.addEventListener('hmw:start-call',e=>void start(e.detail?.conversationId,e.detail?.mode));
 window.addEventListener('message',event=>{
  if(event.origin!==origin)return;
  const value=event.data;
  // Only the known chat dock may forward a start action, never an arbitrary iframe.
  if(value?.type==='hmw:start-call'&&event.source===document.querySelector('.hm-dock-frame')?.contentWindow){void start(value.conversationId,value.mode);return}
  if(!active||!frame||event.source!==frame.contentWindow||value?.type!=='hmw:call-web')return;
  if(value.ready){init();return}
  if(value.initialized){clearTimeout(bootTimer);status.hidden=true;return}
  if(value.connected){active.connected=true;ring(null);return}
  if(value.stopped){ring(null);return}
  if(value.fatal){ring(null);status.hidden=false;status.textContent='ზარის გაშვება შეფერხდა. დახურე და სცადე ხელახლა.';return}
  if(value.ended){void finish(false);return}
  if(value.leave){void finish();return}
  if(!value.rpc||!['join','poll','signal','leave','avatar'].includes(value.action))return;
  const session=active.sessionId,id=active.call.id,args=value.args||{},action=value.action;
  const operation=action==='avatar'?request('/api/chat/calls/avatar?id='+encodeURIComponent(id)+'&sessionId='+session+'&userId='+encodeURIComponent(String(args.userId||user))):action==='poll'?request('/api/chat/calls/session?id='+encodeURIComponent(id)+'&sessionId='+session+'&after='+Number(args.after||0)):request('/api/chat/calls/session','POST',{...args,id,sessionId:session,action});
  void operation.then(data=>{if(active?.sessionId===session){if(data.ended===true){void finish(false);return}post({reply:{key:value.rpc,result:data}})}}).catch(e=>{if(active?.sessionId===session){ring(null);if(action!=='avatar'&&([404,410].includes(e.status)||(e.status===409&&['join','poll'].includes(action)))){void finish(false);return}post({reply:{key:value.rpc,error:e.message||'კავშირი შეფერხდა.',code:e.status||0}})}});
 });
 $('[data-accept]').onclick=()=>{if(incoming)void open(incoming)};
 $('[data-decline]').onclick=()=>{if(!incoming)return;const id=incoming.id;dismissed.add(id);incoming=null;banner.hidden=true;ring(null);void request('/api/chat/calls','PATCH',{id,action:'declined'}).catch(e=>error(e.message))};
 async function poll(force=false){
  // Signed-out or unauthorized pages back off instead of polling every 1.5s forever.
  if(polling||!force&&!active&&Date.now()<deniedUntil)return;polling=true;
  try{
   const data=await request('/api/chat/calls');deniedUntil=0;
   if(user&&data.userId&&user!==data.userId){clear();dismissed.clear()}user=data.userId||user;
   const prefs={mutedIds:data.mutedIds||[]};
   if(active||busy)return;
   incoming=data.calls.find(c=>c.createdBy!==user&&!c.ended&&Date.now()<(c.ringUntil??c.created+30000)&&!dismissed.has(c.id)&&!prefs.mutedIds.includes(c.conversationId))||null;
   clearTimeout(incomingTimer);
   banner.hidden=!incoming;
   if(incoming){const current=incoming;$('[data-name]').textContent=current.creatorName;$('[data-kind]').textContent=current.mode==='audio'?'შემომავალი აუდიოზარი':'შემომავალი ვიდეოზარი';ring(ownsSound()?'incoming':null);incomingTimer=setTimeout(()=>{if(incoming?.id===current.id){dismissed.add(current.id);incoming=null;banner.hidden=true;ring(null)}},Math.max(0,(current.ringUntil??current.created+30000)-Date.now()))}else ring(null);
  }catch(e){if([401,403].includes(e.status)){clear();user='';checked=0;deniedUntil=Date.now()+30000}else if(!active){incoming=null;banner.hidden=true;ring(null)}}finally{polling=false}
 }
 window.addEventListener('pagehide',()=>{const old=active;clear();if(old)navigator.sendBeacon?.('/api/chat/calls/session',new Blob([JSON.stringify({id:old.call.id,sessionId:old.sessionId,action:'leave'})],{type:'application/json'}));try{const lease=JSON.parse(localStorage.getItem(leaseKey)||'null');if(lease?.tab===tab)localStorage.removeItem(leaseKey)}catch{}});
 window.addEventListener('hmw:chat-route',()=>void poll(true));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll(true)});
 void poll();setInterval(()=>void poll(),1500);
})();
