import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path,require,extras={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,Date,Map,Set,JSON,Math,Number,Error,Promise,...extras});return exports}
const now=Date.parse('2026-10-24T04:00:00Z');
const planner=load('mobile/src/lib/reminder-plan.ts',()=>{},{Date:class extends Date{static now(){return now}}});
const days=[
 {date:'2026-10-24',planned:'work',mode:'pending'},
 {date:'2026-10-25',planned:'rest',mode:'pending'},
 {date:'2026-10-26',planned:'work',mode:'office'},
 {date:'2026-10-27',planned:'work',mode:'pending',requested:true},
 {date:'2026-10-28',planned:'work',mode:'remote'},
 {date:'2026-10-29',planned:'leave',mode:'pending'},
];
const input={days,salaries:['2026-10-24','2026-10-24','bad-date','2026-02-30'],userId:'employee-a',now};
const plan=planner.buildReminderPlan(input);
assert.equal(plan.length,2);
assert.equal(plan[0].at,Date.parse('2026-10-24T06:00:00Z'),'payday is 10:00 in Tbilisi, not device timezone');
assert.equal(plan[1].at,Date.parse('2026-10-24T09:00:00Z'),'attendance is 13:00 in Tbilisi');
assert.equal(plan[1].data.recipientUserId,'employee-a');
assert.equal(planner.buildReminderPlan({...input,serverScheduling:true,remoteReady:true}).length,0,'confirmed server delivery avoids duplicate locals');
assert.equal(planner.buildReminderPlan({...input,serverScheduling:true,remoteReady:false}).length,2,'missing push registration retains working fallback');
assert.equal(planner.buildReminderPlan({...input,serverScheduling:true,remoteReady:true,personalTeam:true}).length,2,'Personal Team never assumes APNs');
assert.equal(planner.buildReminderPlan({...input,now:Date.parse('2026-10-24T10:00:00Z')}).length,0,'past alerts are not replayed');
assert.equal(planner.buildReminderPlan({...input,userId:''}).length,0,'signed-out device has no schedules');
const manyDays=Array.from({length:100},(_,i)=>({date:new Date(now+i*86400000).toISOString().slice(0,10),planned:'work',mode:'pending'}));
assert.equal(planner.buildReminderPlan({...input,days:manyDays,salaries:[]}).length,60,'leave headroom below iOS pending-notification limit');

// Exercise the actual scheduler against the native boundary: reschedule changed
// entries, preserve unrelated alerts, and cancel superseded work reminders.
const pending=new Map([['other-feature',{identifier:'other-feature',content:{data:{}}}],['hm-attendance-2026-01-01',{identifier:'hm-attendance-2026-01-01',content:{data:{}}}]]),scheduled=[],cancelled=[];
const N={getPermissionsAsync:async()=>({granted:true}),setNotificationCategoryAsync:async(name,actions)=>{assert.equal(name,'attendanceStatus');assert.deepEqual(Array.from(actions,a=>a.identifier),['late','absent','remote']);assert.ok(actions.every(a=>a.options.opensAppToForeground&&a.options.isAuthenticationRequired))},getAllScheduledNotificationsAsync:async()=>[...pending.values()],cancelScheduledNotificationAsync:async id=>{cancelled.push(id);pending.delete(id)},scheduleNotificationAsync:async request=>{scheduled.push(request);pending.set(request.identifier,request)},SchedulableTriggerInputTypes:{DATE:'date'}};
const constants={executionEnvironment:'standalone',expoConfig:{extra:{}}};
const location=load('mobile/src/lib/location.ts',name=>({
 'expo-location':{},'expo-task-manager':{isTaskDefined:()=>true},'expo-secure-store':{AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:'locked-access'},'expo-constants':{default:constants},'./api':{},'./reminder-plan':planner,'expo-notifications':N,
}[name]),{process:{env:{}},Date:class extends Date{static now(){return now}}});
await location.scheduleAttendanceReminders(days,'13:00',['2026-10-24'],{userId:'employee-a'});
assert.equal(scheduled.length,2);assert.ok(cancelled.includes('hm-attendance-2026-01-01'));assert.ok(pending.has('other-feature'));
await location.scheduleAttendanceReminders(days,'13:00',['2026-10-24'],{userId:'employee-a'});
assert.equal(scheduled.length,2,'unchanged pending schedules are not duplicated');
await location.scheduleAttendanceReminders(days,'13:00',['2026-10-24'],{userId:'employee-a',serverScheduling:true,remoteReady:true});
assert.equal(pending.size,1);assert.ok(pending.has('other-feature'));

// The real foreground handler and response observer are tested without an OS.
let handler,responseListener,receivedListener,cleanup;const calls=[],navigation=[];
const notifications={...N,setNotificationHandler:value=>{handler=value},setBadgeCountAsync:async()=>{},clearLastNotificationResponseAsync:async()=>{},dismissNotificationAsync:async()=>{},addNotificationResponseReceivedListener:fn=>{responseListener=fn;return {remove(){}}},addNotificationReceivedListener:fn=>{receivedListener=fn;return {remove(){}}},addPushTokenListener:()=>({remove(){}}),getLastNotificationResponseAsync:async()=>null};
const module=load('mobile/src/ui/message-notifications.tsx',name=>({
 react:{useRef:value=>({current:value}),useEffect:fn=>{cleanup=fn()}},'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})},Alert:{alert:(...args)=>calls.push(['alert',...args])}},'expo-router':{router:{push:path=>navigation.push(path)}},'expo-constants':{default:constants},'expo-notifications':notifications,
 '../lib/api':{api:async(path,options)=>{calls.push([path,options]);return {ok:true}}},'../lib/push-notifications':{registerPush:async id=>calls.push(['register',id])},'../lib/resource-cache':{refreshResource:async path=>calls.push(['refresh',path]),resourceEntry:()=>({data:{unread:2,chatUnread:3}}),subscribeResource:()=>()=>{}},'../lib/auth':{useAuth:()=>({session:{user:{userId:'employee-a'},permissions:{isApprovedStaff:true}}})},'./notification-center':{openNotice:n=>navigation.push(n)},'../lib/location':{cancelTodayReminder:async()=>calls.push(['cancel-today'])},
}[name]),{setTimeout:()=>1,clearTimeout:()=>{}});
assert.deepEqual(JSON.parse(JSON.stringify(await handler.handleNotification())),{shouldShowBanner:false,shouldShowList:false,shouldPlaySound:false,shouldSetBadge:false},'foreground produces no banner, list, sound or duplicate badge write');
module.MessageNotifications();
const settle=async()=>{for(let i=0;i<25;i++)await Promise.resolve()};
await settle();
const respond=(data,action='expo.modules.notifications.actions.DEFAULT',identifier='notice-1')=>responseListener({notification:{request:{identifier,content:{data}}},actionIdentifier:action});
respond({conversationId:'dm_example',recipientUserId:'employee-a'});await settle();
assert.equal(navigation.at(-1).target,'chat');assert.equal(navigation.at(-1).target_id,'dm_example');
const before=navigation.length;respond({conversationId:'wrong-account',recipientUserId:'employee-b'},undefined,'notice-2');await settle();assert.equal(navigation.length,before,'another account cannot open stale notification');
respond({attendance:true,date:'2026-10-24',recipientUserId:'employee-a'},'remote','reminder');await settle();
const requests=calls.filter(c=>c[0]==='/api/attendance/requests');assert.equal(requests.length,1);assert.equal(requests[0][1].body.answer,'remote');assert.equal(requests[0][1].body.date,'2026-10-24');
respond({attendance:true,date:'2026-10-24',recipientUserId:'employee-a'},'remote','reminder');await settle();assert.equal(calls.filter(c=>c[0]==='/api/attendance/requests').length,1,'replayed response is idempotent on device');
assert.ok(calls.some(c=>c[0]==='cancel-today'));receivedListener();await settle();assert.ok(calls.some(c=>c[0]==='refresh'&&c[1]==='/api/notifications'));cleanup();
console.log('PASS: native foreground suppression, exact notification navigation, recipient isolation, attendance actions, Tbilisi schedules, fallback safety, cancellation and idempotent rescheduling.');
