import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('public/work/call.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const embedded=fs.readFileSync('mobile/src/lib/call-document.ts','utf8').split('export const CALL_DOCUMENT = ')[1].trim().replace(/;$/,'');
assert.equal(JSON.parse(embedded),html,'shipped media engine must match tested engine');
const native=fs.readFileSync('mobile/src/app/call/[id].tsx','utf8');
assert.ok(native.includes('html:CALL_DOCUMENT'));
assert.ok(!native.includes("source={{uri:"),'call startup must not depend on a remote HTML page');
class E{constructor(){this.children=[];this.style={};this.classList={toggle(){},remove(){}}}append(...x){this.children.push(...x)}replaceChildren(){this.children=[]}setAttribute(){}addEventListener(){}removeEventListener(){}}
function harness({deferMedia=false,deferJoin=false}={}){
 const elements=new Map(['status','grid','join','controls','mic','camera','flip','hang','notice'].map(id=>[id,new E()]));
 const messages=[],timers=[],constraints=[];let resolveMedia,joinRequest,pollError;
 const track={kind:'audio',stopped:false,stop(){this.stopped=true}},stream={getTracks:()=>[track],getAudioTracks:()=>[track],getVideoTracks:()=>[]};
 const window={addEventListener(){},ReactNativeWebView:{postMessage(raw){const m=JSON.parse(raw);messages.push(m);if(!m.rpc)return;if(m.action==='join'&&deferJoin){joinRequest=m;return}queueMicrotask(()=>window.__hmReply(m.rpc,m.action==='join'?{iceServers:[],relayAvailable:false}:m.action==='poll'?{peers:[],signals:[],ended:false}:{ok:true},m.action==='poll'&&pollError?'Session expired':null,m.action==='poll'?pollError:0))}}};
 vm.runInNewContext(script,{window,document:{getElementById:id=>elements.get(id),createElement:()=>new E(),addEventListener(){}},navigator:{mediaDevices:{getUserMedia:async c=>{constraints.push(c);return deferMedia?new Promise(r=>resolveMedia=r):stream}}},crypto,console,setTimeout(fn,ms){const t={fn,ms};timers.push(t);return t},clearTimeout(t){if(t)t.cancelled=true}});
 const init=()=>window.__hmInit({sessionId:'test-session',mode:'audio',name:'Team',autoJoin:true});
 return {window,elements,messages,timers,constraints,track,init,resolveMedia:()=>resolveMedia(stream),resolveJoin:()=>window.__hmReply(joinRequest.rpc,{iceServers:[]}),expire:()=>pollError=409};
}
const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
const h=harness();assert.equal(h.messages[0].ready,true);
h.timers.find(t=>t.ms===400).fn();assert.equal(h.messages.filter(m=>m.ready).length,2,'bridge handshake retries if native missed first message');
h.init();h.init();await settle();assert.equal(h.constraints.length,1,'duplicate handshake must not acquire devices twice');assert.equal(h.constraints[0].video,false,'audio call must not request camera');assert.equal(h.messages.filter(m=>m.action==='join').length,1);assert.equal(h.elements.get('join').hidden,true);
h.expire();await h.timers.filter(t=>t.ms===300&&!t.cancelled).at(-1).fn();await settle();assert.equal(h.track.stopped,true,'expired server session must release microphone');assert.match(h.elements.get('status').textContent,/expired/);
const pending=harness({deferMedia:true});pending.init();pending.window.__hmStop();pending.resolveMedia();await settle();assert.equal(pending.track.stopped,true);assert.equal(pending.messages.some(m=>m.action==='join'),false,'backgrounded call must not join when permission resolves later');
const joining=harness({deferJoin:true});joining.init();await settle();joining.window.__hmStop();joining.resolveJoin();await settle();assert.equal(joining.track.stopped,true);assert.ok(joining.messages.filter(m=>m.action==='leave').length>=2,'late server join is cleaned up again');
console.log('PASS: bundled startup, retrying handshake, automatic audio join, no duplicate capture, revoked session cleanup and background races.');
