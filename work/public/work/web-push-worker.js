/* Imported by the root worker. Never cache notifications or account responses. */
self.addEventListener('push',event=>{
 let data;try{data=event.data?.json()}catch{return}
 if(!data||data.title!=='Hungryman Work'||typeof data.recipientUserId!=='string')return;
 const body=data.body==='შემომავალი ზარი — გასახსნელად დააჭირე.'?data.body:'სამუშაო სივრცეში ახალი შეტყობინებაა.';
 event.waitUntil(self.registration.showNotification('Hungryman Work',{body,icon:'/work/pwa/icon-192.png',badge:'/work/pwa/icon-192.png',tag:String(data.tag||'hmw').slice(0,200),data:{href:hmwPushHref(data.href),recipientUserId:data.recipientUserId}}));
});
function hmwPushHref(value){try{const url=new URL(value,self.location.origin);return url.origin===self.location.origin&&/^\/(work|chat|shoots|team|admin)(\/|\?|#|$)/.test(url.pathname+url.search)?url.pathname+url.search+url.hash:'/work'}catch{return '/work'}}
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{
  let href='/work';try{const r=await fetch('/api/mobile/me',{credentials:'include',cache:'no-store'});const me=await r.json();if(r.ok&&me.user?.userId===event.notification.data?.recipientUserId)href=hmwPushHref(event.notification.data.href)}catch{}
  const url=new URL(href,self.location.origin).href;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(w=>{try{return new URL(w.url).origin===self.location.origin}catch{return false}});
  if(existing){await existing.navigate(url);await existing.focus()}else await self.clients.openWindow(url);
 })());
});
self.addEventListener('message',event=>{if(event.data?.type==='HMW_PUSH_LOGOUT')event.waitUntil((async()=>{for(const n of await self.registration.getNotifications())n.close();const subscription=await self.registration.pushManager.getSubscription();if(subscription)await subscription.unsubscribe()})())});
