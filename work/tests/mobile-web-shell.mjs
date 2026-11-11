import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

let actor,allowed=new Set();
const modules=new Map();
function load(file){
 if(modules.has(file))return modules.get(file);
 const exports={};modules.set(file,exports);
 const require=name=>{
  if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(name==='next/navigation')return {notFound:()=>{throw Error('NOT_FOUND')}};
  if(name==='@/lib/staff-access')return {requireApprovedStaff:async()=>actor};
  if(name==='@/lib/chat')return {threadAllowed:async id=>allowed.has(id)};
  if(name==='@/lib/shoots')return {getNextShoot:async()=>null};
  if(name==='@/app/team/staff-header'||name==='./chat-workspace')return {default:()=>null};
  if(name.startsWith('@/')||name.startsWith('.')){
   const base=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);
   return load(fs.existsSync(base+'.ts')?base+'.ts':base+'.tsx');
  }
  throw Error('Unexpected import '+name);
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require,Date,Intl,console});
 return exports;
}
const {workTabs,isWorkRoute,workTabForPath}=load('lib/work-navigation.ts');
actor={isApproved:true,permissions:['workspace.view','chat.view','shoots.view','cabinet.view']};
assert.equal(workTabs(actor).map(tab=>tab.id).join(','),'home,shoots,chat,team');
assert.equal(workTabs({...actor,isApproved:false}).length,0);
assert.equal(workTabs({...actor,features:{shoots:false}}).some(tab=>tab.id==='shoots'),false);
assert.equal(workTabs({...actor,features:{removedPermissions:['cabinet.view']}}).some(tab=>tab.id==='team'),false);
assert.equal(workTabs({...actor,features:{teamChat:false,privateChats:false,groups:false}}).some(tab=>tab.id==='chat'),false);
assert.equal(workTabs({...actor,features:{teamChat:false}}).some(tab=>tab.id==='chat'),true);
assert.equal(workTabs({isDeveloper:true,features:{removedPermissions:['shoots.view']}}).some(tab=>tab.id==='shoots'),false);
assert.equal(workTabs({isApproved:true,permissions:['workspace.view','admin.view']}).find(tab=>tab.id==='manage')?.href,'/work/manage');
for(const route of ['/team/auth','/chat/embed','/work/Hungryman-Work.apk','/apply','/'])assert.equal(isWorkRoute(route),false,route);
for(const route of ['/work','/work/manage','/work/calendar','/chat','/team/map','/admin/access'])assert.equal(isWorkRoute(route),true,route);
assert.equal(workTabForPath('/work/calendar'),'home');
assert.equal(workTabForPath('/admin/access'),'manage');

const ChatPage=load('app/chat/page.tsx').default;
actor={isApproved:true,permissions:['workspace.view','chat.view'],features:{teamChat:false}};
allowed=new Set(['dm_allowed']);
let page=await ChatPage({searchParams:Promise.resolve({})});
let chat=page.props.children[1].props.children;
assert.equal(chat.props.initialId,'','disabled team leaves selection to authorized directory');
assert.equal(chat.props.startWithList,true,'phone landing opens conversations');
page=await ChatPage({searchParams:Promise.resolve({conversationId:'dm_allowed'})});
chat=page.props.children[1].props.children;
assert.equal(chat.props.initialId,'dm_allowed');
assert.equal(chat.props.startWithList,false);
await assert.rejects(()=>ChatPage({searchParams:Promise.resolve({conversationId:'dm_forbidden'})}),/NOT_FOUND/);
actor={isApproved:true,permissions:['workspace.view']};
await assert.rejects(()=>ChatPage({searchParams:Promise.resolve({})}),/NOT_FOUND/);
console.log('PASS mobile tabs respect permissions/removals; public routes stay unchanged; chat landing survives disabled team without bypassing explicit thread authorization.');

// The actual shell must leave browser navigation intact even when the client router fails.
const effects=[],stateChanges=[],accountChanges=[],shellState=[],countSubscriptions=[];
let shellPath='/work',shellCursor=0;
const browserEvents=new Map(),browserWindow={addEventListener:(name,fn)=>{if(!browserEvents.has(name))browserEvents.set(name,new Set());browserEvents.get(name).add(fn)},removeEventListener:(name,fn)=>browserEvents.get(name)?.delete(fn),dispatchEvent:event=>{for(const fn of [...(browserEvents.get(event.type)||[])])fn(event);return true}};
class BrowserEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const sharedCounts={unread:0,requests:0,chatUnread:105};
const shellExports={};
const shellRequire=name=>{
 if(name==='react')return {useEffect:fn=>effects.push(fn),useState:initial=>{const index=shellCursor++;if(!(index in shellState))shellState[index]=index===0?true:initial;return [shellState[index],value=>{stateChanges.push(value);shellState[index]=typeof value==='function'?value(shellState[index]):value}]},useSyncExternalStore:(_subscribe,snapshot)=>snapshot()};
 if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 if(name==='next/navigation')return {usePathname:()=>shellPath};
 if(name==='lucide-react')return new Proxy({}, {get:(_,key)=>String(key)});
 if(name==='@/lib/permissions')return load('lib/permissions.ts');
 if(name==='@/lib/work-navigation')return load('lib/work-navigation.ts');
 if(name==='@/lib/work-mobile')return load('lib/work-mobile.ts');
 if(name==='@/lib/notification-policy')return {canReviewRequests:()=>false};
 if(name==='@/lib/work-data-cache')return {setWorkDataAccount:id=>accountChanges.push(id)};
 if(name==='./work-notifications')return {NotificationButtons:'NotificationButtons',useNotificationCounts:enabled=>{countSubscriptions.push(enabled);return enabled?sharedCounts:{unread:0,requests:0,chatUnread:0}}};
 if(name==='@/app/team/logout-button')return {default:'LogoutButton'};
 if(name.endsWith('.css'))return {};
 throw Error('Unexpected shell dependency '+name);
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/work-mobile-shell.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:shellExports,require:shellRequire,Date,Set,encodeURIComponent,window:browserWindow,Event:BrowserEvent,CustomEvent:BrowserEvent,document:{querySelector:()=>null}});
actor={isApproved:true,permissions:['workspace.view','chat.view','shoots.view','cabinet.view']};
shellExports.WorkSessionSeed({session:{user:{userId:'viewer',fullName:'Viewer',hasAvatar:false,profileUpdated:0},permissions:actor}});effects.pop()();
assert.equal(accountChanges.at(-1),'viewer');
function nodes(node){if(!node||typeof node!=='object')return [];return [node,...[node.props?.children].flat(Infinity).flatMap(nodes)];}
function renderShell(){shellCursor=0;effects.length=0;return shellExports.default()}
let rendered=renderShell(),nav=nodes(rendered).find(n=>n.type==='nav');
assert.ok(nav);
const links=nodes(nav).filter(n=>n.type==='a');
assert.deepEqual(Array.from(links,n=>n.props.href),['/work','/shoots','/chat','/team']);
assert.equal(nodes(links[2]).find(n=>n.props.className==='hm-mobile-tab-badge')?.props.children,'99+','native tab caps unread badge');
assert.match(links[2].props['aria-label'],/105/,'accessible badge announces actual unread count');
const event={defaultPrevented:false,button:0,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,currentTarget:{getAttribute:()=>'/chat'},preventDefault:()=>{throw Error('Navigation must not be cancelled')}};
links[2].props.onClick(event);assert.equal(stateChanges.at(-1),'/chat');
const changes=stateChanges.length;links[2].props.onClick({...event,metaKey:true});assert.equal(stateChanges.length,changes,'modifier clicks preserve browser behavior');
shellPath='/work/';rendered=renderShell();assert.ok(nodes(rendered).some(n=>n.type==='nav'),'trailing slash keeps working navigation');

// Exercise the real workspace's handlers against the shell events and permission snapshot.
const workspaceExports={},workspaceState=[],workspaceEffects=[];
let workspaceCursor=0,workspacePermissions={canDirect:true,canCreateGroups:true},workspaceCleanup;
const workspaceRequire=name=>{
 if(name==='react')return {useEffect:fn=>workspaceEffects.push(fn),useCallback:fn=>fn,useRef:value=>({current:value}),useState:initial=>{const index=workspaceCursor++;if(!(index in workspaceState))workspaceState[index]=initial;return [workspaceState[index],value=>{workspaceState[index]=typeof value==='function'?value(workspaceState[index]):value}]}};
 if(name==='react/jsx-runtime')return shellRequire(name);
 if(name==='lucide-react')return new Proxy({}, {get:(_,key)=>String(key)});
 if(name==='@/lib/department-directory')return {roleLabel:value=>value};
 if(name==='@/lib/work-mobile')return load('lib/work-mobile.ts');
 if(name==='./chat-client')return {default:'ChatClient'};
 if(name==='@/components/cabinet-panel')return {useWorkData:()=>({}),workRequest:()=>{throw Error('Dialog opening must not create a conversation')}};
 if(name==='./use-chat-data')return {useChatData:()=>({data:{conversations:[],people:[],departments:[],permissions:workspacePermissions}})};
 if(name==='./chat-memory')return {clearChatMemory:()=>{}};
 if(name.endsWith('.css'))return {};
 throw Error('Unexpected workspace dependency '+name);
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/chat/chat-workspace.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:workspaceExports,require:workspaceRequire,Date,window:browserWindow,CustomEvent:BrowserEvent,Event:BrowserEvent,encodeURIComponent,history:{replaceState:()=>{}}});
function renderWorkspace(){workspaceCursor=0;workspaceEffects.length=0;return workspaceExports.default({currentUserId:'viewer',initialId:'team',startWithList:true})}
function connectWorkspace(){workspaceCleanup?.();workspaceCleanup=workspaceEffects.find(fn=>fn.toString().includes('hmw:chat-compose'))()}
renderWorkspace();connectWorkspace(); // Workspace may mount before global shell.
shellPath='/chat';rendered=renderShell();const chatCleanup=effects.find(fn=>fn.toString().includes('hmw:chat-chrome-request'))();rendered=renderShell();
assert.equal(nodes(rendered).find(n=>n.type==='h1')?.props.children,'ჩატები');
let direct=nodes(rendered).find(n=>n.props['aria-label']==='ახალი პირადი ჩატი'),group=nodes(rendered).find(n=>n.props['aria-label']==='ახალი ჯგუფი');
assert.ok(direct&&group,'permission-bearing workspace enables both native actions even if it mounted first');
direct.props.onClick();assert.equal(workspaceState[2],'direct');assert.ok(nodes(renderWorkspace()).some(n=>n.props.directOnly===true),'direct compose opens existing person dialog');
group.props.onClick();assert.equal(workspaceState[2],'group');assert.ok(nodes(renderWorkspace()).some(n=>n.type?.name==='GroupDialog'),'group compose opens existing group dialog');
workspacePermissions={canDirect:false,canCreateGroups:false};renderWorkspace();connectWorkspace();rendered=renderShell();
assert.equal(nodes(rendered).some(n=>n.props['aria-label']==='ახალი პირადი ჩატი'||n.props['aria-label']==='ახალი ჯგუფი'),false);
workspaceState[2]=null;browserWindow.dispatchEvent(new BrowserEvent('hmw:chat-compose',{detail:{kind:'direct'}}));browserWindow.dispatchEvent(new BrowserEvent('hmw:chat-compose',{detail:{kind:'group'}}));assert.equal(workspaceState[2],null,'denied custom events cannot open dialogs');
workspaceState[3]=false;renderWorkspace();connectWorkspace();rendered=renderShell();assert.equal(nodes(rendered).some(n=>n.type==='nav'||n.props.className==='hm-mobile-topbar'),false,'conversation uses its own header and sits outside tabs');
const conversationNode=nodes(renderWorkspace()).find(n=>n.type==='ChatClient');conversationNode.props.onShowList();renderWorkspace();connectWorkspace();rendered=renderShell();assert.ok(nodes(rendered).some(n=>n.type==='nav'),'actual in-chat back restores tab navigation');
chatCleanup();workspaceCleanup();
const publishShoot=()=>browserWindow.dispatchEvent(new BrowserEvent('hmw:shoot-detail',{detail:{active:true}}));browserWindow.addEventListener('hmw:shoot-detail-request',publishShoot);shellPath='/shoots';rendered=renderShell();const shootCleanup=effects.find(fn=>fn.toString().includes('hmw:shoot-detail'))();rendered=renderShell();assert.equal(nodes(rendered).find(n=>n.type==='h1')?.props.children,'გადაღების დეტალები');assert.equal(nodes(rendered).find(n=>n.props['aria-label']==='უკან')?.props.href,'/shoots');assert.equal(nodes(rendered).some(n=>n.type==='nav'||n.props['aria-label']==='ახალი გადაღება'),false,'shoot detail sits outside tabs and hides list create control');browserWindow.dispatchEvent(new BrowserEvent('hmw:shoot-detail',{detail:{active:false}}));assert.ok(nodes(renderShell()).some(n=>n.type==='nav'),'shoot list restores bottom navigation');shootCleanup();browserWindow.removeEventListener('hmw:shoot-detail-request',publishShoot);
shellExports.WorkSessionSeed({session:{user:{userId:'blocked',fullName:'Blocked'},permissions:{...actor,isApproved:false}}});effects.pop()();assert.equal(renderShell(),null);assert.equal(accountChanges.at(-1),null);assert.equal(countSubscriptions.at(-1),false,'unauthorized shell never starts badge polling');
console.log('PASS shell uses server identity, native browser anchors, immediate click feedback, modifier-safe navigation and revoked-session isolation.');
console.log('PASS shared unread badge, permission-checked native compose/group handlers, conversation back/tab restoration and shoot detail chrome.');
