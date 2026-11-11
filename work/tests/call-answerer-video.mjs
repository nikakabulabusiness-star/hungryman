import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Model the WebRTC distinction absent from the old mock: an unassociated
// addTransceiver-created sender is NOT matched by an incoming offer.
const html=fs.readFileSync('public/work/call.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.style={};this.classList={toggle(){},remove(){}};this.hidden=false}
 append(...items){for(const item of items){item.parent=this;this.children.push(item)}}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(v=>v!==this)}
 replaceChildren(){this.children=[]}
 querySelector(tag){return this.children.find(v=>v.tag===tag)}
 setAttribute(){}addEventListener(){}removeEventListener(){}
 play(){return Promise.resolve()}
}
const makeTrack=kind=>({id:crypto.randomUUID(),kind,enabled:true,readyState:'live',stop(){this.readyState='ended'}});
class Stream {
 constructor(tracks=[]){this.tracks=[...tracks]}
 getTracks(){return this.tracks}
 getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio')}
 getVideoTracks(){return this.tracks.filter(t=>t.kind==='video')}
 addTrack(t){this.tracks.push(t)}
 removeTrack(t){this.tracks=this.tracks.filter(v=>v!==t)}
}
const settle=async()=>{for(let i=0;i<40;i++)await Promise.resolve()};
async function check(mode,cameraBeforeOffer=false){
 const elements=new Map(['status','grid','join','controls','mic','camera','flip','hang','notice'].map(id=>[id,new Element('div')]));
 const document={getElementById:id=>elements.get(id)||elements.get('grid').children.find(e=>e.id===id),createElement:tag=>new Element(tag),addEventListener(){}};
 const localStream=new Stream([makeTrack('audio'),...(mode==='video'?[makeTrack('video')]:[])]);
 const peer={userId:'caller',sessionId:'00000000-0000-4000-8000-000000000000',name:'Caller'},calls=[],timers=[],pcs=[];
 let hasOffer=false;
 class PC {
  constructor(){this.signalingState='stable';this.transceivers=[];pcs.push(this)}
  transceiver(kind,track,fromAddTrack=false){const sender={track,streams:[],setStreams(...streams){this.streams=streams},async replaceTrack(t){this.track=t},getParameters(){return {encodings:[{}]}},async setParameters(){}};const t={sender,receiver:{track:makeTrack(kind)},mid:null,direction:'sendrecv',fromAddTrack};this.transceivers.push(t);return t}
  addTrack(track,...streams){const t=this.transceiver(track.kind,track,true);t.sender.setStreams(...streams);return t.sender}
  addTransceiver(value,options){const t=this.transceiver(typeof value==='string'?value:value.kind,typeof value==='string'?null:value);t.direction=options.direction;t.sender.setStreams(...(options.streams||[]));return t}
  getTransceivers(){return this.transceivers}
  getSenders(){return this.transceivers.map(t=>t.sender)}
  async setRemoteDescription(sdp){
   this.remoteDescription=sdp;this.signalingState='have-remote-offer';
   this.unassociatedVideoBeforeOffer=this.transceivers.filter(t=>t.receiver.track.kind==='video'&&t.mid===null&&!t.fromAddTrack).length;
   for(const [index,kind] of ['audio','video'].entries()){
    const existing=this.transceivers.find(t=>t.receiver.track.kind===kind&&t.fromAddTrack&&t.mid===null);
    const t=existing||this.transceiver(kind,null);t.mid=String(index);if(!existing)t.direction='recvonly';
    this.ontrack?.({track:t.receiver.track,streams:[]});
   }
  }
  async createAnswer(){this.answerVideo=this.transceivers.find(t=>t.mid==='1');return {type:'answer',sdp:'answer'}}
  async setLocalDescription(){this.signalingState='stable'}
  async addIceCandidate(){}
  close(){}
 }
 const window={addEventListener(){},ReactNativeWebView:{postMessage(raw){const m=JSON.parse(raw);calls.push(m);if(!m.rpc)return;const result=m.action==='join'?{iceServers:[]}:m.action==='poll'?{ended:false,peers:[peer],signals:hasOffer?[{seq:1,sender:peer.userId,payload:{type:'offer',sdp:'offer',sessionId:peer.sessionId}}]:[]}:{ok:true};queueMicrotask(()=>window.__hmReply(m.rpc,result))}}};
 vm.runInNewContext(script,{window,document,navigator:{mediaDevices:{getUserMedia:async c=>c.audio===false?new Stream([makeTrack('video')]):localStream}},RTCPeerConnection:PC,MediaStream:Stream,crypto,console,setTimeout(fn,ms){const t={fn,ms};timers.push(t);return t},clearTimeout(t){if(t)t.cancelled=true}});
 window.__hmInit({sessionId:'ffffffff-ffff-4fff-8fff-ffffffffffff',mode,name:'Team',autoJoin:true});await settle();
 assert.equal(pcs.length,1);
 if(cameraBeforeOffer)await elements.get('camera').onclick();
 hasOffer=true;await timers.filter(t=>t.ms===300&&!t.cancelled).at(-1).fn();await settle();
 const pc=pcs[0],video=pc.answerVideo;
 assert.equal(pc.unassociatedVideoBeforeOffer,0,'answerer must not create an unassociated video sender before remote offer');
 assert.ok(video,'answer must include the offered video m-line');assert.equal(video.direction,'sendrecv','answerer must accept bidirectional video even when local camera is off');
 assert.equal(video.sender.streams[0],localStream,'the associated sender must carry the local stream identity');
 if(mode==='video'||cameraBeforeOffer)assert.equal(video.sender.track,localStream.getVideoTracks()[0],'answer transmits the existing local camera');
 else {assert.equal(video.sender.track,null);await elements.get('camera').onclick();assert.equal(video.sender.track,localStream.getVideoTracks()[0],'camera upgrade attaches to the negotiated answer sender');}
 assert.ok(calls.some(m=>m.action==='signal'&&m.args.payload.type==='answer'));
 window.__hmStop();await settle();
}
await check('video');await check('audio');await check('audio',true);
console.log('PASS answerer associates local video with the offered transceiver; audio upgrade before/after offer uses the negotiated sender (SDP association modeled).');
