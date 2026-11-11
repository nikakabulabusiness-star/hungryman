import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import ts from 'typescript';

// Exercise the real component's asynchronous state transitions without a browser.
const hooks=[],effects=[],intervals=[],requests=[],modules=new Map();let cursor=0;
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
const react={
 useState(value){const i=cursor++;if(!(i in hooks))hooks[i]=typeof value==='function'?value():value;return [hooks[i],next=>{hooks[i]=typeof next==='function'?next(hooks[i]):next}]},
 useRef(value){const i=cursor++;if(!(i in hooks))hooks[i]={current:value};return hooks[i]},
 useCallback(fn,deps){const i=cursor++;if(!same(hooks[i]?.deps,deps))hooks[i]={deps,fn};return hooks[i].fn},
 useMemo(fn,deps){return react.useCallback(fn,deps)()},
 useEffect(fn,deps){const i=cursor++;if(!same(hooks[i]?.deps,deps)){hooks[i]?.cleanup?.();hooks[i]={deps};effects.push(()=>{hooks[i].cleanup=fn()})}},
};
const jsx=(type,props,key)=>({type,props:props||{},key}),frame={setMeta:()=>{}},domEvents=new Map();
const windowMock={addEventListener:(name,fn)=>domEvents.set(name,fn),removeEventListener:()=>{},dispatchEvent:()=>{},confirm:()=>true,open:()=>null};
function load(file){
 if(modules.has(file))return modules.get(file);
 const exports={};modules.set(file,exports);
 const require=name=>{
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};
  if(name==='lucide-react')return new Proxy({},{get:(_,name)=>String(name)});
  if(name==='@/app/work/tasks/work-frame')return {useWorkFrame:()=>frame};
  if(name==='@/app/work/tasks/work-ui')return {WorkDialog:'WorkDialog',WorkState:'WorkState',WorkFeedback:'WorkFeedback',workRoleLabel:role=>role,uploadWorkPhoto:()=>{throw Error('not used')}};
  if(name.endsWith('.css'))return {};
  const base=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);
  return load(fs.existsSync(base+'.ts')?base+'.ts':base+'.tsx');
 };
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports,require,crypto,structuredClone,JSON,Map,Set,Date,Intl,Number,Array,Object,Math,console,URL,Blob,Event,AbortController,window:windowMock,history:{state:null,replaceState(){}},location:{origin:'https://work.example.test'},document:{visibilityState:'visible',addEventListener:()=>{},removeEventListener:()=>{}},setTimeout:()=>1,clearTimeout:()=>{},setInterval:fn=>{intervals.push(fn);return intervals.length},clearInterval:()=>{},fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}))});return exports;
}
const model=load('mobile/src/lib/work-model.ts'),client=load('components/work-callsheet-client.tsx'),editor=load('components/work-callsheet-editor.tsx'),fields=load('components/work-callsheet-fields.tsx'),archive=load('lib/work-export.ts');
const video={id:'test-video',title:'საწყისი ვიდეო',kind:'video',entryBoard:'story',stages:{story:'script',production:null,editing:null,social:null,technical:null},content:{...model.emptyWorkContent(),script:'დამტკიცების სცენარი'},callSheet:model.emptyCallSheet(),technical:model.emptyTechnical(),approvedTechnical:null,totals:{currency:'GEL',base:0,technicalApproved:0,technicalPending:0,grandTotal:0,categories:[]},version:4,createdBy:'writer',created:Date.now(),updated:Date.now(),permissions:{editBoards:['story'],approve:false,remove:false},shoots:[],reviewNotes:{}};
const detail={video,history:[],snapshots:[],meta:{boards:model.workBoards,people:[],editBoards:['story'],canApprove:false,canContacts:false,assignable:[],unlinkedShoots:[]}};
function render(){cursor=0;const tree=client.default({id:video.id,initialBoard:'story'});while(effects.length)effects.shift()();return tree}
function all(node,predicate,found=[]){if(Array.isArray(node)){node.forEach(x=>all(x,predicate,found));return found}if(!node||typeof node!=='object')return found;if(predicate(node))found.push(node);all(node.props?.children,predicate,found);return found}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
async function answer(request,data,status=200){request.resolve({ok:status>=200&&status<300,status,json:async()=>structuredClone(data)});await flush()}
let tree=render();await flush();assert.equal(requests.length,1);
await answer(requests.shift(),detail);tree=render();assert.ok(all(tree,x=>x.type===editor.WorkContentEditor).length);
// A GET that started while clean must never replace a newly typed draft.
intervals[0]();assert.equal(requests.length,1);
all(tree,x=>x.type===editor.WorkContentEditor)[0].props.onChange(old=>({...old,title:'ჩემი ახალი ტექსტი'}));
await answer(requests.shift(),{...detail,video:{...video,title:'სხვისი ცვლილება',version:5}});tree=render();
assert.equal(all(tree,x=>x.type===editor.WorkContentEditor)[0].props.draft.title,'ჩემი ახალი ტექსტი');
const before=requests.length;intervals[0]();assert.equal(requests.length,before,'dirty draft blocks background revalidation');
// A version conflict keeps the local draft and exposes explicit conflict recovery.
all(tree,x=>x.type==='button'&&all(x,y=>y.type==='Save').length)[0].props.onClick();await flush();
assert.equal(requests[0].options.method,'PATCH');assert.equal(JSON.parse(requests[0].options.body).version,4);
await answer(requests.shift(),{error:'სხვა თანამშრომელმა განაახლა'},409);tree=render();
assert.equal(all(tree,x=>x.type===editor.WorkContentEditor)[0].props.draft.title,'ჩემი ახალი ტექსტი');
assert.equal(all(tree,x=>x.props.className==='hm-cs-conflict').length,1);
// Successful saves use canonical values and then revalidate complete version history.
all(tree,x=>x.type==='button'&&all(x,y=>y.type==='Save').length)[0].props.onClick();await flush();
await answer(requests.shift(),{...detail,video:{...video,title:'ჩემი ახალი ტექსტი',version:5}});
assert.equal(requests[0].options.method,'GET');await answer(requests.shift(),{...detail,video:{...video,title:'ჩემი ახალი ტექსტი',version:5}});tree=render();
assert.equal(all(tree,x=>x.props.className==='hm-cs-conflict').length,0);
assert.equal(all(tree,x=>x.type==='button'&&all(x,y=>y.type==='Save').length)[0].props.disabled,true);
// Board-scoped payloads never leak unrelated content into a technical or production save.
const draft={title:video.title,content:video.content,callSheet:video.callSheet,technical:video.technical};
assert.deepEqual(Object.keys(client.videoSavePayload(video,draft,'technical')).sort(),['action','board','technical','version']);
assert.equal(client.videoSavePayload(video,draft,'production').content,undefined);
assert.equal(client.videoSavePayload(video,draft,'story').callSheet,draft.callSheet);
const rows=[{id:'first'},{id:'second'},{id:'third'}];assert.deepEqual(Array.from(fields.reorderWorkRows(rows,0,2),x=>x.id),['second','third','first']);assert.equal(rows[0].id,'first');assert.equal(fields.reorderWorkRows(rows,-1,2),rows);
// Exports preserve all financial/detail sections, escape HTML, and neutralize Excel formulas.
const exported=structuredClone(video);exported.title='<img src=x onerror=alert(1)>';exported.content.idea='FULL IDEA';exported.callSheet.notes='DIRECTOR NOTE';exported.callSheet.backupSecondary=true;exported.callSheet.budget=[{id:'line',category:'=HYPERLINK("bad")',type:'service',label:'test,"quoted"\nrow',quantity:2,unitPrice:1250}];exported.technical.items=[{id:'pending',name:'PENDING RENTAL',source:'rental',quantity:1,unitPrice:3000}];exported.approvedTechnical={items:[{id:'approved',name:'APPROVED RENTAL',source:'rental',quantity:2,unitPrice:1000}],notes:'RENTAL NOTE',photoIds:[]};exported.totals={currency:'GEL',base:2500,technicalApproved:2000,technicalPending:3000,grandTotal:4500,categories:[]};
const html=archive.buildWorkArchiveHtml({...detail,video:exported});assert.ok(!html.includes('<img src=x onerror'));assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));for(const expected of ['FULL IDEA','DIRECTOR NOTE','APPROVED RENTAL','PENDING RENTAL','სარეზერვო','ცვლილებების ისტორია','დამტკიცებული ვერსიები'])assert.ok(html.includes(expected),expected);
const csv=archive.buildWorkBudgetCsv(exported);assert.equal(csv.charCodeAt(0),0xfeff);assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));assert.ok(csv.includes('test,""quoted""\nrow'));assert.ok(csv.includes('APPROVED RENTAL'));assert.ok(!csv.includes('PENDING RENTAL'));assert.ok(csv.includes('"45.00"'));
const selected={id:'approved-v2',board:'story',version:2,created:100,actorName:'Founder',data:{title:'FROZEN TITLE',kind:video.kind,content:{...video.content,script:'FROZEN SCRIPT'},callSheet:video.callSheet,technical:video.technical,approvedTechnical:null,totals:video.totals}};
const withLaterData={...detail,meta:{...detail.meta,people:[{name:'UNRELATED STAFF DIRECTORY'}],assignable:[{name:'UNRELATED ASSIGNABLE'}]},video:{...video,content:{...video.content,script:'LATER UNSENT SCRIPT'},reviewNotes:{story:'LATER REVIEW NOTE'},shoots:[{id:'LATER SHOOT'}]},history:[{id:'before',version:2,created:100,comment:'HISTORICAL COMMENT'},{id:'after',version:3,created:101,comment:'LATER HISTORY'}],snapshots:[selected,{...selected,id:'newer',version:3,created:101,data:{...selected.data,title:'LATER SNAPSHOT TITLE'}}]};
const historical=archive.workSnapshotExport(withLaterData,selected),json=JSON.stringify(historical.payload),historicalHtml=archive.buildWorkArchiveHtml(historical.detail);
for(const forbidden of ['UNRELATED STAFF DIRECTORY','UNRELATED ASSIGNABLE','LATER UNSENT SCRIPT','LATER REVIEW NOTE','LATER SHOOT','LATER HISTORY','LATER SNAPSHOT TITLE','"permissions"','"meta"']){assert.ok(!json.includes(forbidden),forbidden);assert.ok(!historicalHtml.includes(forbidden),forbidden)}
assert.equal(historical.payload.schemaVersion,1);assert.equal(historical.payload.video.version,2);assert.equal(historical.payload.video.stages.story,'approved');assert.equal(historical.payload.snapshots.length,1);assert.equal(historical.payload.history.length,1);assert.ok(json.includes('FROZEN SCRIPT'));assert.ok(historicalHtml.includes('FROZEN SCRIPT'));assert.equal(withLaterData.video.content.script,'LATER UNSENT SCRIPT','projection does not mutate live view');
all(tree,x=>x.type==='button'&&all(x,y=>y.type==='Download').length)[0].props.onClick();tree=render();
for(const format of ['html','json','csv','zip'])assert.ok(all(tree,x=>x.type==='a'&&x.props.href==='/api/work/videos/test-video/export?format='+format).length,'current '+format+' uses authenticated server export');
intervals[0]();const signedOutRequest=requests.shift();domEvents.get('hmw-work-logout')();await answer(signedOutRequest,detail);tree=render();assert.equal(tree.type,'WorkState','logout clears private content and rejects late reads');
for(const hook of hooks)hook?.cleanup?.();
console.log('PASS Work call sheet web: late GET cannot overwrite typing, dirty polling guard, 409 draft recovery, canonical save/history reload, board-scoped mutations, immutable row order, full HTML escaping and formula-safe approved-budget CSV.');
