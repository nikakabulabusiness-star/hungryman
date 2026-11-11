import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const sql=new DatabaseSync(':memory:');
sql.exec('CREATE TABLE chat_calls(id TEXT,conversation_id TEXT,created INTEGER,ended INTEGER);CREATE TABLE call_members(call_id TEXT,user_id TEXT,session_id TEXT,seen INTEGER);CREATE TABLE team_members(user_id TEXT,avatar_key TEXT);');
const now=Date.now();
sql.prepare('INSERT INTO chat_calls VALUES(?,?,?,NULL)').run('call','private',now);
for(const id of ['alice','bob']){sql.prepare('INSERT INTO call_members VALUES(?,?,?,?)').run('call',id,id+'-session',now);sql.prepare('INSERT INTO team_members VALUES(?,?)').run(id,id+'-avatar')}
sql.prepare('INSERT INTO team_members VALUES(?,?)').run('outsider','private-avatar');
let approved=true,allowed=true,permission=true,reads=0,bodyReads=0;
let bytes=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]),declaredSize=bytes.length;
const DB={prepare:q=>({bind:(...args)=>({first:async()=>sql.prepare(q).get(...args)||null})})};
const BUCKET={get:async()=>{reads++;return {size:declaredSize,arrayBuffer:async()=>{bodyReads++;return bytes.buffer}}}};
const dependencies={
 '@/lib/permissions':{hasPermission:()=>permission},
 '@/lib/staff-access':{getStaffAccess:async()=>({isApproved:approved,userId:'alice'})},
 '@/lib/chat':{threadAllowed:async()=>allowed},
 '@/lib/storage':{storage:()=>({DB,BUCKET})},
};
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/chat/calls/avatar/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>dependencies[n],URL,Response,Uint8Array,Date,btoa});
const get=(target='bob',session='alice-session')=>exports.GET(new Request('https://work.test/api/chat/calls/avatar?id=call&sessionId='+session+'&userId='+target));
let response=await get();assert.equal(response.status,200);assert.match((await response.json()).dataUrl,/^data:image\/png;base64,/);assert.match(response.headers.get('Cache-Control'),/no-store/);
response=await get('alice');assert.equal(response.status,200,'own avatar available after joining');
const before=reads;assert.equal((await get('outsider')).status,404);assert.equal((await get('bob','other-device')).status,409);allowed=false;assert.equal((await get()).status,404);allowed=true;permission=false;assert.equal((await get()).status,403);permission=true;approved=false;assert.equal((await get()).status,403);approved=true;assert.equal(reads,before,'forbidden requests never read private avatar bytes');
sql.prepare('UPDATE call_members SET seen=? WHERE user_id=?').run(now-100000,'bob');assert.equal((await get()).status,404);sql.prepare('UPDATE call_members SET seen=? WHERE user_id=?').run(now,'bob');
bytes=new Uint8Array(600000);bytes.set([137,80,78,71,13,10,26,10]);declaredSize=bytes.length;assert.ok((await (await get()).json()).dataUrl.length>700000,'valid existing uploads above512KiB remain available');
const beforeBody=bodyReads;declaredSize=5*1024*1024+1;assert.equal((await (await get()).json()).dataUrl,null);assert.equal(bodyReads,beforeBody,'oversized avatar is rejected before body allocation');
bytes=new TextEncoder().encode('<svg onload="alert(1)"></svg>');declaredSize=bytes.length;assert.equal((await (await get()).json()).dataUrl,null,'SVG/HTML is never embedded');
sql.prepare('UPDATE chat_calls SET ended=?').run(now);assert.equal((await get()).status,404);
console.log('PASS call avatars: joined-session authorization, peer isolation, expiry/revocation, bounded validated raster bytes and no-store response.');
