import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual mute component with controlled React state/network adapters.
// This checks race handling and optimistic feedback, not browser geometry.
const values=[],effects=[],pendingEffects=[],requests=[],timers=[];let cursor=0,audioStarts=0;
const react={
 useState(initial){const index=cursor++;if(!(index in values))values[index]=typeof initial==='function'?initial():initial;return [values[index],next=>{values[index]=typeof next==='function'?next(values[index]):next}]},
 useRef(initial){const index=cursor++;if(!(index in values))values[index]={current:initial};return values[index]},
 useEffect(callback,deps){const index=cursor++,previous=effects[index];if(!previous||deps.some((value,i)=>value!==previous.deps[i]))pendingEffects.push(()=>{previous?.cleanup?.();effects[index]={deps,cleanup:callback()}})},
};
const jsx=(type,props)=>({type,props});
class AudioContext {currentTime=0;destination={};createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}createOscillator(){return {frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){audioStarts++},stop(){}}}resume(){return Promise.resolve()}close(){return Promise.resolve()}}
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/chat-mute.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
 exports,require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='lucide-react'?{Bell:'bell',BellOff:'bell-off'}:(()=>{throw Error(name)})(),
 window:{AudioContext,dispatchEvent(){}},CustomEvent:class{},fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve})),setInterval:callback=>(timers.push(callback),timers.length),clearInterval(){},console,
});
const render=()=>{cursor=0;const element=exports.ChatMute({conversationId:'grp_demo',compact:false});while(pendingEffects.length)pendingEffects.shift()();return element};
function button(){const tree=render();return tree.props.children.find(child=>child?.type==='button')}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const reply=async(index,status,data)=>{requests[index].resolve({ok:status>=200&&status<300,json:async()=>data});await settle()};
assert.equal(button().props.disabled,true,'Unknown mute state does not flash an enabled toggle');
await reply(0,200,{mutedIds:[]});assert.equal(button().props['aria-checked'],true);
button().props.onClick();assert.equal(button().props['aria-checked'],false,'Mute renders immediately before server finishes');
button().props.onClick();assert.equal(requests.length,2,'An in-flight write is not duplicated');
await reply(1,503,{error:'Try again'});assert.equal(button().props['aria-checked'],true,'Failed mute restores the prior state');
// A poll started before a write must never overwrite its optimistic state.
timers[0]();assert.equal(requests.length,3);button().props.onClick();assert.equal(button().props['aria-checked'],false);
await reply(2,200,{mutedIds:[]});assert.equal(button().props['aria-checked'],false,'Stale background result cannot unmute a pending write');
await reply(3,200,{mutedIds:['grp_demo']});assert.equal(button().props['aria-checked'],false);
button().props.onClick();assert.equal(button().props['aria-checked'],true,'Unmute is also immediate');assert.equal(audioStarts,1,'Unmute plays confirmation from the user gesture');
await reply(4,200,{mutedIds:[]});assert.equal(button().props['aria-checked'],true);
timers[0]();await reply(5,200,{mutedIds:['grp_demo']});assert.equal(button().props['aria-checked'],false,'Subsequent polls still reconcile changes from other devices');
console.log('PASS chat mute: optimistic switch, failed-save rollback, stale poll isolation, single pending mutation, unmute sound and subsequent synchronization.');
