import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let Processor;const packets=[];
class Base{constructor(){this.port={postMessage:data=>packets.push(data),onmessage:null}}}
vm.runInNewContext(fs.readFileSync('public/work/voice-processor.js','utf8'),{AudioWorkletProcessor:Base,sampleRate:48000,Float32Array,registerProcessor:(name,type)=>{assert.equal(name,'hmw-voice');Processor=type}});
const recorder=new Processor();for(let i=0;i<375;i++)recorder.process([[new Float32Array(128).fill(.25)]]);recorder.port.onmessage({data:'stop'});
const chunks=packets.filter(p=>p.samples).map(p=>p.samples),count=chunks.reduce((n,c)=>n+c.length,0);assert.equal(count,16000);assert.equal(packets.at(-1).done,true);assert.equal(recorder.process([[new Float32Array(128)]]),false,'Stopped microphones do not emit more samples');
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/voice-wav.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Blob,ArrayBuffer,DataView});
const blob=exports.wav(chunks,count),buffer=await blob.arrayBuffer(),view=new DataView(buffer);assert.equal(blob.type,'audio/wav');assert.equal(buffer.byteLength,32044);assert.equal(view.getUint16(22,true),1);assert.equal(view.getUint32(24,true),16000);assert.equal(view.getUint16(34,true),16);assert.equal(view.getInt16(44,true),8191);assert.equal(new TextDecoder().decode(buffer.slice(0,4)),'RIFF');
// A five minute recording stops itself and remains under the 10 MB upload ceiling.
packets.length=0;const long=new Processor();for(let i=0;i<112501;i++){if(!long.process([[new Float32Array(128)]]))break}assert.equal(packets.at(-1).done,true);assert.equal(packets.filter(p=>p.samples).reduce((n,p)=>n+p.samples.length,0),4800000);
console.log('PASS: microphone downsampling, stop cleanup, portable WAV encoding and bounded five-minute capture.');
