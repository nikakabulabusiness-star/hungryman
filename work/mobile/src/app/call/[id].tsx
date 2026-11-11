import {useCallTone} from '../../lib/use-call-tone';
import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState,PermissionsAndroid,Platform,Linking,Pressable,Text,View} from 'react-native';
import {WebView} from 'react-native-webview';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router,useLocalSearchParams} from 'expo-router';
import * as Crypto from 'expo-crypto';
import {api,ApiError,API_ORIGIN} from '../../lib/api';
import {CALL_DOCUMENT} from '../../lib/call-document';
import {useAuth} from '../../lib/auth';
import {useResource} from '../../lib/use-resource';
import type {WorkCall} from '../../lib/types';
import {Icon,State,S,C} from '../../ui/components';

// Ship the media engine with the app. A remote HTML request/redirect must not
// strand a native call screen before the bridge can initialize.
const source={html:CALL_DOCUMENT,baseUrl:API_ORIGIN+'/'};
const js=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\u003c');
export default function WorkCallScreen(){
 const {id}=useLocalSearchParams<{id:string}>(),{session}=useAuth();
 const r=useResource<{call:WorkCall}>('/api/chat/calls?id='+encodeURIComponent(id));
 const call=r.data?.call,conversationId=call?.conversationId;
 const [sessionId,setSessionId]=useState(()=>Crypto.randomUUID());
 const activeSession=useRef(sessionId),mediaStarted=useRef(false);
 const [ringing,setRinging]=useState(false);useCallTone(ringing?'outgoing':null);
 const [ready,setReady]=useState(false),[failure,setFailure]=useState(''),[mediaStopped,setMediaStopped]=useState(false);
 const web=useRef<WebView<Record<string,unknown>>>(null),closed=useRef(false);
 const [mediaAllowed,setMediaAllowed]=useState(Platform.OS!=='android');
 const [permissionError,setPermissionError]=useState('');
 const stop=useCallback(()=>{
  setRinging(false);web.current?.injectJavaScript('window.__hmStop&&window.__hmStop(false);true;');
 },[]);
 const leave=useCallback((notifyServer=true)=>{
  if(closed.current)return;closed.current=true;stop();
  if(notifyServer)void api('/api/chat/calls',{method:'PATCH',body:{id,action:'left'}}).catch(()=>{});
  if(conversationId)router.replace({pathname:'/conversation/[id]',params:{id:conversationId}});
  else router.back();
 },[conversationId,id,stop]);
 useEffect(()=>{if(call?.ended)leave(false)},[call?.ended,leave]);
 useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state==='background')leave()});return()=>listener.remove()},[leave]);
 useEffect(()=>()=>{if(!closed.current&&activeSession.current===sessionId)void api('/api/chat/calls/session',{method:'POST',body:{id,sessionId,action:'leave'}}).catch(()=>{})},[id,sessionId]);
 const requestPermissions=useCallback(async()=>{
  if(Platform.OS!=='android'||!call||call.ended||closed.current)return;
  // Microphone is the only prerequisite. WebView requests camera separately
  // when the video track starts, so denying video never blocks a voice call.
  const microphone=PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  try{const allowed=await PermissionsAndroid.check(microphone)||await PermissionsAndroid.request(microphone)===PermissionsAndroid.RESULTS.GRANTED;setMediaAllowed(allowed);setPermissionError(allowed?'':'ზარისთვის დაუშვი მიკროფონის გამოყენება.');}
  catch{setPermissionError('კამერასა და მიკროფონზე წვდომა ვერ ჩაირთო.');}
 },[call]);
 useEffect(()=>{let mounted=true;void Promise.resolve().then(()=>{if(mounted)return requestPermissions()});const listener=AppState.addEventListener('change',state=>{if(state==='active')void requestPermissions()});return()=>{mounted=false;listener.remove()}},[requestPermissions]);
 const initialize=useCallback(()=>{
  if(!call||call.ended||closed.current)return;
  web.current?.injectJavaScript('window.__hmInit&&window.__hmInit('+js({sessionId,userId:session?.user.userId,selfName:session?.user.fullName||'შენ',layout:'mobile',mode:call.mode,name:call.conversationId==='team'?'საერთო ჩატი':call.creatorName,isGroup:call.isGroup??!call.conversationId.startsWith('dm_'),ringUntil:call.ringUntil??call.created+30000,answeredAt:call.answeredAt??null,autoJoin:true,outgoing:call.createdBy===session?.user.userId})+');true;');
 },[call,sessionId,session?.user.userId,session?.user.fullName]);
 useEffect(()=>{
  if(!call||call.ended||!mediaAllowed||ready)return;
  const timer=setTimeout(()=>setFailure('ზარის ეკრანი ვერ გაეშვა. სცადე ხელახლა.'),12000);
  return()=>clearTimeout(timer);
 },[call,mediaAllowed,ready,sessionId]);
 function retry(){stop();mediaStarted.current=false;setMediaStopped(false);setReady(false);setFailure('');const next=Crypto.randomUUID();activeSession.current=next;setSessionId(next);}
 return <SafeAreaView style={{flex:1,backgroundColor:'#07121f'}}>
  {(!ready||mediaStopped||failure||r.error||call?.ended||!mediaAllowed)&&<View style={[S.row,{padding:14}]}><Pressable accessibilityLabel="ზარის დატოვება" onPress={()=>leave()} style={S.icon}><Icon name="chevron-back"/></Pressable><Text style={[S.text,{flex:1}]}>{call?.mode==='audio'?'აუდიოზარი':'ვიდეოზარი'}</Text><Pressable accessibilityLabel="ზარის დასრულება" onPress={()=>leave()} style={{padding:12}}><Icon name="call" color={C.red}/></Pressable></View>}
  {r.error?<State error={r.error} retry={r.refresh}/>:!call?<State loading/>:call.ended?<State empty="ზარი დასრულებულია"/>:!mediaAllowed?<State error={permissionError||undefined} loading={!permissionError} retry={()=>void Linking.openSettings()}/>:<View style={{flex:1}}>
   <WebView<Record<string,unknown>> key={sessionId} ref={web} source={source} style={{flex:1,backgroundColor:'#07121f'}} originWhitelist={['*']} javaScriptEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} mediaCapturePermissionGrantType="grantIfSameHostElseDeny" allowsFullscreenVideo={false} javaScriptCanOpenWindowsAutomatically={false}
    onShouldStartLoadWithRequest={request=>['about:blank',API_ORIGIN,API_ORIGIN+'/'].includes(request.url)}
    onOpenWindow={()=>{}} onLoadEnd={initialize}
    onError={()=>setFailure('ზარის ეკრანი ვერ ჩაიტვირთა.')}
    onContentProcessDidTerminate={()=>setFailure('ზარის ეკრანი შეჩერდა. სცადე ხელახლა.')}
    onRenderProcessGone={()=>setFailure('ზარის ეკრანი შეჩერდა. სცადე ხელახლა.')}
    onMessage={event=>{
     let value:{ready?:boolean;initialized?:boolean;connected?:boolean;stopped?:boolean;mediaStarting?:boolean;ringback?:boolean;fatal?:boolean;ended?:boolean;leave?:boolean;rpc?:string;action?:string;args?:Record<string,unknown>};
     try{value=JSON.parse(event.nativeEvent.data)}catch{return}
     if(closed.current||activeSession.current!==sessionId)return;
     if(value.ready){initialize();return}
     if(value.mediaStarting){mediaStarted.current=true;setRinging(false);return}
     if(value.connected||value.stopped){setRinging(false);setMediaStopped(!!value.stopped);return}
     if(value.ringback){setMediaStopped(false);if(!mediaStarted.current)setRinging(true);return}
     if(value.initialized){setReady(true);setFailure('');return}
     if(value.fatal){setFailure('ზარის გაშვება შეფერხდა. სცადე ხელახლა.');return}
     if(value.ended){leave(false);return}
     if(value.leave){leave();return}
     if(!value.rpc||!['join','poll','signal','leave','avatar'].includes(value.action||''))return;
     const key=value.rpc,action=value.action!,args=value.args||{};
     const request=action==='avatar'?api('/api/chat/calls/avatar?id='+encodeURIComponent(id)+'&sessionId='+sessionId+'&userId='+encodeURIComponent(String(args.userId||session?.user.userId||''))):action==='poll'?api('/api/chat/calls/session?id='+encodeURIComponent(id)+'&sessionId='+sessionId+'&after='+Number(args.after||0)):api('/api/chat/calls/session',{method:'POST',body:{...args,id,sessionId,action}});
     void request.then(data=>{if(!closed.current&&activeSession.current===sessionId){if((data as {ended?:boolean})?.ended===true){leave(false);return}web.current?.injectJavaScript('window.__hmReply&&window.__hmReply('+js(key)+','+js(data)+');true;')}}).catch(error=>{if(!closed.current&&activeSession.current===sessionId){if(error instanceof ApiError&&action!=='avatar'&&([404,410].includes(error.status)||(error.status===409&&['join','poll'].includes(action)))){leave(false);return}web.current?.injectJavaScript('window.__hmReply&&window.__hmReply('+js(key)+',null,'+js(error.message)+','+(error instanceof ApiError?error.status:0)+');true;')}});
    }}/>
   {(!ready||failure)&&<View style={{position:'absolute',inset:0,backgroundColor:'#07121f',justifyContent:'center'}}><State loading={!failure} error={failure||undefined} retry={retry}/></View>}
  </View>}
 </SafeAreaView>;
}
