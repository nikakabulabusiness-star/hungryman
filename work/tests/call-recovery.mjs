import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('public/work/call.html','utf8');
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const $=id=>'));
class E{
 constructor(tag){this.tag=tag;this.children=[];this.style={};this.dataset={};this.classes=new Set();this.classList={toggle:(name,on)=>{if(on===undefined)on=!this.classes.has(name);on?this.classes.add(name):this.classes.delete(name)},remove:name=>this.classes.delete(name)};}
 append(...items){for(const item of items){item.parent=this;this.children.push(item)}}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(v=>v!==this)}
 replaceChildren(){this.children=[]}
 querySelector(tag){return this.children.find(v=>v.tag===tag)}
 setAttribute(){}addEventListener(){}removeEventListener(){}play(){return Promise.resolve()}
}
const track=kind=>({id:crypto.randomUUID(),kind,enabled:true,muted:false,readyState:'live',stop(){this.readyState='ended'}});
class Stream{constructor(tracks=[]){this.tracks=tracks}getTracks(){return this.tracks}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video')}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio')}addTrack(t){this.tracks.push(t)}removeTrack(t){this.tracks=this.tracks.filter(v=>v!==t)}}
async function check(failureStatus){
const nodes=new Map(['status','grid','join','controls','mic','camera','flip','hang','notice'].map(id=>[id,new E('div')]));
const document={getElementById:id=>nodes.get(id)||nodes.get('grid').children.find(e=>e.id===id),createElement:tag=>new E(tag),addEventListener(){},documentElement:{dataset:{}}};
const peer={userId:'peer',sessionId:'ffffffff-ffff-4fff-8fff-ffffffffffff',name:'Peer'},local=new Stream([track('audio'),track('video')]);
const calls=[],timers=[],pcs=[];let now=1000,failOffers=2,poll={ended:false,peers:[peer],signals:[]},seq=0;
class PC{
 constructor(){this.signalingState='stable';this.connectionState='new';this.senders=[];this.offers=0;pcs.push(this)}
 addTrack(track){const sender={track,setStreams(){},replaceTrack:async t=>sender.track=t};this.senders.push(sender);return sender}
 addTransceiver(value){return {sender:this.addTrack(typeof value==='string'?null:value)}}
 async createOffer(options){this.offers++;this.lastOptions=options;return {type:'offer',sdp:'offer-'+this.offers}}
 async setLocalDescription(sdp){this.localDescription=sdp;this.signalingState=sdp.type==='offer'?'have-local-offer':'stable'}
 async setRemoteDescription(sdp){this.remoteDescription=sdp;this.signalingState=sdp.type==='offer'?'have-remote-offer':'stable'}
 async addIceCandidate(){}close(){this.closed=true}
}
const window={addEventListener(){},HMCallLayout:{attachSelf(){},refresh(){},reset(){}},ReactNativeWebView:{postMessage(raw){const m=JSON.parse(raw);calls.push(m);if(!m.rpc)return;const fail=m.action==='signal'&&m.args.payload.type==='offer'&&failOffers-->0;
 const data=m.action==='join'?{iceServers:[]}:m.action==='poll'?structuredClone(poll):{ok:true};queueMicrotask(()=>window.__hmReply(m.rpc,data,fail?'temporary network gap':null,fail?failureStatus:0));}}};
vm.runInNewContext(script,{window,document,navigator:{mediaDevices:{getUserMedia:async()=>local}},RTCPeerConnection:PC,MediaStream:Stream,crypto,Date:{now:()=>now},console,setTimeout(fn,ms){const t={fn,ms};timers.push(t);return t},clearTimeout(t){if(t)t.cancelled=true}});
const settle=async()=>{for(let i=0;i<60;i++)await Promise.resolve()};
async function tick(){const t=timers.filter(t=>[300,1200].includes(t.ms)&&!t.cancelled&&!t.fired).at(-1);assert.ok(t,'poll must remain scheduled');t.fired=true;await t.fn();await settle()}
const offers=()=>calls.filter(m=>m.action==='signal'&&m.args.payload.type==='offer');
window.__hmInit({sessionId:'00000000-0000-4000-8000-000000000000',mode:'video',name:'Team',autoJoin:true});await settle();
assert.equal(pcs.length,1);assert.equal(offers().length,2,'first offer experiences two failed POST attempts');assert.equal(local.getAudioTracks()[0].readyState,'live','transient signaling failure keeps microphone');
await tick();assert.equal(offers().length,3,'subsequent poll retries lost initial offer');assert.equal(pcs[0].offers,1,'retry reuses the same local SDP');assert.equal(offers()[0].args.payload.sdp,offers()[2].args.payload.sdp);
poll.signals=[{seq:++seq,sender:peer.userId,payload:{type:'answer',sdp:'answer',sessionId:peer.sessionId}}];await tick();const pc=pcs[0];assert.equal(pc.signalingState,'stable');
pc.connectionState='connected';pc.onconnectionstatechange();await settle();
const remoteVideo=track('video');pc.ontrack({track:remoteVideo,streams:[]});const tile=document.getElementById('peer-peer'),view=tile.querySelector('video');assert.equal(view.style.opacity,'1');
poll.signals=[{seq:++seq,sender:peer.userId,payload:{type:'media',camera:false,sessionId:peer.sessionId}}];await tick();assert.equal(view.style.opacity,'0','explicit camera-off hides frozen/black video');assert.equal(tile.classes.has('has-video'),false);
poll.signals=[{seq:++seq,sender:peer.userId,payload:{type:'media',camera:true,sessionId:peer.sessionId}}];await tick();assert.equal(view.style.opacity,'1');
poll={ended:false,peers:[],signals:[]};await tick();assert.ok(!pc.closed,'one missing peer snapshot does not drop media');now+=7000;await tick();assert.ok(!pc.closed,'brief gap remains in grace');poll.peers=[peer];await tick();assert.equal(pcs.length,1,'returning peer retains existing connection');
pc.connectionState='disconnected';pc.onconnectionstatechange();const recovery=timers.filter(t=>t.ms===3000&&!t.cancelled).at(-1);assert.ok(recovery);pc.connectionState='connected';pc.onconnectionstatechange();assert.equal(recovery.cancelled,true,'connected clears recovery timer');const before=offers().length;await recovery.fn();await settle();assert.equal(offers().length,before,'already recovered connection does not restart ICE');
poll.peers=[];now+=100;await tick();now+=8100;await tick();assert.equal(pc.closed,true,'sustained absence eventually releases peer');
window.__hmStop();await settle();assert.equal(local.getAudioTracks()[0].readyState,'ended');
}
await check(503);await check(409);
console.log('PASS lost SDP resend, brief missing-peer grace, recovery cancellation, explicit camera-off state and cleanup (media mocked).');
