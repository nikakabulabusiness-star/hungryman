import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(filename,imports={},extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:name=>{if(!(name in imports))throw Error('Unexpected import '+name);return imports[name]},...extra});return exports}
const {workServiceWorker}=load('lib/work-service-worker.ts'),{isWorkPwaHost,WORK_PWA_MANIFEST}=load('lib/pwa-policy.ts');
assert.equal(WORK_PWA_MANIFEST.start_url,'/work');assert.equal(WORK_PWA_MANIFEST.scope,'/');assert.equal(WORK_PWA_MANIFEST.display,'standalone');
for(const host of ['work.hungryman.ge','hungryman-applications-test.hungryman.chatgpt.site','localhost'])assert.equal(isWorkPwaHost(host),true);
for(const host of ['team.hungryman.ge','careers.hungryman.ge','hungryman.ge','work.hungryman.ge.evil.example'])assert.equal(isWorkPwaHost(host),false);

const origin='https://work.hungryman.ge',stores=new Map(),handlers={},imports=[];
const key=value=>typeof value==='string'?new URL(value,origin).href:value.url;
class Cache{entries=new Map();async addAll(paths){for(const path of paths)this.entries.set(key(path),new Response('offline-shell'))}async match(req){return this.entries.get(key(req))?.clone()}async put(req,response){this.entries.set(key(req),response.clone())}async keys(){return [...this.entries.keys()].map(url=>({url}))}async delete(req){return this.entries.delete(key(req))}}
const caches={async open(name){if(!stores.has(name))stores.set(name,new Cache());return stores.get(name)},async keys(){return [...stores.keys()]},async delete(name){return stores.delete(name)},async match(req){for(const cache of stores.values()){const response=await cache.match(req);if(response)return response}}};
let skips=0,claims=0,network=0,fail=false,policy='public, max-age=31536000, immutable';
const self={location:{origin},addEventListener(name,handler){handlers[name]=handler},async skipWaiting(){skips++},clients:{async claim(){claims++}}};
vm.runInNewContext(workServiceWorker('new-release'),{self,caches,URL,Response,importScripts:path=>imports.push(path),fetch:async(req,options)=>{network++;if(fail)throw Error('offline');const response=new Response(req.mode==='navigate'?'private page '+network:'asset',{headers:{'cache-control':policy}});Object.defineProperty(response,'type',{value:'basic'});if(req.mode==='navigate')assert.equal(options.cache,'no-store');return response}});
assert.deepEqual(imports,['/work/web-push-worker.js']);
async function dispatch(name,extra={}){let pending;handlers[name]({...extra,waitUntil:promise=>pending=promise,respondWith:promise=>pending=promise});return pending?{handled:true,response:await pending}:{handled:false}}
const request=(pathname,extra={})=>({url:pathname.startsWith('https:')?pathname:origin+pathname,method:'GET',mode:'cors',headers:new Headers(),...extra});
await dispatch('install');assert.equal(skips,0,'install never interrupts a running app');
await caches.open('other-product-private');await caches.open('hungryman-work-public-ancient');const previous=await caches.open('hungryman-work-public-previous');await previous.put(request('/_next/static/old.js'),new Response('old asset'));
await dispatch('activate');assert.equal(claims,1);assert.equal(stores.has('other-product-private'),true);assert.equal(stores.has('hungryman-work-public-ancient'),false);assert.equal(stores.has('hungryman-work-public-previous'),true);
const old=await dispatch('fetch',{request:request('/_next/static/old.js')});assert.equal(await old.response.text(),'old asset','previous release assets remain available to existing tabs');
for(const req of [request('/api/mobile/me'),request('/api/chat/messages'),request('/team'),request('/api/files/secret'),request('/_next/static/app.js?private=1'),request('/_next/static/app.js',{headers:new Headers({Authorization:'Bearer secret'})}),request('/_next/static/app.js',{headers:new Headers({RSC:'1'})}),request('/api/chat',{method:'POST'}),request('https://other.example/_next/static/app.js')])assert.equal((await dispatch('fetch',{request:req})).handled,false,'private/API/foreign requests bypass the cache: '+req.url);
const a=await dispatch('fetch',{request:request('/chat',{mode:'navigate'})}),b=await dispatch('fetch',{request:request('/chat',{mode:'navigate'})});assert.notEqual(await a.response.text(),await b.response.text(),'authenticated navigation always reaches network');
for(const cache of stores.values())assert.equal(await cache.match('/chat'),undefined);
fail=true;const offline=await dispatch('fetch',{request:request('/chat',{mode:'navigate'})});assert.equal(await offline.response.text(),'offline-shell');fail=false;
const before=network;await dispatch('fetch',{request:request('/_next/static/app.hash.js')});await dispatch('fetch',{request:request('/_next/static/app.hash.js')});assert.equal(network,before+1,'public immutable assets are reusable');
for(const privatePolicy of ['private, max-age=0','no-store']){policy=privatePolicy;const start=network;await dispatch('fetch',{request:request('/_next/static/'+privatePolicy.slice(0,7)+'.js')});await dispatch('fetch',{request:request('/_next/static/'+privatePolicy.slice(0,7)+'.js')});assert.equal(network,start+2,'private/no-store response cannot enter cache')}
policy='public';for(let i=0;i<125;i++)await dispatch('fetch',{request:request('/_next/static/chunk'+i+'.js')});assert.ok((await stores.get('hungryman-work-public-new-release').keys()).length<=120);assert.ok(await stores.get('hungryman-work-public-new-release').match('/work/pwa/offline.html'));
await dispatch('message',{data:{type:'HMW_APPLY_UPDATE'},source:{url:'https://evil.example/'}});assert.equal(skips,0);await dispatch('message',{data:{type:'HMW_APPLY_UPDATE'},source:{url:origin+'/work'}});assert.equal(skips,1);

// Exercise the actual client update handlers: a waiting worker must not end a call
// and another tab activating a release must never reload this tab.
const events=new Map(),swEvents=new Map(),registrationEvents=new Map(),installEvents=new Map(),effects=[],prompts=[],posted=[];let reloads=0,active=false,serverVersion='old';
const add=(map,name,handler)=>map.set(name,handler),remove=(map,name)=>map.delete(name);
const waitingWorker={postMessage:message=>posted.push(message)};
const registration={waiting:waitingWorker,installing:{state:'installed',addEventListener:(...args)=>add(installEvents,...args)},async update(){},addEventListener:(...args)=>add(registrationEvents,...args),removeEventListener:(...args)=>remove(registrationEvents,...args)};
const navigator={onLine:true,userAgent:'test',platform:'test',maxTouchPoints:0,serviceWorker:{controller:null,async register(url,options){assert.equal(url,'/sw.js');assert.equal(options.updateViaCache,'none');return registration},addEventListener:(...args)=>add(swEvents,...args),removeEventListener:(...args)=>remove(swEvents,...args)}};
const document={visibilityState:'visible',querySelector:()=>active?{}:null,addEventListener:(...args)=>add(events,...args),removeEventListener:(...args)=>remove(events,...args)};
const location={hostname:'work.hungryman.ge',reload(){reloads++}};
const window={isSecureContext:true,location,confirm:text=>{prompts.push(text);return true},addEventListener:(...args)=>add(events,...args),removeEventListener:(...args)=>remove(events,...args)};
const jsx=(type,props)=>({type,props});
const runtime=load('components/pwa-runtime.tsx',{'react':{useEffect:fn=>effects.push(fn),useSyncExternalStore:(_subscribe,get)=>get()},'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':{Download:'download',RefreshCw:'refresh',WifiOff:'offline',Check:'check',Share2:'share',X:'close'},'@/lib/pwa-policy':{isWorkPwaHost},'@/lib/pwa-release.json':{version:'old'},'./pwa-runtime.css':{}},{window,navigator,document,location,matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),setInterval:()=>1,clearInterval(){},fetch:async()=>({ok:true,json:async()=>({version:serverVersion})})});
runtime.default();const cleanup=effects[0]();for(let i=0;i<20;i++)await Promise.resolve();
assert.equal(runtime.default(),null,'first registration with a transient waiting worker never announces an update');
registrationEvents.get('updatefound')();installEvents.get('statechange')();assert.equal(runtime.default(),null,'first installed state without an old controller is not an update');
navigator.serviceWorker.controller={};installEvents.get('statechange')();assert.ok(runtime.default(),'a waiting release on an already controlled page announces an update');
runtime.default().props.children.find(child=>child?.props?.['aria-label']==='მოგვიანებით განახლება').props.onClick();assert.equal(runtime.default(),null);
navigator.serviceWorker.controller=null;registration.waiting=null;events.get('online')();for(let i=0;i<20;i++)await Promise.resolve();assert.equal(runtime.default(),null,'same release leaves the update notice dismissed');
serverVersion='new';events.get('online')();for(let i=0;i<20;i++)await Promise.resolve();assert.ok(runtime.default(),'a real server release mismatch still announces an update without a controller');
navigator.serviceWorker.controller={};registration.waiting=waitingWorker;
assert.equal(reloads,0);swEvents.get('controllerchange')();assert.equal(reloads,0,'unrelated controller change never reloads');
function updateButton(){return runtime.default().props.children.find(child=>child?.type==='button'&&child.props.disabled!==undefined)}
active=true;await updateButton().props.onClick();assert.equal(posted.length,0);assert.equal(prompts.length,0,'active call/voice recording is protected before confirmation');
active=false;await updateButton().props.onClick();assert.equal(prompts.length,1);assert.equal(posted[0].type,'HMW_APPLY_UPDATE');assert.equal(reloads,0);swEvents.get('controllerchange')();assert.equal(reloads,1,'only confirmed Apply reloads after activation');
swEvents.get('controllerchange')();assert.equal(reloads,1,'no later automatic reload');cleanup();
console.log('PWA: cache isolation, offline fallback, host boundaries, bounded release assets and safe call/update lifecycle passed');
