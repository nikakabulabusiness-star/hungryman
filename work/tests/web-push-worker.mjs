import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const handlers={},shown=[],opened=[],navigated=[],closed=[];let recipient='alice',windows=[],unsubscribed=0;
const self={location:{origin:'https://work.hungryman.ge'},addEventListener:(type,fn)=>handlers[type]=fn,registration:{showNotification:async(title,options)=>shown.push({title,...options}),getNotifications:async()=>[{close:()=>closed.push('existing')}],pushManager:{getSubscription:async()=>({unsubscribe:async()=>unsubscribed++})}},clients:{matchAll:async()=>windows,openWindow:async url=>opened.push(url)}};
vm.runInNewContext(fs.readFileSync('public/work/web-push-worker.js','utf8'),{self,URL,fetch:async()=>Response.json({user:{userId:recipient}})});
async function push(data){let waiting;handlers.push({data:{json:()=>data},waitUntil:task=>waiting=task});await waiting}
async function click(data){let waiting;handlers.notificationclick({notification:{data,close:()=>closed.push('clicked')},waitUntil:task=>waiting=task});await waiting}
await push({title:'Hungryman Work',body:'Private message from Alice: password123',recipientUserId:'alice',href:'/chat?conversationId=dm_test',tag:'message:1'});
assert.equal(shown.length,1);assert.equal(shown[0].body,'სამუშაო სივრცეში ახალი შეტყობინებაა.');assert.equal(shown[0].icon,'/work/pwa/icon-192.png');assert.equal(shown[0].data.href,'/chat?conversationId=dm_test');assert.ok(!JSON.stringify(shown).includes('password123'));
await push({title:'Hungryman Work',body:'შემომავალი ზარი — გასახსნელად დააჭირე.',recipientUserId:'alice',href:'https://evil.example/admin'});assert.equal(shown[1].data.href,'/work');assert.equal(shown[1].body,'შემომავალი ზარი — გასახსნელად დააჭირე.');
await push({title:'Fake',recipientUserId:'alice'});await push({title:'Hungryman Work'});assert.equal(shown.length,2);
await click(shown[0].data);assert.equal(opened.pop(),'https://work.hungryman.ge/chat?conversationId=dm_test');
recipient='bob';await click(shown[0].data);assert.equal(opened.pop(),'https://work.hungryman.ge/work','Switched account cannot navigate another user notification');
recipient='alice';for(const href of ['https://evil.example/chat','//evil.example/team','javascript:alert(1)','/api/admin/delete','/teamwork','/team/../../api/auth/logout']){await click({recipientUserId:'alice',href});assert.equal(opened.pop(),'https://work.hungryman.ge/work')}
windows=[{url:'https://other.example/chat',navigate:async()=>assert.fail('Foreign window touched')},{url:'https://work.hungryman.ge/work',navigate:async url=>navigated.push(url),focus:async()=>navigated.push('focus')}];
await click({recipientUserId:'alice',href:'/shoots#shoot-one'});assert.deepEqual(navigated,['https://work.hungryman.ge/shoots#shoot-one','focus']);
let waiting;handlers.message({data:{type:'HMW_PUSH_LOGOUT'},waitUntil:task=>waiting=task});await waiting;assert.equal(unsubscribed,1);assert.ok(closed.includes('existing'));
console.log('PASS Web Push worker privacy, account switch, safe navigation and logout lifecycle');
