import {useCallTone} from '../lib/use-call-tone';
import {useResource} from '../lib/use-resource';
import {setResource} from '../lib/resource-cache';
import * as Haptics from 'expo-haptics';
import {useEffect,useState} from 'react';
import {AppState,Pressable,Text,View} from 'react-native';
import {router,usePathname} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {api} from '../lib/api';
import {useAuth} from '../lib/auth';
import type {WorkCall} from '../lib/types';
import {Icon,S,C} from './components';
export function CallLifecycle(){const prefs=useResource<{mutedIds:string[]}>('/api/chat/preferences',10000);const {session}=useAuth(),approved=session?.permissions?.isApprovedStaff,userId=session?.user.userId,path=usePathname(),insets=useSafeAreaInsets(),[incoming,setIncoming]=useState<{recipientId:string;call:WorkCall|null}|null>(null),[dismissed,setDismissed]=useState<string[]>([]);
 useEffect(()=>{if(!approved||!userId)return;let cancelled=false,lastBeat=0,timer:ReturnType<typeof setTimeout>|undefined;async function poll(){if(cancelled)return;try{if(AppState.currentState==='active'){if(Date.now()-lastBeat>30000){lastBeat=Date.now();void api('/api/chat/presence',{method:'POST',body:{}}).catch(()=>{})}const data=await api<{calls:WorkCall[]}>('/api/chat/calls');if(!cancelled)setIncoming({recipientId:userId!,call:data.calls.find(c=>c.createdBy!==userId&&!c.ended&&Date.now()<(c.ringUntil??c.created+30000))||null})}}catch{}if(!cancelled)timer=setTimeout(()=>void poll(),1500)}void poll();return()=>{cancelled=true;if(timer)clearTimeout(timer)}},[approved,userId]);
 const call=incoming&&incoming.recipientId===userId?incoming.call:null;
 useEffect(()=>{if(!call)return;const timer=setTimeout(()=>setIncoming(old=>old?.call?.id===call.id?null:old),Math.max(0,(call.ringUntil??call.created+30000)-Date.now()));return()=>clearTimeout(timer)},[call]);
 const muted=!!call&&!!prefs.data?.mutedIds.includes(call.conversationId);
 const audible=approved&&!muted&&call&&!path.startsWith('/call/')&&!dismissed.includes(call.id)?call.id:null;
 useCallTone(audible?'incoming':null);
 useEffect(()=>{if(audible&&AppState.currentState==='active')void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{})},[audible]);
 if(!approved||muted||!call||path.startsWith('/call/')||dismissed.includes(call.id))return null;
 return <View style={{position:'absolute',top:insets.top+8,left:12,right:12,zIndex:999,elevation:10,padding:14,borderRadius:22,backgroundColor:'#173b4c',borderWidth:1,borderColor:C.line}}><View style={S.row}><Icon name={call.mode==='audio'?'call':'videocam'} color={C.green}/><View style={{flex:1}}><Text style={[S.text,{fontSize:14}]}>{call.creatorName}</Text><Text style={[S.muted,{fontSize:11}]}>{(call.isGroup?'გუნდური ':'')+(call.mode==='audio'?'აუდიოზარი':'ვიდეოზარი')}</Text></View><Pressable accessibilityLabel="უარყოფა" style={{padding:10}} onPress={()=>{setDismissed(old=>[...old,call.id]);void api('/api/chat/calls',{method:'PATCH',body:{id:call.id,action:'declined'}}).catch(()=>{})}}><Icon name="close-circle" color={C.red} size={32}/></Pressable><Pressable accessibilityLabel="ზარის მიღება" style={{padding:10}} onPress={()=>{setDismissed(old=>[...old,call.id]);setResource('/api/chat/calls?id='+encodeURIComponent(call.id),{call});router.push({pathname:'/call/[id]',params:{id:call.id}})}}><Icon name={call.mode==='audio'?'call':'videocam'} color={C.green} size={30}/></Pressable></View></View>
}
