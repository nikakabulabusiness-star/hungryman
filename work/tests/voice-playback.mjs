import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('mobile/src/lib/voice-playback.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,setTimeout,clearTimeout,Error});
const {loadAudio,audioExtension}=exports;
function player(){const listeners=new Set();return {listeners,replaced:false,addListener(e,fn){assert.equal(e,'playbackStatusUpdate');listeners.add(fn);return {remove:()=>listeners.delete(fn)}},replace(source){this.replaced=source.uri;assert.ok(listeners.size,'Subscribe before replacing native source')},emit(s){for(const fn of [...listeners])fn(s)}}}
const p=player(),signal=new AbortController();let settled=false;const task=loadAudio(p,'file:///voice.m4a',signal.signal).then(()=>{settled=true});p.emit({isLoaded:false});await Promise.resolve();assert.equal(settled,false);p.emit({isLoaded:true});await task;assert.equal(p.listeners.size,0);
const bad=player(),failure=loadAudio(bad,'file:///voice.m4a',signal.signal);bad.emit({isLoaded:false,error:'decode failed'});await assert.rejects(failure);assert.equal(bad.listeners.size,0);
const hanging=player();await assert.rejects(loadAudio(hanging,'file:///voice.m4a',signal.signal,5));assert.equal(hanging.listeners.size,0);
const aborter=new AbortController(),cancelled=player(),c=loadAudio(cancelled,'file:///voice.m4a',aborter.signal);aborter.abort();await assert.rejects(c);assert.equal(cancelled.listeners.size,0);
const cancelledBefore=player();await assert.rejects(loadAudio(cancelledBefore,'file:///voice.m4a',aborter.signal));assert.equal(cancelledBefore.replaced,false);
const mp4=new Uint8Array(64);mp4.set(new TextEncoder().encode('ftyp'),4);assert.equal(audioExtension(mp4),'m4a');const wav=new Uint8Array(64);wav.set(new TextEncoder().encode('RIFF'));wav.set(new TextEncoder().encode('WAVE'),8);assert.equal(audioExtension(wav),'wav');for(const bytes of [new Uint8Array(),new TextEncoder().encode('<html>access denied</html>'),new TextEncoder().encode('{"error":"expired"}')])assert.throws(()=>audioExtension(bytes));
// Exercise authenticated downloads without a native decoder or filesystem.
let response,options,created=0,deleted=0;const files=[];
class FileMock{constructor(root,name){this.uri=root+name;this.exists=false;files.push(this)}create(){this.exists=true;created++}write(bytes){this.bytes=bytes}delete(){this.exists=false;deleted++}}
const downloadExports={};const require=name=>name==='expo-file-system'?{File:FileMock,Paths:{cache:'file:///private/'}}:name==='expo/fetch'?{fetch:async(url,init)=>{assert.equal(url,'https://test.example/api/chat/attachments?id=voice');options=init;return response}}:name==='expo-crypto'?{randomUUID:()=>crypto.randomUUID()}:name==='./api'?{chatImageSource:()=>({uri:'https://test.example/api/chat/attachments?id=voice',headers:{Authorization:'Bearer test-token'}})}:name==='./voice-playback'?exports:null;
vm.runInNewContext(ts.transpileModule(fs.readFileSync('mobile/src/lib/voice-file.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:downloadExports,require,AbortController,setTimeout,clearTimeout,Uint8Array,Error});
response=new Response(mp4,{headers:{'Content-Type':'audio/mp4'}});const file=await downloadExports.downloadVoice('voice',signal.signal);assert.match(file.uri,/\.m4a$/);assert.equal(options.headers.Authorization,'Bearer test-token');assert.deepEqual(file.bytes,mp4);assert.equal(created,1);
response=new Response('Unauthorized',{status:401});await assert.rejects(downloadExports.downloadVoice('voice',signal.signal));
response=new Response('<html>proxy login</html>');await assert.rejects(downloadExports.downloadVoice('voice',signal.signal));
response=new Response(mp4,{headers:{'Content-Length':String(20*1024*1024)}});await assert.rejects(downloadExports.downloadVoice('voice',signal.signal));assert.equal(created,1,'Invalid responses never reach the decoder cache');file.delete();assert.equal(deleted,1);
console.log('PASS: voice waits for decoder readiness; errors, timeouts and cancellation clean listeners; downloads preserve auth, validate containers and reject invalid bodies.');
