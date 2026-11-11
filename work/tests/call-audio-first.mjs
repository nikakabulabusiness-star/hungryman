import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script=fs.readFileSync('public/work/call.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.style={};this.hidden=false;this.playCalls=0;this.pauseCalls=0;this.classList={toggle(){},remove(){}}}
 append(...items){for(const item of items){item.parent=this;this.children.push(item)}}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(item=>item!==this)}
 replaceChildren(){this.children=[]}
 querySelector(tag){return this.children.find(item=>item.tag===tag)}
 setAttribute(){}addEventListener(){}removeEventListener(){}
 play(){this.playCalls++;return Promise.resolve()}
 pause(){this.pauseCalls++}
}
class Stream{
 constructor(tracks=[]){this.tracks=[...tracks]}
 getTracks(){return this.tracks}
 getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio')}
 getVideoTracks(){return this.tracks.filter(t=>t.kind==='video')}
 addTrack(track){this.tracks.push(track)}
 removeTrack(track){this.tracks=this.tracks.filter(t=>t!==track)}
}
const track=(kind,muted=false)=>({id:crypto.randomUUID(),kind,muted,enabled:true,readyState:'live',stop(){this.readyState='ended'}});
const elements=new Map(['status','grid','join','controls','mic','camera','flip','hang','notice'].map(id=>[id,new Element('div')]));
const document={getElementById:id=>elements.get(id)||elements.get('grid').children.find(e=>e.id===id),createElement:tag=>new Element(tag),addEventListener(){}};
const localMic=track('audio');localMic.enabled=false;
const localStream=new Stream([localMic]),localVideo=track('video');
const calls=[],pcs=[],timers=[],constraints=[];
const peer={userId:'other',sessionId:'ffffffff-ffff-4fff-8fff-ffffffffffff',name:'Other'};
let ended=false;
class PC{
 constructor(){this.signalingState='stable';this.senders=[];pcs.push(this)}
 addTrack(track){const sender={track,async replaceTrack(next){this.track=next}};this.senders.push(sender);return sender}
 addTransceiver(value){return {sender:this.addTrack(typeof value==='string'?null:value)}}
 async createOffer(){return {type:'offer',sdp:'audio-and-reserved-video'}}
 async setLocalDescription(){this.signalingState='have-local-offer'}
 close(){this.closed=true}
}
const window={addEventListener(){},ReactNativeWebView:{postMessage(raw){const call=JSON.parse(raw);calls.push(call);if(!call.rpc)return;const result=call.action==='join'?{iceServers:[],isGroup:false}:call.action==='poll'?{ended,peers:ended?[]:[peer],signals:[]}:{ok:true};queueMicrotask(()=>window.__hmReply(call.rpc,result))}}};
vm.runInNewContext(script,{window,document,navigator:{mediaDevices:{getUserMedia:async c=>{constraints.push(c);return c.audio===false?new Stream([localVideo]):localStream}}},RTCPeerConnection:PC,MediaStream:Stream,crypto,console,setTimeout(fn,ms){const t={fn,ms};timers.push(t);return t},clearTimeout:t=>{if(t)t.cancelled=true}});
const settle=async()=>{for(let n=0;n<40;n++)await Promise.resolve()};
window.__hmInit({sessionId:'00000000-0000-4000-8000-000000000000',mode:'audio',isGroup:false,name:'Other',autoJoin:true});
await settle();
assert.equal(constraints.length,1,'answer starts capture without a second join click');
assert.equal(constraints[0].video,false,'audio answering never requires a camera');
assert.equal(localMic.enabled,true,'microphone starts enabled on answer');
assert.equal(pcs[0].senders[0].track,localMic,'microphone is attached before camera capture');
assert.equal(elements.get('join').hidden,true,'active direct call has no join prompt');
assert.ok(calls.some(c=>c.mediaStarting),'native tone is notified before capture');

const tile=document.getElementById('peer-other'),audio=tile.querySelector('audio'),video=tile.querySelector('video');
assert.ok(audio,'remote audio needs an independent playback element');
const remoteMic=track('audio');pcs[0].ontrack({track:remoteMic,streams:[]});await settle();
assert.equal(audio.muted,false);assert.equal(audio.volume,1);
assert.equal(audio.srcObject.getAudioTracks()[0],remoteMic);
assert.equal(audio.srcObject.getVideoTracks().length,0,'reserved camera cannot delay audio-only playback');
assert.ok(audio.playCalls>0,'remote audio plays before any camera track exists');
assert.equal(video.style.opacity,'0');assert.equal(video.muted,true,'video cannot duplicate audio');
const playingAudio=audio.srcObject;
const remoteCamera=track('video',true);pcs[0].ontrack({track:remoteCamera,streams:[]});await settle();
assert.equal(audio.srcObject,playingAudio,'muted video receiver does not replace audio stream');
assert.equal(video.srcObject.getAudioTracks().length,0,'visual media stream remains video-only');
assert.equal(video.style.opacity,'0');
const audioPlayedBeforeCamera=audio.playCalls;await elements.get('camera').onclick();await settle();
assert.equal(constraints.length,2);assert.equal(audio.srcObject,playingAudio);
assert.ok(audioPlayedBeforeCamera>0,'camera press is unnecessary to unlock first audio');
assert.equal(localMic.enabled,true,'enabling camera preserves the enabled microphone');

const leavesBefore=calls.filter(c=>c.action==='leave').length;
ended=true;await timers.filter(t=>t.ms===300&&!t.cancelled).at(-1).fn();await settle();
assert.ok(calls.some(c=>c.ended===true),'server end tells the host to close and return to chat');
assert.equal(localMic.readyState,'ended');assert.equal(localVideo.readyState,'ended');
assert.equal(pcs[0].closed,true);assert.equal(audio.srcObject,null);assert.equal(video.srcObject,null);assert.ok(audio.pauseCalls>0);
assert.equal(calls.filter(c=>c.action==='leave').length,leavesBefore,'server end performs no redundant leave mutation');
// Video calls must establish audio and signaling even while camera permission
// is unanswered, or when it is denied entirely.
for(const cameraMode of ['deferred','denied']){
 const ui=new Map(['status','grid','join','controls','mic','camera','flip','hang','notice'].map(id=>[id,new Element('div')]));
 const doc={getElementById:id=>ui.get(id)||ui.get('grid').children.find(e=>e.id===id),createElement:tag=>new Element(tag),addEventListener(){}};
 const mic=track('audio');mic.enabled=false;
 const input=new Stream([mic]),camera=track('video'),events=[],rpcCalls=[],scheduled=[];
 let finish=false,resolveCamera;
 const host={addEventListener(){},ReactNativeWebView:{postMessage(raw){const call=JSON.parse(raw);rpcCalls.push(call);if(!call.rpc)return;events.push(call.action);const result=call.action==='join'?{iceServers:[],isGroup:false}:call.action==='poll'?{ended:finish,peers:finish?[]:[peer],signals:[]}:{ok:true};queueMicrotask(()=>host.__hmReply(call.rpc,result))}}};
 const beforePc=pcs.length;
 vm.runInNewContext(script,{window:host,document:doc,navigator:{mediaDevices:{getUserMedia:async c=>{
  if(c.audio!==false){events.push('microphone');assert.equal(c.video,false,'video call first requests microphone alone');return input}
  events.push('camera');if(cameraMode==='denied')throw Object.assign(Error('camera denied'),{name:'NotAllowedError'});
  return await new Promise(resolve=>resolveCamera=()=>resolve(new Stream([camera])));
 }}},RTCPeerConnection:PC,MediaStream:Stream,crypto,console,setTimeout(fn,ms){const t={fn,ms};scheduled.push(t);return t},clearTimeout:t=>{if(t)t.cancelled=true}});
 host.__hmInit({sessionId:'00000000-0000-4000-8000-000000000000',mode:'video',isGroup:false,name:'Other',autoJoin:true});await settle();
 assert.equal(mic.enabled,true,`${cameraMode} camera leaves microphone enabled`);
 assert.equal(mic.readyState,'live');assert.equal(ui.get('join').hidden,true);
 assert.ok(events.indexOf('join')<events.indexOf('camera'),'server join precedes camera permission');
 assert.ok(events.indexOf('poll')<events.indexOf('camera'),'peer discovery starts before camera permission');
 const connection=pcs[beforePc];assert.equal(connection.senders[0].track,mic);
 connection.ontrack({track:track('audio'),streams:[]});await settle();
 const receiver=doc.getElementById('peer-other').querySelector('audio');assert.ok(receiver.playCalls>0,'incoming audio plays while camera unavailable');
 assert.equal(rpcCalls.some(call=>call.stopped),false,'camera denial does not stop a joined call');
 if(cameraMode==='denied')assert.match(ui.get('notice').textContent,/აუდიოზარი/);
 finish=true;await scheduled.filter(t=>t.ms===300&&!t.cancelled).at(-1).fn();await settle();
 if(resolveCamera){resolveCamera();await settle();assert.equal(camera.readyState,'ended','late camera capture after remote hangup is released')}
 assert.equal(mic.readyState,'ended');assert.ok(rpcCalls.some(call=>call.ended===true));
 assert.equal(rpcCalls.some(call=>call.action==='leave'),false,'remote hangup does not send another leave');
}
console.log('PASS independent audio on answer, video calls before deferred/denied camera permission, late-camera release and direct server-end cleanup (media mocked).');
