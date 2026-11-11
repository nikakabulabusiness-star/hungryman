import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=ts.transpileModule(fs.readFileSync('mobile/src/app/call/[id].tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve()};
function harness({os='ios',granted=true,initialData=true,isGroup=false}={}){
 const states=[],refs=[],effects=[],pending=[],requests=[],routes=[],injected=[],permissionRequests=[],listeners=[],toneKinds=[];
 const call={id:'call-1',conversationId:isGroup?'group_a':'dm_a',mode:'video',createdBy:'caller',creatorName:'Caller',created:100,ended:null,isGroup,ringUntil:30100,answeredAt:null};
 const resource={data:initialData?{call}:null,error:'',refresh(){}},apiState={signalStatus:200,avatarStatus:200};
 let cursor=0,tree,uuid=0;
 const hooks={
  useState(value){const i=cursor++;if(!(i in states))states[i]=typeof value==='function'?value():value;return [states[i],next=>states[i]=typeof next==='function'?next(states[i]):next]},
  useRef(value){const i=cursor++;return refs[i]??=( {current:value} )},
  useCallback(fn){cursor++;return fn},
  useEffect(fn,deps){const i=cursor++,old=effects[i];if(old&&deps.every((d,j)=>d===old.deps[j]))return;pending.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:fn()}})},
 };
 // useCallback identity follows dependencies, like React, so a metadata arrival
 // exercises cleanup without spuriously changing every effect on every render.
 const callbacks=[];hooks.useCallback=(fn,deps)=>{const i=cursor++,old=callbacks[i];if(old&&deps.every((d,j)=>d===old.deps[j]))return old.fn;callbacks[i]={deps,fn};return fn};
 class ApiError extends Error{constructor(status){super('API failed');this.status=status}}
 const modules={
  react:hooks,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
  'react-native':{AppState:{currentState:'active',addEventListener(_,fn){listeners.push(fn);return{remove(){listeners.splice(listeners.indexOf(fn),1)}}}},PermissionsAndroid:{PERMISSIONS:{RECORD_AUDIO:'mic',CAMERA:'camera'},RESULTS:{GRANTED:'granted'},check:async()=>granted,request:async value=>{permissionRequests.push(value);return 'granted'}},Platform:{OS:os},Linking:{openSettings(){}},Pressable:'Pressable',Text:'Text',View:'View'},
  'react-native-webview':{WebView:'WebView'},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
  'expo-router':{router:{replace:value=>routes.push(value),back:()=>routes.push('back')},useLocalSearchParams:()=>({id:'call-1'})},'expo-crypto':{randomUUID:()=>`session-${++uuid}`},
  '../../lib/api':{API_ORIGIN:'https://work.test',ApiError,api:async(path,options)=>{requests.push({path,...options});if(options?.body?.action==='signal'&&apiState.signalStatus>=400)throw new ApiError(apiState.signalStatus);if(path.startsWith('/api/chat/calls/avatar')&&apiState.avatarStatus>=400)throw new ApiError(apiState.avatarStatus);return {ok:true}}},'../../lib/call-document':{CALL_DOCUMENT:'<!doctype html>'},
  '../../lib/auth':{useAuth:()=>({session:{user:{userId:'caller',fullName:'Caller'}}})},'../../lib/use-resource':{useResource:()=>resource},'../../lib/use-call-tone':{useCallTone:kind=>toneKinds.push(kind)},
  '../../ui/components':{Icon:'Icon',State:'State',S:{row:{},text:{},icon:{}},C:{red:'red'}},
 };
 const exports={};vm.runInNewContext(source,{exports,require:name=>{assert.ok(name in modules,name);return modules[name]},setTimeout:()=>1,clearTimeout(){}});
 const find=(type,node=tree)=>{if(!node||typeof node!=='object')return null;if(node.type===type)return node;for(const child of [node.props?.children].flat(Infinity)){if(!child)continue;const found=find(type,child);if(found)return found}return null};
 const render=()=>{cursor=0;tree=exports.default();const web=find('WebView');if(web)web.props.ref.current={injectJavaScript:code=>injected.push(code)};while(pending.length)pending.shift()();return tree};
 const emit=value=>find('WebView').props.onMessage({nativeEvent:{data:JSON.stringify(value)}});
 const unmount=()=>effects.forEach(effect=>effect?.cleanup?.());
 render();return {render,find,emit,unmount,requests,routes,injected,permissionRequests,toneKinds,call,resource,listeners,apiState};
}

{
 const h=harness();await settle();const web=h.find('WebView');assert.equal(web.props.mediaCapturePermissionGrantType,'grantIfSameHostElseDeny');assert.equal(web.props.onShouldStartLoadWithRequest({url:'https://evil.test'}),false);assert.equal(web.props.onShouldStartLoadWithRequest({url:'https://work.test/'}),true);
 web.props.onLoadEnd();assert.match(h.injected.at(-1),/"isGroup":false/);assert.match(h.injected.at(-1),/"ringUntil":30100/);
 h.emit({mediaStarting:true});h.emit({ringback:true});h.render();assert.equal(h.toneKinds.at(-1),null,'native player cannot restart after media capture');
 h.emit({ended:true});h.unmount();assert.equal(h.routes.at(-1).params.id,'dm_a');assert.equal(h.requests.length,0,'remote end closes without redundant leave/end mutation');assert.match(h.injected.at(-1),/__hmStop\(false\)/);
}
for(const isGroup of [false,true]){
 const h=harness({isGroup});h.emit({leave:true});h.emit({leave:true});h.unmount();assert.equal(h.requests.length,1,'hangup mutation happens once');assert.equal(h.requests[0].body.action,'left','server applies direct/group lifecycle, including creator leave');assert.equal(h.routes.length,1);
}
for(const granted of [false,true]){
 const h=harness({os:'android',granted});await settle();h.render();assert.ok(h.find('WebView'),'microphone permission alone allows video-call audio to start');assert.deepEqual(h.permissionRequests,granted?[]:['mic'],'granted permission is reused; camera does not gate audio');
}
{
 const h=harness({initialData:false});assert.equal(h.find('WebView'),null);h.resource.data={call:h.call};h.render();await settle();assert.equal(h.requests.length,0,'call metadata arrival must not run session-leave cleanup');
 const oldHandler=h.find('WebView').props.onMessage,overlay=h.find('State');overlay.props.retry();h.render();oldHandler({nativeEvent:{data:JSON.stringify({rpc:'old-join',action:'join'})}});await settle();assert.equal(h.requests.length,0,'media retry replaces the local session without ending direct call or letting an old bridge reclaim the session');
}
{
 const h=harness({isGroup:true});h.apiState.signalStatus=409;h.emit({rpc:'signal-left',action:'signal',args:{target:'departed-caller'}});await settle();assert.equal(h.routes.length,0,'departed group peer cannot close other participants');assert.match(h.injected.at(-1),/409/,'peer conflict is returned to media engine for recovery');assert.equal(h.requests.filter(r=>r.method==='PATCH').length,0);
 h.apiState.avatarStatus=404;h.emit({rpc:'photo-left',action:'avatar',args:{userId:'departed-caller'}});await settle();assert.equal(h.routes.length,0,'departed peer avatar is optional and cannot terminate group call');
}
console.log('PASS native origin-bound media permissions, microphone-only Android startup, grant reuse, tone/capture exclusion, return-to-chat, idempotent direct/group hangup and retry cleanup.');
