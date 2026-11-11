import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const cache={},events={};let now=100;
vm.runInNewContext(compile('app/chat/chat-memory.ts'),{exports:cache,Date:{now:()=>now},window:{addEventListener:(name,fn)=>events[name]=fn}});
cache.writeChatMemory('alice','thread',{text:'private'});
assert.equal(cache.readChatMemory('alice','thread').text,'private');
assert.equal(cache.readChatMemory('bob','thread'),undefined,'account scopes never share chat');
now+=60001;assert.equal(cache.readChatMemory('alice','thread'),undefined,'snapshots expire');
cache.writeChatMemory('alice','a',{text:'one'});cache.writeChatMemory('bob','b',{text:'two'});cache.clearChatMemory('alice');assert.equal(cache.readChatMemory('alice','a'),undefined);assert.equal(cache.readChatMemory('bob','b').text,'two');
events['hmw:session-ended']();assert.equal(cache.readChatMemory('bob','b'),undefined);
for(let i=0;i<30;i++)cache.writeChatMemory('alice','thread'+i,{i});assert.equal(cache.readChatMemory('alice','thread0'),undefined);assert.equal(cache.readChatMemory('alice','thread29').i,29);events.pagehide();assert.equal(cache.readChatMemory('alice','thread29'),undefined);

function harness({active=true,status=200,seed}={}){
 const exports={},timers=[],listeners={};let state,cleanup,resolve,requests=0,lastSignal;
 if(seed)cache.writeChatMemory('alice','/threads',seed);
 const react={useRef:value=>({current:value}),useState:init=>{state=typeof init==='function'?init():init;return [state,next=>state=typeof next==='function'?next(state):next]},useCallback:fn=>fn,useEffect:fn=>cleanup=fn()};
 vm.runInNewContext(compile('app/chat/use-chat-data.ts'),{exports,require:name=>name==='react'?react:cache,AbortController,document:{visibilityState:'visible',addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name]},setTimeout(fn,ms){const t={fn,ms};timers.push(t);return t},clearTimeout:t=>{if(t)t.cancelled=true},fetch:async(_,options)=>{requests++;lastSignal=options.signal;return await new Promise(r=>resolve=()=>r({ok:status===200,status,json:async()=>status===200?{threads:['new']}:{error:'revoked'}}))}});
 const hook=exports.useChatData('alice','/threads',5000,active);
 return {hook,get state(){return state},get requests(){return requests},get signal(){return lastSignal},timers,resolve:()=>resolve(),cleanup:()=>cleanup()};
}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
const h=harness({seed:{threads:['cached']}});assert.equal(h.hook.data.threads[0],'cached','warm list is rendered before fetch');
void h.hook.refresh();void h.hook.refresh();assert.equal(h.requests,1,'concurrent refreshes share one pending request');assert.equal(h.timers.some(t=>t.ms===5000),false,'poll timer waits for completion');h.resolve();await settle();assert.equal(h.state.data.threads[0],'new');assert.equal(h.timers.some(t=>t.ms===5000),true);h.cleanup();
const revoked=harness({status:403});revoked.resolve();await settle();assert.equal(revoked.state.data,null);assert.equal(cache.readChatMemory('alice','/threads'),undefined,'denied auth purges cached data');revoked.cleanup();
const hidden=harness({active:false});assert.equal(hidden.requests,0,'hidden dock does not fetch');hidden.cleanup();
const abandoned=harness();abandoned.cleanup();assert.equal(abandoned.signal.aborted,true);abandoned.resolve();await settle();assert.equal(cache.readChatMemory('alice','/threads'),undefined,'late requests cannot repopulate cache after unmount');
console.log('PASS chat memory account isolation, TTL/size limits, purge, immediate warm list, request dedup, hidden dock pause and late-response cancellation.');
