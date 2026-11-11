import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function compile(file){return ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText}
const exports={};vm.runInNewContext(compile('lib/work-data-cache.ts'),{exports,fetch,AbortController,setTimeout,clearTimeout,Response,Error,Map,Set,Date,JSON});
const {createWorkDataCache,cacheableWorkPath,WorkRequestError}=exports;
let now=100,calls=0,finish;
const cache=createWorkDataCache(async()=>{calls++;return await new Promise(resolve=>{finish=resolve})},()=>now);
cache.setAccount('alice');const one=cache.request('/api/shoots'),two=cache.request('/api/shoots');assert.equal(one,two);await Promise.resolve();assert.equal(calls,1);finish(Response.json({shoots:[{title:'A'}]}));await one;assert.equal(cache.read('/api/shoots').shoots[0].title,'A');
now+=60001;assert.equal(cache.read('/api/shoots'),null);
const old=cache.request('/api/shoots');await Promise.resolve();cache.setAccount('bob');finish(Response.json({shoots:[{title:'Alice private'}]}));await assert.rejects(old);assert.equal(cache.read('/api/shoots'),null,'late account A response cannot populate B');
const logoutPending=cache.request('/api/shoots');await Promise.resolve();cache.setAccount(null);finish(Response.json({shoots:[{title:'B'}]}));await assert.rejects(logoutPending);assert.equal(cache.read('/api/shoots'),null);
for(const path of ['/api/team/cabinet','/api/time-off','/api/admin/users','/api/mobile/me','/api/chat/messages?conversationId=private','/api/shoots?secret=1'])assert.equal(cacheableWorkPath(path),false);
let response=Response.json({shoots:[1]});const permissions=createWorkDataCache(async()=>response.clone());permissions.setAccount('a');await permissions.request('/api/shoots');assert.ok(permissions.read('/api/shoots'));response=Response.json({error:'denied'},{status:403});await assert.rejects(permissions.request('/api/shoots'),e=>e instanceof WorkRequestError&&e.status===403);assert.equal(permissions.read('/api/shoots'),null);
let resets=0;permissions.subscribe(()=>resets++);response=Response.json({error:'logged out'},{status:401});await assert.rejects(permissions.request('/api/shoots'));const afterFirst=resets;await assert.rejects(permissions.request('/api/shoots'));assert.equal(resets,afterFirst,'logged-out requests do not create revalidation loops');
const mutations=createWorkDataCache(async()=>Response.json({ok:true}));mutations.setAccount('a');await mutations.request('/api/shoots');assert.ok(mutations.read('/api/shoots'));await mutations.request('/api/time-off','POST',{});assert.equal(mutations.read('/api/shoots'),null,'mutations invalidate earlier snapshots');
// One successful write invalidates older reads without cancelling an unrelated write.
const finishes=new Map();const concurrent=createWorkDataCache(async(path,options)=>new Promise(resolve=>finishes.set(path,{resolve,signal:options.signal})));concurrent.setAccount('writer');
const writeA=concurrent.request('/api/time-off','POST',{id:'a'}),writeB=concurrent.request('/api/calendar/notes','PUT',{id:'b'}),staleRead=concurrent.request('/api/shoots');const oldReadRejected=assert.rejects(staleRead);await Promise.resolve();
finishes.get('/api/time-off').resolve(Response.json({ok:'a'}));assert.equal((await writeA).ok,'a');assert.equal(finishes.get('/api/calendar/notes').signal.aborted,false,'sibling write remains live');assert.equal(finishes.get('/api/shoots').signal.aborted,true,'older read cancelled');
finishes.get('/api/calendar/notes').resolve(Response.json({ok:'b'}));assert.equal((await writeB).ok,'b');finishes.get('/api/shoots').resolve(Response.json({shoots:['old']}));await oldReadRejected;assert.equal(concurrent.read('/api/shoots'),null);
// Exercise the actual hook's completion-driven polling and refresh deduplication.
let resolveHook,hookCalls=0;const hookCache=createWorkDataCache(async()=>{hookCalls++;return new Promise(resolve=>{resolveHook=resolve})});hookCache.setAccount('hook');
const effects=[],states=[],timers=new Map(),events=new Map();let timerId=0;const doc={visibilityState:'visible',addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)};
const hookExports={};vm.runInNewContext(compile('components/cabinet-panel.tsx'),{exports:hookExports,require:name=>name==='react'?{useCallback:f=>f,useState:initial=>[typeof initial==='function'?initial():initial,f=>states.push(f)],useRef:value=>({current:value}),useEffect:f=>effects.push(f),useSyncExternalStore:(_,get)=>get()}:name==='@/lib/work-data-cache'?{fetchWorkData:hookCache.request,readWorkData:hookCache.read,workDataEpoch:hookCache.epoch,subscribeWorkData:hookCache.subscribe,WorkRequestError}: {},document:doc,window:{addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)},setTimeout:f=>{timers.set(++timerId,f);return timerId},clearTimeout:id=>timers.delete(id),Promise});
const hook=hookExports.useWorkData('/api/shoots',15000),cleanup=effects[0]();const first=hook.refresh(),same=hook.refresh();assert.equal(first,same);await Promise.resolve();await Promise.resolve();assert.equal(hookCalls,1);assert.equal(timers.size,0,'next poll only scheduled after completion');resolveHook(Response.json({shoots:[]}));await first;await Promise.resolve();assert.equal(timers.size,1);doc.visibilityState='hidden';events.get('visibilitychange')();assert.equal(hookCalls,1);cleanup();assert.equal(timers.size,0);
// A -> B -> A must not let an earlier A response or error overwrite the latest A.
async function rapidPathChange(lateError){
 const refs=[],stateSlots=[],queued=[];let refCursor=0,stateCursor=0,effectList=[],dispose;
 const react={useCallback:f=>f,useState:initial=>{const i=stateCursor++;if(!(i in stateSlots))stateSlots[i]=typeof initial==='function'?initial():initial;return [stateSlots[i],next=>{stateSlots[i]=typeof next==='function'?next(stateSlots[i]):next}]},useRef:initial=>{const i=refCursor++;return refs[i]??(refs[i]={current:initial})},useEffect:f=>effectList.push(f),useSyncExternalStore:(_,get)=>get()};
 const context={exports:{},require:name=>name==='react'?react:name==='@/lib/work-data-cache'?{fetchWorkData:path=>new Promise((resolve,reject)=>queued.push({path,resolve,reject})),readWorkData:()=>null,workDataEpoch:()=>0,subscribeWorkData:()=>()=>{},WorkRequestError}:{},document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},window:{addEventListener(){},removeEventListener(){}},setTimeout:()=>1,clearTimeout(){},Promise};
 vm.runInNewContext(compile('components/cabinet-panel.tsx'),context);
 function render(path){dispose?.();refCursor=0;stateCursor=0;effectList=[];const hook=context.exports.useWorkData(path);dispose=effectList[0]();return hook.refresh()}
 const a1=render('/api/team/cabinet?month=2026-10');await Promise.resolve();
 const b=render('/api/team/cabinet?month=2026-11');await Promise.resolve();
 const a2=render('/api/team/cabinet?month=2026-10');await Promise.resolve();assert.equal(queued.length,3);
 queued[2].resolve({balance:'fresh'});await a2;assert.equal(stateSlots[0].data.balance,'fresh');
 if(lateError)queued[0].reject(new Error('old failure'));else queued[0].resolve({balance:'old'});
 queued[1].resolve({balance:'other month'});await Promise.all([a1,b]);assert.equal(stateSlots[0].data.balance,'fresh');assert.equal(stateSlots[0].error,'');dispose();
}
await rapidPathChange(false);await rapidPathChange(true);
console.log('PASS work display cache: account/logout isolation, late-response rejection, expiry, sensitive-route exclusion, denial/mutation clearing, request deduplication and hidden/completion-driven polling');
