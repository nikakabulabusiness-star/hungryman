import {env} from 'cloudflare:workers';
import {produceScheduledNotices} from '@/lib/notification-reminders';
import {flushNotices} from '@/lib/notifications';
import {notificationRuntime} from '@/lib/notification-runtime';
import {flushPush} from '@/lib/push';
import {storage} from '@/lib/storage';
import {getSiteControlState} from '@/lib/site-controls-store';

export const dynamic='force-dynamic';
const VERSION='2026-07-28';
const RUN_KEY='work-notification-scheduler:last-run';
const tools=[
 {name:'work_system_status',description:'Read the current Hungryman Work enabled modules, removed functions and latest removal/restoration history. Use before modifying the app so deliberately removed functionality stays removed. Read-only; restricted to the configured Site owner; no employee records or credentials.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
 {name:'work_notification_status',description:'Read Hungryman Work reminder scheduler readiness and the last completed dispatch. Restricted to the configured Site owner. Contains aggregate counts only.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
 {name:'run_due_work_notifications',description:'Send only currently due Hungryman Work reminders using the saved employee/calendar rules: salary at 10:00 and attendance at 13:00 Asia/Tbilisi. Safely retry pending message and work-notification deliveries. Does not modify employee attendance or calendars. Restricted to the configured Site owner. Repeated calls do not recreate the same reminder.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true}},
];
type RpcId=string|number|null;
type RunReceipt={completedAt:string;date:string;created:number;workExamined:number;chatExamined:number};
function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store'}})}
function error(id:RpcId,code:number,message:string,status=200){return json({jsonrpc:'2.0',id,error:{code,message}},status)}
function result(id:RpcId,value:unknown){return json({jsonrpc:'2.0',id,result:value})}
function toolFailure(id:RpcId,message:string){return result(id,{isError:true,content:[{type:'text',text:message}]})}
function ownerIdentity(request:Request){
 const configured=String((env as unknown as Record<string,unknown>).WORK_NOTIFICATION_SCHEDULER_OWNER_EMAIL||'').trim().toLowerCase();
 const email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
 const userId=request.headers.get('oai-authenticated-user-id')?.trim();
 // Sites dispatch authenticates these headers. A service bypass token, staff
 // session, caller-supplied tool argument or email by itself is not an identity.
 return configured&&userId&&email===configured?{email,userId}:null;
}
async function lastRun():Promise<RunReceipt|null>{
 const row=await storage().DB.prepare('SELECT value FROM workspace_settings WHERE key=?').bind(RUN_KEY).first<{value:string}>();
 if(!row||row.value.length>2000)return null;
 try{const value=JSON.parse(row.value) as RunReceipt;if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||!Number.isFinite(Date.parse(value.completedAt)))return null;if(![value.created,value.workExamined,value.chatExamined].every(n=>Number.isSafeInteger(n)&&n>=0))return null;return {completedAt:value.completedAt,date:value.date,created:value.created,workExamined:value.workExamined,chatExamined:value.chatExamined}}catch{return null}
}

export async function POST(request:Request){
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return error(null,-32600,'Expected application/json.',415);
 if(Number(request.headers.get('content-length')||0)>16_384)return error(null,-32600,'Request too large.',413);
 let body:Record<string,unknown>;
 try{const text=await request.text();if(text.length>16_384)return error(null,-32600,'Request too large.',413);const parsed:unknown=JSON.parse(text);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return error(null,-32600,'Invalid request.',400);body=parsed as Record<string,unknown>}catch{return error(null,-32700,'Invalid JSON.',400)}
 const rawId=body.id,id:RpcId=typeof rawId==='string'||typeof rawId==='number'&&Number.isFinite(rawId)?rawId:null;
 if(body.jsonrpc!=='2.0'||typeof body.method!=='string')return error(id,-32600,'Invalid request.',400);
 if(body.method==='notifications/initialized'&&rawId===undefined)return new Response(null,{status:204});
 if(rawId===undefined||rawId!==null&&typeof rawId!=='string'&&typeof rawId!=='number')return error(null,-32600,'A request ID is required.',400);
 if(body.method==='server/discover')return result(id,{supportedVersions:[VERSION],capabilities:{tools:{}}});
 // Compatibility for clients which still negotiate the earlier MCP handshake.
 if(body.method==='initialize')return result(id,{protocolVersion:VERSION,capabilities:{tools:{}},serverInfo:{name:'hungryman-work-notifications',version:'1.0.0'}});
 if(body.method==='ping')return result(id,{});
 if(body.method==='tools/list')return result(id,{tools});
 if(body.method!=='tools/call')return error(id,-32601,'Method not found.');
 const identity=ownerIdentity(request);
 if(!identity)return toolFailure(id,'This tool requires the configured Hungryman Work Site owner connection.');
 const params=body.params;
 if(!params||typeof params!=='object'||Array.isArray(params))return error(id,-32602,'Invalid tool parameters.');
 const {name,arguments:args}=params as {name?:unknown;arguments?:unknown};
 if(typeof name!=='string'||!tools.some(tool=>tool.name===name))return error(id,-32602,'Unknown tool.');
 if(args!==undefined&&(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length))return error(id,-32602,'This tool takes no arguments.');
 try{
  if(name==='work_system_status'){const state=await getSiteControlState(),value={...state,history:state.history.slice(0,20),dataRetained:true};return result(id,{content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value})}
  if(name==='work_notification_status'){
   const value={timezone:'Asia/Tbilisi',salaryTime:'10:00',attendanceTime:'13:00',serverScheduling:notificationRuntime().serverScheduling,lastRun:await lastRun()};
   return result(id,{content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
  }
  const notices=await produceScheduledNotices();
  const [work,chat]=await Promise.all([flushNotices(),flushPush()]);
  const receipt:RunReceipt={completedAt:new Date().toISOString(),date:notices.date,created:notices.created,workExamined:work.examined,chatExamined:chat.examined};
  await storage().DB.prepare('INSERT INTO workspace_settings (key,value,updated,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated,updated_by=excluded.updated_by').bind(RUN_KEY,JSON.stringify(receipt),Date.now(),identity.email).run();
  return result(id,{content:[{type:'text',text:JSON.stringify(receipt)}],structuredContent:receipt});
 }catch{return toolFailure(id,'Reminder dispatch is temporarily unavailable. Retry this same tool; completed reminders are not recreated.');}
}
