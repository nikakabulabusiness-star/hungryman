/** No personal HTML, API responses, RSC requests, files or POSTs enter this cache. */
export function workServiceWorker(version:string){return `
'use strict';
importScripts('/work/web-push-worker.js');
const PREFIX='hungryman-work-public-', CACHE=PREFIX+${JSON.stringify(version)};
const OFFLINE='/work/pwa/offline.html';
const SHELL=[OFFLINE,'/work/pwa/icon-192.png','/work/pwa/icon-512.png'];
const STATIC=/^\\/_next\\/static\\/(?:[^?#]+)\\.(?:js|css|woff2?|ttf|png|webp|svg)$/;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{try{await self.registration?.navigationPreload?.enable()}catch{}const previous=(await caches.keys()).filter(key=>key.startsWith(PREFIX)&&key!==CACHE);for(const key of previous.slice(0,-1))await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type==='HMW_APPLY_UPDATE'&&event.source?.url&&new URL(event.source.url).origin===self.location.origin)event.waitUntil(self.skipWaiting())});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||req.headers.has('Authorization'))return;
 if(req.mode==='navigate'){
  // Navigation preload starts the page request while the worker boots, so tab and
  // page switches do not wait for service-worker startup. Pages still always come
  // from the network; only the generic offline shell is cached.
  const preload=event.preloadResponse;if(preload&&event.waitUntil)event.waitUntil(Promise.resolve(preload).catch(()=>{}));
  event.respondWith((async()=>{try{const preloaded=preload&&await preload;return preloaded||await fetch(req,{cache:'no-store'})}catch{return await caches.match(OFFLINE)||new Response('ინტერნეტი მიუწვდომელია',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})}})());return;
 }
 if(url.search||req.headers.has('RSC')||(!STATIC.test(url.pathname)&&!SHELL.includes(url.pathname)))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);let cached=await cache.match(req);if(!cached&&STATIC.test(url.pathname))for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE){cached=await (await caches.open(key)).match(req);if(cached)break}if(cached)return cached;const response=await fetch(req);const policy=response.headers.get('cache-control')||'';if(response.ok&&response.type==='basic'&&!response.redirected&&!/private|no-store/i.test(policy)){await cache.put(req,response.clone());const keys=await cache.keys();if(keys.length>120)for(const old of keys.filter(k=>!SHELL.includes(new URL(k.url).pathname)).slice(0,keys.length-120))await cache.delete(old)}return response})());
});
`}
