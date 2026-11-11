import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync('public/work/call-client.js','utf8');
class Events{handlers=new Map();dispatched=[];addEventListener(k,f){if(!this.handlers.has(k))this.handlers.set(k,[]);this.handlers.get(k).push(f)}emit(k,e={}){for(const f of this.handlers.get(k)||[])f(e)}dispatchEvent(e){this.dispatched.push(e);this.emit(e.type,e)}}
class Element extends Events{nodes=new Map();children=[];hidden=false;removed=false;constructor(tag){super();this.tag=tag;if(tag==='iframe')this.contentWindow={sent:[],postMessage(value,origin){this.sent.push({value,origin})}}}querySelector(key){if(!this.nodes.has(key)){const e=new Element(key);e.hidden=['.hm-call-incoming','.hm-call-window','.hm-call-error','[data-sound]'].includes(key);this.nodes.set(key,e)}return this.nodes.get(key)}appendChild(e){this.children.push(e);return e}remove(){this.removed=true}}
const settle=async()=>{for(let i=0;i<40;i++)await Promise.resolve()};
function harness(pathname='/chat',options={}){
 const document=new Events();document.body=new Element('body');document.createElement=tag=>new Element(tag);document.querySelector=()=>null;
 // The actual site may be hosted within an unrelated outer frame. It still
 // owns its call coordinator; only its explicitly embedded chat forwards calls.
 const window=new Events();window.top={};window.parent=window.top;
 const timers=[],requests=[],sounds=[],storage=new Map();
 class Audio{constructor(src){this.src=src;this.plays=0;this.paused=true;sounds.push(this)}play(){this.plays++;this.paused=false;return Promise.resolve()}pause(){this.paused=true}}
 const state={user:'receiver',muted:false,allowed:true,postGate:null,sessionEnded:false,signalStatus:200,avatarStatus:200};
 const call={id:'call-1',createdBy:'caller',creatorName:'Caller',mode:'video',conversationId:'dm_thread',created:Date.now(),ringUntil:Date.now()+30000,isGroup:false,answeredAt:null,ended:null,...options};
 const fetch=async(path,options={})=>{
  const body=options.body&&JSON.parse(options.body),method=options.method||'GET';requests.push({path,body,method});let payload={};
  if(path==='/api/chat/calls'&&method==='POST'){
   if(state.postGate)await state.postGate;
   payload={userId:state.user,call:{...call,createdBy:state.user}};
  }else if(path==='/api/chat/calls'&&method==='GET')payload={userId:state.user,mutedIds:state.muted?[call.conversationId]:[],calls:state.allowed?[call]:[]};
  else if(path.startsWith('/api/chat/calls?id='))payload={call};
  else if(path.startsWith('/api/chat/calls/avatar'))payload={dataUrl:null};
  else if(path.startsWith('/api/chat/calls/session'))payload=body?.action==='join'?{iceServers:[],relayAvailable:false,isGroup:call.isGroup,ringUntil:call.ringUntil}:{ended:state.sessionEnded,peers:[],signals:[]};
  else if(path==='/api/chat/calls'&&method==='PATCH')payload={ok:true};
  else throw Error('Unexpected extra API request: '+path);
  const status=!state.allowed?401:body?.action==='signal'?state.signalStatus:path.startsWith('/api/chat/calls/avatar')?state.avatarStatus:200;
  return {ok:status<400,status,json:async()=>payload};
 };
 vm.runInNewContext(script,{window,document,location:{origin:'https://work.test',pathname},crypto,Audio,fetch,AbortController,Blob,CustomEvent:class{constructor(type,args){this.type=type;this.detail=args.detail}},navigator:{},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},console,setTimeout(fn,ms){const t={fn,ms};timers.push(t);return t},clearTimeout(t){if(t)t.cancelled=true},setInterval(fn,ms){timers.push({fn,ms,interval:true})}});
 return {document,window,timers,requests,sounds,state,call};
}
const {document,window,timers,requests,sounds,state}=harness();await settle();
assert.equal(document.body.children.length,1,'coordinator initializes inside an unrelated outer iframe');
const root=document.body.children[0],banner=root.querySelector('.hm-call-incoming'),modal=root.querySelector('.hm-call-window');
assert.equal(banner.hidden,false,'desktop receives mobile invite');assert.equal(sounds[0].paused,false,'incoming invite rings');
root.querySelector('[data-accept]').onclick();await settle();const frame=root.querySelector('[data-frame]').children.at(-1);assert.equal(modal.hidden,false);assert.ok(frame.allow.includes('camera'));assert.equal(sounds[0].paused,true,'accept stops ringtone');
const emit=(value,origin='https://work.test',source=frame.contentWindow)=>window.emit('message',{origin,source,data:{type:'hmw:call-web',...value}});
emit({ready:true});assert.equal(frame.contentWindow.sent.at(-1).value.init.autoJoin,true);assert.equal(frame.contentWindow.sent.at(-1).value.init.isGroup,false);assert.ok(frame.contentWindow.sent.at(-1).value.init.ringUntil);
const before=requests.length;emit({rpc:'spoof',action:'join'},'https://evil.test');emit({rpc:'spoof',action:'join'},'https://work.test',{});assert.equal(requests.length,before,'bridge rejects other origins and frames');
emit({rpc:'join',action:'join',args:{id:'other-call',sessionId:'attacker'}});await settle();const join=requests.at(-1);assert.equal(join.body.id,'call-1');assert.notEqual(join.body.sessionId,'attacker');assert.equal(frame.contentWindow.sent.at(-1).value.reply.key,'join');
emit({connected:true});assert.ok(sounds.every(s=>s.paused));emit({leave:true});await settle();assert.equal(modal.hidden,true);assert.ok(requests.some(r=>r.body?.action==='left'));assert.equal(frame.removed,true,'hangup removes media iframe');
window.emit('hmw:start-call',{detail:{conversationId:'thread',mode:'audio'}});assert.equal(modal.hidden,false,'call action shows feedback synchronously');await settle();assert.equal(sounds[1].paused,false,'outgoing call has ringback');
const outgoing=root.querySelector('[data-frame]').children.at(-1);window.emit('message',{origin:'https://work.test',source:outgoing.contentWindow,data:{type:'hmw:call-web',mediaStarting:true}});assert.equal(sounds[1].paused,false,'browser ringback keeps its user-gesture-authorized player until connected');window.emit('message',{origin:'https://work.test',source:outgoing.contentWindow,data:{type:'hmw:call-web',connected:true}});assert.equal(sounds[1].paused,true,'connected stops ringback');root.querySelector('[data-close]').onclick();await settle();assert.equal(requests.filter(r=>r.body?.action==='left').length,2,'creator also leaves through server direct/group rules');
assert.equal(window.dispatched.at(-1).detail.conversationId,'dm_thread','hangup returns to its conversation');
// A slow create response must not reopen a call the user already cancelled.
let resolvePost;state.postGate=new Promise(r=>resolvePost=r);const frameCount=root.querySelector('[data-frame]').children.length,ends=requests.filter(r=>r.body?.action==='left').length;
window.emit('hmw:start-call',{detail:{conversationId:'thread',mode:'audio'}});assert.equal(modal.hidden,false);assert.match(root.querySelector('[data-status]').textContent,/ვრეკავთ/);
root.querySelector('[data-close]').onclick();assert.equal(modal.hidden,true);resolvePost();await settle();state.postGate=null;
assert.equal(modal.hidden,true,'cancelled pending POST cannot open a ghost call');assert.equal(root.querySelector('[data-frame]').children.length,frameCount);assert.equal(requests.filter(r=>r.body?.action==='left').length,ends+1,'late-created outgoing call leaves without terminating other group participants');
assert.equal(requests.some(r=>r.path==='/api/mobile/me'),false,'start and incoming poll use the authorized calls endpoint without a separate identity waterfall');
state.allowed=false;await timers.find(t=>t.interval).fn();await settle();assert.equal(modal.hidden,true);assert.equal(banner.hidden,true);assert.ok(sounds.every(s=>s.paused));
for(const pathname of ['/chat/embed','/chat/embed/']){const embed=harness(pathname);await settle();assert.equal(embed.document.body.children.length,0,'known chat dock never mounts its own call coordinator');assert.equal(embed.requests.length,0)}
for(const endedBy of ['event','session']){
 const h=harness();await settle();const r=h.document.body.children[0];r.querySelector('[data-accept]').onclick();await settle();const f=r.querySelector('[data-frame]').children.at(-1);h.state.sessionEnded=true;
 h.window.emit('message',{origin:'https://work.test',source:f.contentWindow,data:{type:'hmw:call-web',...(endedBy==='event'?{ended:true}:{rpc:'p',action:'poll'})}});await settle();
 assert.equal(r.querySelector('.hm-call-window').hidden,true,'remote hangup immediately dismisses media UI');assert.equal(f.removed,true);assert.equal(h.requests.filter(q=>q.method==='PATCH').length,0,'server-ended call is never re-ended');assert.equal(h.window.dispatched.at(-1).detail.conversationId,'dm_thread');
}
{
 const h=harness();await settle();const r=h.document.body.children[0],deadline=h.timers.find(t=>t.ms>29000&&t.ms<=30000&&!t.cancelled);assert.ok(deadline,'invite lifetime uses server30second deadline');deadline.fn();assert.equal(r.querySelector('.hm-call-incoming').hidden,true);assert.equal(h.sounds[0].paused,true,'incoming sound stops at deadline without waiting for another network poll');
}
{
 const h=harness('/chat',{ringUntil:Date.now()-1});await settle();assert.equal(h.document.body.children[0].querySelector('.hm-call-incoming').hidden,true,'expired invites never reappear');
}
{
 const h=harness('/chat',{isGroup:true,conversationId:'group_team'});await settle();const r=h.document.body.children[0];h.window.emit('hmw:start-call',{detail:{conversationId:'group_team',mode:'audio'}});await settle();const f=r.querySelector('[data-frame]').children.at(-1);h.window.emit('message',{origin:'https://work.test',source:f.contentWindow,data:{type:'hmw:call-web',ready:true}});assert.equal(f.contentWindow.sent.at(-1).value.init.isGroup,true);r.querySelector('[data-close]').onclick();await settle();assert.equal(h.requests.filter(q=>q.method==='PATCH').at(-1).body.action,'left','group creator only leaves their own participation');
}
{
 const h=harness('/chat',{isGroup:true,conversationId:'group_team'});await settle();const r=h.document.body.children[0];r.querySelector('[data-accept]').onclick();const f=r.querySelector('[data-frame]').children.at(-1);h.state.signalStatus=409;h.window.emit('message',{origin:'https://work.test',source:f.contentWindow,data:{type:'hmw:call-web',rpc:'signal-left',action:'signal',args:{target:'departed-caller'}}});await settle();assert.equal(r.querySelector('.hm-call-window').hidden,false,'a departed group peer does not close remaining participants');assert.equal(f.contentWindow.sent.at(-1).value.reply.code,409);assert.equal(h.requests.filter(q=>q.method==='PATCH').length,0);
 h.state.avatarStatus=404;h.window.emit('message',{origin:'https://work.test',source:f.contentWindow,data:{type:'hmw:call-web',rpc:'photo-left',action:'avatar',args:{userId:'departed-caller'}}});await settle();assert.equal(r.querySelector('.hm-call-window').hidden,false,'departed peer avatar is optional and cannot terminate group call');
}
console.log('PASS browser immediate call feedback,30second ringing, no stale invitations, direct/group leave, remote end auto-close, bridge isolation, cancellation and access revocation.');
