import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const environment={WORK_NOTIFICATION_SCHEDULER_OWNER_EMAIL:'scheduler-owner@example.test'};
const records=new Map();
let produced=0,workCalls=0,chatCalls=0,fail=false;
const DB={
 prepare(query){
  return {bind(...args){
   return {
    async first(){return records.has(args[0])?{value:records.get(args[0])}:null},
    async run(){assert.ok(query.startsWith('INSERT INTO workspace_settings'));records.set(args[0],args[1]);return {meta:{changes:1}}},
   };
  }};
 },
};
const exports={};
const code=ts.transpileModule(fs.readFileSync('app/mcp/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(code,{exports,Response,Request,Headers,Date,JSON,Number,Object,Promise,require(name){
 if(name==='cloudflare:workers')return {env:environment};
 if(name==='@/lib/notification-reminders')return {produceScheduledNotices:async(...args)=>{assert.equal(args.length,0,'MCP must use server time, never caller-selected time');produced++;if(fail)throw Error('private internal failure');return {date:'2026-10-24',created:2}}};
 if(name==='@/lib/notifications')return {flushNotices:async()=>{workCalls++;return {examined:3}}};
 if(name==='@/lib/notification-runtime')return {notificationRuntime:()=>({serverScheduling:false})};
 if(name==='@/lib/push')return {flushPush:async()=>{chatCalls++;return {examined:4}}};
 if(name==='@/lib/site-controls-store')return {getSiteControlState:async()=>({features:{calls:false},removedFeatures:['calls'],removedPermissions:[],revision:2,history:[{action:'site.function.removed',target:'feature:calls',created:1}]})};
 if(name==='@/lib/storage')return {storage:()=>({DB})};
 throw Error(name);
}});
const owner={'oai-authenticated-user-id':'verified-owner-id','oai-authenticated-user-email':'scheduler-owner@example.test'};
function request(body,headers={}){return new Request('https://site.test/mcp',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)})}
async function rpc(method,params,headers={}){const response=await exports.POST(request({jsonrpc:'2.0',id:7,method,...(params?{params}:{})},headers));return response.json()}
let value=await rpc('server/discover');assert.equal(value.result.supportedVersions[0],'2026-07-28');
value=await rpc('tools/list');assert.deepEqual(value.result.tools.map(tool=>tool.name),['work_system_status','work_notification_status','run_due_work_notifications']);
assert.ok(value.result.tools.every(tool=>tool.inputSchema.additionalProperties===false));
// No anonymous, bypass-only, wrong-owner, or unverified email calls may invoke
// the producer or read its persisted operating state.
for(const headers of [{},{authorization:'Bearer service-token'},{'oai-authenticated-user-email':owner['oai-authenticated-user-email']},{...owner,'oai-authenticated-user-email':'staff@example.test'}]){
 for(const name of ['work_system_status','work_notification_status','run_due_work_notifications']){
  value=await rpc('tools/call',{name,arguments:{}},headers);assert.equal(value.result.isError,true);
 }
}
assert.equal(produced,0);assert.equal(workCalls,0);assert.equal(chatCalls,0);
value=await rpc('tools/call',{name:'work_system_status',arguments:{}},owner);assert.equal(value.result.structuredContent.removedFeatures[0],'calls');assert.equal(value.result.structuredContent.dataRetained,true);assert.equal(produced,0);
value=await rpc('tools/call',{name:'work_notification_status',arguments:{}},owner);assert.equal(value.result.structuredContent.lastRun,null);assert.equal(value.result.structuredContent.serverScheduling,false);
for(const args of [{now:0},{userId:'another-user'},null,[],false]){value=await rpc('tools/call',{name:'run_due_work_notifications',arguments:args},owner);assert.equal(value.error.code,-32602)}
assert.equal(produced,0);
value=await rpc('tools/call',{name:'run_due_work_notifications',arguments:{}},owner);assert.equal(value.result.structuredContent.created,2);assert.equal(produced,1);assert.equal(workCalls,1);assert.equal(chatCalls,1);
value=await rpc('tools/call',{name:'work_notification_status',arguments:{}},owner);assert.equal(value.result.structuredContent.lastRun.workExamined,3);assert.equal(value.result.structuredContent.lastRun.chatExamined,4);
const previous=records.get('work-notification-scheduler:last-run');fail=true;
value=await rpc('tools/call',{name:'run_due_work_notifications'},owner);assert.equal(value.result.isError,true);assert.ok(!JSON.stringify(value).includes('private internal failure'));assert.equal(records.get('work-notification-scheduler:last-run'),previous,'Failed run must not replace last completed receipt');
environment.WORK_NOTIFICATION_SCHEDULER_OWNER_EMAIL='';
value=await rpc('tools/call',{name:'run_due_work_notifications'},owner);assert.equal(value.result.isError,true);
assert.equal((await exports.POST(request('{'))).status,400);
assert.equal((await exports.POST(request(' '.repeat(17_000)))).status,413);
assert.equal((await exports.POST(request({}, {'Content-Type':'text/plain'}))).status,415);
value=await rpc('not-a-method');assert.equal(value.error.code,-32601);
assert.equal((await exports.POST(request({jsonrpc:'2.0',method:'notifications/initialized'}))).status,204);
console.log('PASS notification MCP: discovery, configured owner only, no service bypass, fixed server-time arguments, aggregate readback, failure redaction and request validation.');
