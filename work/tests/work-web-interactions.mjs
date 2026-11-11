import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file,imports={},globals={},append=''){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8')+append,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{if(name in imports)return imports[name];throw Error('Unexpected import: '+name)},console,crypto,Map,Set,Promise,setTimeout,clearTimeout,...globals});
 return exports;
}
const model=load('mobile/src/lib/work-model.ts');
const board=load('app/work/tasks/work-board-state.ts',{'@/mobile/src/lib/work-model':model});
const records=load('app/work/tasks/work-records.ts');
const video={id:'v1',version:7,stages:{editing:'footage',story:null,production:null,social:null,technical:null},permissions:{editBoards:['editing']}};
let resolveMove,rejectMove,shown=null,rolledBack=0,requestCount=0,body;
const request=(_id,input)=>{requestCount++;body=input;return new Promise((resolve,reject)=>{resolveMove=resolve;rejectMove=reject})};
const first=board.moveWorkVideo(video,'editing','editing',request,value=>shown=value,()=>{shown=video;rolledBack++});
assert.equal(shown.stages.editing,'editing','Stage changes immediately while request is pending');
assert.equal(body.version,7,'Optimistic move preserves server concurrency version');
assert.equal(body.action,'move');
rejectMove(Error('409 conflict'));await assert.rejects(first,/409/);
assert.equal(shown.stages.editing,'footage');assert.equal(rolledBack,1);
const next=board.moveWorkVideo(video,'editing','editing',request,value=>shown=value,()=>{});
resolveMove({video:{...video,version:8,stages:{...video.stages,editing:'editing'}}});await next;
assert.equal(shown.version,8,'Server canonical version replaces optimistic record');
for(const [department,current,target] of [['story','script','approved'],['production','planning','scheduled'],['technical','preparing','approved'],['social','planning','scheduled']]){
 assert.equal(board.availableWorkMoves(department,current).some(item=>item.id===target),false,'Dragging cannot skip founder approval');
}
assert.equal(board.availableWorkMoves('editing','invalid').length,0);
assert.equal(board.availableWorkMoves('story','review').length,0);
assert.deepEqual(Array.from(board.availableWorkMoves('production','scheduled'),item=>item.id),['filmed']);
await assert.rejects(board.moveWorkVideo({...video,permissions:{editBoards:[]}},'editing','editing',request,()=>assert.fail(),()=>assert.fail()));
assert.equal(requestCount,2,'Unauthorized stage action never sends a write');
assert.equal(records.newestWorkRecords([{id:'a',version:9}],[{id:'a',version:2}])[0].version,9,'Older detail/pagination does not overwrite fresh polling');

function hooks(){
 const values=[],effects=[],queued=[];let cursor=0;
 const react={useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next}]},useRef(initial){const i=cursor++;if(!(i in values))values[i]={current:initial};return values[i]},useEffect(callback,deps){const i=cursor++,previous=effects[i];if(!previous||deps.some((value,k)=>value!==previous.deps[k]))queued.push(()=>{previous?.cleanup?.();effects[i]={deps,cleanup:callback()}})}};
 return{react,render(fn,props){cursor=0;const element=fn(props);while(queued.length)queued.shift()();return element}};
}
const jsx=(type,props)=>({type,props}),nodes=element=>{if(!element||typeof element!=='object')return[];if(Array.isArray(element))return element.flatMap(nodes);return[element,...nodes(element.props?.children)]};
const text=element=>{if(element===null||element===undefined||typeof element==='boolean')return'';if(Array.isArray(element))return element.map(text).join('');if(typeof element!=='object')return String(element);return text(element.props?.children)};
const icons=new Proxy({},{get:(_object,key)=>key}),ui={WorkDialog:'dialog',WorkFeedback:'feedback',WorkState:'empty',workDate:value=>value||'ვადის გარეშე',workRoleLabel:value=>value};
const task={id:'t1',version:3,title:'ვიდეოს მონტაჟი',description:'მოსამზადებელი საქმე',scope:'assigned',creatorId:'lead',creatorName:'ხელმძღვანელი',assigneeId:'editor',assigneeName:'მემონტაჟე',priority:'normal',progress:65,checklist:[{id:'c1',title:'საწყისი მასალა',done:false}],dueDate:null,permissions:{edit:true,delete:true,progress:true}};
const pending=[];let currentData={tasks:[task],people:[],canAssign:false,viewerId:'editor',nextCursor:null};
const hook=hooks(),personal=load('app/work/tasks/work-personal.tsx',{'react':hook.react,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':icons,'@/components/cabinet-panel':{useWorkData:()=>({data:currentData,error:'',refresh:async()=>{}})},'./work-records':records,'./work-ui':{...ui,workApi:(path,method,body)=>new Promise((resolve,reject)=>pending.push({path,method,body,resolve,reject}))}},{window:{confirm:()=>true}},'\nexport {TaskCard,TaskEditor};');
const render=()=>hook.render(personal.default,{}),card=()=>nodes(render()).find(node=>typeof node.type==='function'&&node.type.name==='TaskCard');
render();assert.equal(text(render()).includes('დავალების მინიჭება'),false,'No assignable directory means no assignment action');
card().props.onProgress(100);assert.equal(card().props.task.progress,100,'Task completion is optimistic');
card().props.onProgress(50);assert.equal(pending.length,1,'A second task change cannot race the first request');
pending[0].reject(Error('409 stale'));await new Promise(resolve=>setImmediate(resolve));assert.equal(card().props.task.progress,65,'Failed task save restores old progress');
card().props.onProgress(100);pending[1].resolve({task:{...task,version:4,progress:100}});await new Promise(resolve=>setImmediate(resolve));assert.equal(card().props.task.version,4);
currentData={...currentData,tasks:[{...task,version:5,progress:50}]};render();assert.equal(card().props.task.progress,50,'Later server edits reconcile optimistic snapshots');

// Execute actual card and form renderers; UI authority is based on server permissions.
const cardHooks=hooks(),cardModule=load('app/work/tasks/work-personal.tsx',{'react':cardHooks.react,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':icons,'@/components/cabinet-panel':{},'./work-records':records,'./work-ui':ui},{},'\nexport {TaskCard,TaskEditor};');
const privateTree=cardHooks.render(cardModule.TaskCard,{task:{...task,scope:'private',permissions:{edit:false,delete:false,progress:false}},highlight:false});
assert.match(text(privateTree),/მხოლოდ შენ/);assert.doesNotMatch(text(privateTree),/ხელმძღვანელი|მემონტაჟე/);
assert.equal(nodes(privateTree).filter(node=>node.type==='button'||node.props?.type==='range').length,0,'Read-only card has no edit/delete/progress action');

const editorHooks=hooks(),writes=[],editorModule=load('app/work/tasks/work-personal.tsx',{'react':editorHooks.react,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':icons,'@/components/cabinet-panel':{},'./work-records':records,'./work-ui':{...ui,workApi:async(path,method,body)=>{writes.push({path,method,body});throw Error('timeout')}}},{},'\nexport {TaskEditor};');
const editProps={task,scope:'assigned',people:[],onClose(){},onSaved(){}};
await nodes(editorHooks.render(editorModule.TaskEditor,editProps)).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});
assert.equal('checklist' in writes[0].body,false,'Editing title/date does not recalculate manually set progress');
const newHooks=hooks(),newModule=load('app/work/tasks/work-personal.tsx',{'react':newHooks.react,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':icons,'@/components/cabinet-panel':{},'./work-records':records,'./work-ui':{...ui,workApi:async(path,method,body)=>{writes.push({path,method,body});throw Error('timeout')}}},{},'\nexport {TaskEditor};');
const newProps={task:null,scope:'private',people:[],onClose(){},onSaved(){}};
for(let i=0;i<2;i++)await nodes(newHooks.render(newModule.TaskEditor,newProps)).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});
assert.equal(writes[1].body.id,writes[2].body.id,'Retry after uncertain creation uses the same idempotency ID');
assert.equal('assigneeId' in writes[1].body,false,'Private task cannot submit an arbitrary assignee');
assert.equal(writes[1].body.scope,'private');
let epoch=1,events=0;const network=[];
const apiModule=load('app/work/tasks/work-ui.tsx',{'react':{},'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':icons,'@/components/shoot-photo':{},'@/lib/work-data-cache':{workDataEpoch:()=>epoch}},{AbortController,Event,window:{dispatchEvent(){events++}},fetch:(path,options)=>new Promise(resolve=>network.push({path,options,resolve}))});
const saved=apiModule.workApi('/api/work/tasks/t1','PATCH',{version:3,progress:100});
network[0].resolve({ok:true,json:async()=>({task:{...task,version:4}})});await saved;
assert.equal(events,1);assert.equal(epoch,1,'Successful Work write revalidates without blanking active cached readers');
assert.equal(network[0].options.cache,'no-store');
const oldAccount=apiModule.workApi('/api/work/tasks/t1');epoch++;
network[1].resolve({ok:true,json:async()=>({task})});await assert.rejects(oldAccount,/მდგომარეობა შეიცვალა/);
assert.equal(events,1,'Late response from an old session is discarded');
console.log('PASS Work web: optimistic moves/tasks, 409 rollback, founder-stage protection, pending-write dedupe, fresh pagination merge, private/read-only controls, unchanged-checklist progress preservation, stable create retries, session-bound responses.');
