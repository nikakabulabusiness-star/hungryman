import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped controller against DOM/network adapters. This checks
// access, lifecycle and notification routing, not browser layout or styling.
class Events {
  listeners=new Map();
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn)}
  dispatchEvent(event){for(const fn of this.listeners.get(event.type)||[])fn(event);return true}
  emit(type,properties={}){this.dispatchEvent({type,...properties})}
}
let focused;
class Element extends Events {
  constructor(tag='div'){super();this.tag=tag;this.children=[];this.nodes=new Map();this.attrs={};this.dataset={};this.hidden=false;this.classes=new Set();this.classList={add:(c)=>this.classes.add(c),remove:(c)=>this.classes.delete(c),contains:(c)=>this.classes.has(c),toggle:(c,force)=>{const next=force??!this.classes.has(c);if(next)this.classes.add(c);else this.classes.delete(c);return next}};if(tag==='iframe')this.contentWindow={sent:[],postMessage(data,origin){this.sent.push({data,origin})}}}
  querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new Element(selector==='img'?'img':'button'));return this.nodes.get(selector)}
  querySelectorAll(selector){return selector.split(',').map(s=>this.querySelector(s))}
  appendChild(child){child.parent=this;this.children.push(child);return child}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.removed=true}
  setAttribute(key,value){this.attrs[key]=value}
  getAttribute(key){return this.attrs[key]}
  focus(){focused=this}
  showModal(){this.open=true}
  close(){this.open=false;this.emit('close')}
  closest(){return null}
}
const document=new Events();document.body=new Element('body');document.documentElement=new Element('html');document.hidden=false;document.createElement=tag=>new Element(tag);document.querySelector=()=>document.body.children.find(n=>n.tag==='dialog'&&n.open)||null;
const window=new Events();window.top=window;
const location={origin:'https://work.example',pathname:'/team',search:''};
const storage=new Map(),localStorage={setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)};
const audios=[];
class Audio extends Element {constructor(){super('audio');audios.push(this);this.played=0}play(){if(!this.muted)this.played++;return Promise.resolve()}pause(){}}
let now=100000,auth=false,updates=[],conversations=[],timerId=0;
const timers=new Map(),requests=[];
class Clock extends Date {static now(){return now}}
const context={window,document,location,localStorage,Audio,Element,Date:Clock,Map,URLSearchParams,crypto:{randomUUID:()=> 'this-tab'},CustomEvent:class {constructor(type,options={}){this.type=type;this.detail=options.detail}},
setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId},clearTimeout:id=>timers.delete(id),
fetch:async(url,options)=>{requests.push({url,options});if(url==='/api/mobile/me')return {ok:auth,json:async()=>({user:{userId:'me'},permissions:{isApprovedStaff:auth,permissions:auth?['workspace.view','chat.view']:[]}})};if(url==='/api/chat/conversations')return {ok:true,json:async()=>({conversations})};if(url.startsWith('/api/chat/updates')){const messages=updates;updates=[];return{ok:auth,status:auth?200:403,json:async()=>({messages})}};return{ok:true,json:async()=>({})}}};
const code=fs.readFileSync('public/work/chat-dock.js','utf8');vm.runInNewContext(code,context);
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function poll(ms=3000){now+=ms;const next=[...timers.entries()].find(([,t])=>t.fn.name==='poll');assert.ok(next,'Next poll remains scheduled');timers.delete(next[0]);await next[1].fn();await settle()}
const root=document.body.children[0],q=s=>root.querySelector(s),open=(id)=>window.emit('hmw:open-chat',{detail:{conversationId:id}});
await settle();assert.equal(root.hidden,true,'Visitors have no chat dock');assert.equal(q('.hm-dock-panel').children.length,0,'No private iframe is eagerly loaded');
// Opening while access is still being checked must not lose the user's click.
open('dm_a_b');auth=true;await poll(31000);assert.equal(root.hidden,false);assert.equal(q('.hm-dock-panel').hidden,false);
const panel=q('.hm-dock-panel'),frame=panel.children[0];assert.match(frame.src,/conversationId=dm_a_b/);
function message(data,source=frame.contentWindow,origin=location.origin){window.emit('message',{data,source,origin})}
message({type:'hmw:chat-ready'},frame.contentWindow,'https://other.example');assert.equal(frame.contentWindow.sent.length,0,'Untrusted origins cannot control the dock');
message({type:'hmw:chat-ready'});assert.ok(frame.contentWindow.sent.some(p=>p.data.type==='hmw:chat-open'&&p.data.conversationId==='dm_a_b'));
message({type:'hmw:chat-thread',conversationId:'team',reading:true});assert.match(q('[data-expand]').href,/dm_a_b/,'A stale initialization message cannot replace the requested thread');
message({type:'hmw:chat-thread',conversationId:'dm_a_b',title:'Private chat',reading:true});
await settle();assert.equal(audios.length,0,'Foreground badge-only mode never creates an audio player');assert.ok(!root.innerHTML.includes('hm-dock-alert'),'No in-page message banner is mounted');
const incoming=(id,conversationId,muted=0,mentioned=0)=>({id,conversationId,body:'Hello',authorName:'Colleague',kind:'message',created:now,muted,mentioned});
updates=[incoming('active','dm_a_b')];await poll();assert.equal(q('.hm-dock-launcher').hidden,true,'Polling must not reveal the launcher behind an open chat');window.emit('hmw:chat-route');assert.equal(q('.hm-dock-launcher').hidden,true,'Route sync keeps the open chat as the only floating control');assert.equal(q('.hm-dock-launcher b').hidden,true,'Reading the current thread creates no unread badge');
updates=[incoming('muted','team',1)];await poll();assert.equal(q('.hm-dock-launcher b').textContent,'1','Muted messages still count as unread');assert.equal(audios.length,0);
updates=[incoming('mention','team',1,1)];await poll();assert.equal(q('.hm-dock-launcher b').textContent,'2','Mentions update badge without a foreground popup or sound');assert.equal(audios.length,0);
open('team');assert.ok(frame.contentWindow.sent.some(p=>p.data.type==='hmw:chat-open'&&p.data.conversationId==='team'),'A requested conversation opens inside the dock');assert.equal(location.pathname,'/team','Opening chat does not navigate away');
message({type:'hmw:chat-thread',conversationId:'team',title:'Team',reading:true});
frame.draft='unsent draft';q('[data-minimize]').emit('click');assert.equal(panel.hidden,true);assert.equal(frame.contentWindow.sent.at(-1).data.visible,false);assert.equal(focused,q('.hm-dock-launcher'));
message({type:'hmw:chat-read',conversationId:'team'});updates=[incoming('minimized','team')];await poll();assert.equal(q('.hm-dock-launcher b').hidden,false,'A minimized conversation shows an unread badge');assert.equal(audios.length,0,'Minimized conversations remain quiet');
q('.hm-dock-launcher').emit('click');assert.equal(panel.children[0],frame,'Reopening reuses the iframe and draft');assert.equal(frame.draft,'unsent draft');
message({type:'hmw:chat-thread',conversationId:'team',title:'Team',reading:true});
const photo='11111111-1111-4111-8111-111111111111';
message({type:'hmw:chat-photo',attachmentId:photo},{},location.origin);assert.equal(document.body.children.length,1,'Other windows cannot open media');
message({type:'hmw:chat-photo',attachmentId:'https://other.example/image'});assert.equal(document.body.children.length,1,'Arbitrary media URLs are rejected');
message({type:'hmw:chat-photo',attachmentId:photo});const dialog=document.body.children.at(-1);assert.equal(dialog.open,true);assert.equal(dialog.querySelector('img').src,'/api/chat/attachments?id='+photo);
dialog.querySelector('[data-zoom]').emit('click');assert.equal(dialog.classList.contains('is-zoomed'),true);dialog.querySelector('.hm-photo-canvas').emit('click');assert.equal(dialog.classList.contains('is-zoomed'),false);dialog.emit('click',{target:dialog});assert.equal(dialog.removed,true);assert.equal(frame.contentWindow.sent.at(-1).data.type,'hmw:photo-closed');assert.equal(location.pathname,'/team');
q('[data-close]').emit('click');assert.equal(panel.hidden,true);assert.equal(q('.hm-dock-launcher').hidden,false);
location.pathname='/chat';document.documentElement.dataset.hmChatThread='team';window.emit('hmw:chat-route');assert.equal(q('.hm-dock-launcher').hidden,true);let selected;window.addEventListener('hmw:chat-select',e=>{selected=e.detail.conversationId});open('grp_test');assert.equal(selected,'grp_test','A full-page chat selection stays in the existing workspace');
document.hidden=true;const requestsBeforeHidden=requests.length;await poll(5000);assert.equal(requests.length,requestsBeforeHidden,'Hidden pages do not poll chat or preload private messages');document.hidden=false;
auth=false;await poll(31000);assert.equal(root.hidden,true);assert.equal(frame.removed,true,'Losing staff access destroys the private iframe');
vm.runInNewContext(code,context);assert.equal(document.body.children.length,1,'Only one controller is mounted per page');
console.log('PASS: staff gating, compact open/minimize/close, draft preservation, chat routing, foreground badge-only behavior, same-origin media bridge, reversible photo zoom and access revocation.');

for(const query of ['(max-width:760px)','(display-mode: standalone)']){
 const w=new Events();w.matchMedia=q=>({matches:q===query,addEventListener(){}});
 const d=new Events();d.body=new Element('body');d.createElement=tag=>new Element(tag);
 let calls=0;vm.runInNewContext(code,{...context,window:w,document:d,fetch:async()=>{calls++;throw Error('Mobile dock must not fetch')}});
 assert.equal(d.body.children.length,0,'Mobile/PWA never mounts desktop chat overlay');assert.equal(calls,0,'Mobile/PWA never starts desktop dock polling');
}
window.matchMedia=()=>({matches:true,addEventListener(){}});const beforeMobile=requests.length;await poll();assert.equal(requests.length,beforeMobile,'Desktop to mobile resize stops dock requests');
console.log('PASS mobile and standalone startup suppression; resized desktop dock stops polling.');
