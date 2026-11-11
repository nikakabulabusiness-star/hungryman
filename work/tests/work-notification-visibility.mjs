import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
const prepare=(query,args=[])=>({bind:(...a)=>prepare(query,a),first:async()=>db.prepare(query).get(...args)||null,all:async()=>({results:db.prepare(query).all(...args)})});
let actor={userId:'owner',role:'Owner',isApproved:true,features:{work:true},permissions:['workspace.view']};
const exports={};
const stubs={
 '@/lib/staff-access':{getStaffAccess:async()=>actor},
 '@/lib/storage':{storage:()=>({DB:{prepare}})},
 '@/lib/visitor':{sameOrigin:()=>true},
 '@/lib/permissions':{hasPermission:(a,key)=>a.permissions.includes(key)},
 '@/lib/notification-policy':{canReviewRequests:()=>false,canReviewAccounts:()=>false},
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/notifications/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:key=>{assert.ok(stubs[key],key);return stubs[key]},Date,URL,Response});
const now=Date.now()-1000;
db.prepare("INSERT INTO work_videos(id,title,kind,entry_board,stages_json,content_json,callsheet_json,technical_json,review_notes_json,version,created_by,created,updated,updated_by,mutation_id) VALUES('video','Title','video','story','{\"story\":\"review\"}','{}','{}','{}','{}',1,'writer',?,?,'writer','m')").run(now,now);
function task(id,scope,creator,assignee){db.prepare("INSERT INTO work_tasks(id,scope,creator_id,assignee_id,creator_name,assignee_name,updated_by,title,description,priority,progress,checklist_json,version,created,updated,mutation_id) VALUES(?,?,?,?,'Creator','Assignee','owner',?,'','normal',0,'[]',1,?,?,'m')").run(id,scope,creator,assignee,id,now,now)}
task('private','private','other','other');task('assigned','assigned','owner','worker');task('unrelated','assigned','other','worker');
function notice(id,target,targetId,category='work',recipient='owner'){db.prepare('INSERT INTO work_notifications(id,user_id,category,title,body,target,target_id,important,created) VALUES(?,?,?,? ,?,?,?,?,?)').run(id,recipient,category,'Title','Body',target,targetId,0,now)}
notice('review','work','video','work_review');notice('shared','work','video');notice('own','work_task','assigned');notice('leak','work_task','private');notice('unrelated','work_task','unrelated');notice('missing','work','missing');
const inbox=async()=>await(await exports.GET(new Request('https://test.example/api/notifications'))).json();
assert.deepEqual((await inbox()).items.map(x=>x.id).sort(),['own','review','shared']);
actor.role='Developer';assert.deepEqual((await inbox()).items.map(x=>x.id).sort(),['own','shared'],'system developer is not business founder');
actor.features.work=false;assert.equal((await inbox()).unread,0);assert.equal((await inbox()).items.length,0);
actor.features.work=true;actor.permissions=[];assert.equal((await inbox()).unread,0);
actor.permissions=['workspace.view'];actor.role='Owner';db.prepare("UPDATE work_videos SET stages_json='{\"story\":\"approved\"}' WHERE id='video'").run();assert.deepEqual((await inbox()).items.map(x=>x.id).sort(),['own','shared'],'obsolete review notice does not keep ringing');
actor.userId='worker';notice('worker-assigned','work_task','assigned','work_task','worker');assert.equal((await inbox()).items.length,1);db.prepare("UPDATE work_tasks SET assignee_id='other' WHERE id='assigned'").run();assert.equal((await inbox()).items.length,0,'reassignment immediately removes old assignee notice');
actor.userId='owner';db.prepare("UPDATE work_tasks SET deleted=? WHERE id='assigned'").run(now);assert.deepEqual((await inbox()).items.map(x=>x.id),['shared']);
console.log('PASS Work inbox: feature/current authority, founder-only review, stale review suppression, private isolation, reassignment and deletion.');
