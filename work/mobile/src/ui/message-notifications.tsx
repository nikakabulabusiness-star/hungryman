import {useEffect,useRef} from 'react';
import {AppState,Alert} from 'react-native';
import {router} from 'expo-router';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {api} from '../lib/api';
import {registerPush} from '../lib/push-notifications';
import {refreshResource,resourceEntry,subscribeResource} from '../lib/resource-cache';
import {useAuth} from '../lib/auth';
import {openNotice,type NoticeCounts} from './notification-center';
import {cancelTodayReminder} from '../lib/location';

// SDK 58 shows foreground system banners by default. Install this synchronously,
// before mounting the signed-in screens or waiting for a network request.
Notifications.setNotificationHandler({handleNotification:async()=>({
 shouldShowBanner:false,shouldShowList:false,shouldPlaySound:false,shouldSetBadge:false,
})});

export function MessageNotifications(){
 const {session}=useAuth(),id=session?.user.userId,approved=session?.permissions?.isApprovedStaff,preview=session?.permissions?.previewRole,handled=useRef(new Set<string>());
 useEffect(()=>{
  if(!approved||!id)return;
  let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
  const native=Constants.executionEnvironment!=='storeClient';
  const refreshCounts=()=>refreshResource('/api/notifications?counts=1');
  async function poll(){if(stopped)return;if(AppState.currentState==='active')await refreshCounts();if(!stopped)timer=setTimeout(()=>void poll(),5000)}
  const syncBadge=()=>{
   const counts=resourceEntry<NoticeCounts>('/api/notifications?counts=1').data;
   if(native&&counts)void Notifications.setBadgeCountAsync(counts.unread+counts.chatUnread).catch(()=>{});
  };
  const unsubscribe=subscribeResource('/api/notifications?counts=1',syncBadge);
  syncBadge();void poll();
  const wake=AppState.addEventListener('change',state=>{if(state==='active'){void refreshCounts();if(native)void registerPush(id).catch(()=>{})}});
  const handle=async(r:Notifications.NotificationResponse)=>{
   const key=id+':'+r.notification.request.identifier+':'+r.actionIdentifier;
   if(stopped||handled.current.has(key))return;
   const data=r.notification.request.content.data||{};
   if(typeof data.recipientUserId==='string'&&data.recipientUserId!==id){await Notifications.clearLastNotificationResponseAsync();return}
   handled.current.add(key);
   // Keep the deduplication set bounded during long-running sessions.
   if(handled.current.size>200)handled.current.delete(handled.current.values().next().value!);
   await Notifications.clearLastNotificationResponseAsync();
   await Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(()=>{});
   if(['late','absent','remote'].includes(r.actionIdentifier)&&data.attendance===true){
    try{
     await api('/api/attendance/requests',{method:'POST',body:{answer:r.actionIdentifier,date:data.date}});
     await cancelTodayReminder();
     await Promise.all([refreshResource('/api/attendance'),refreshCounts()]);
     if(!stopped)router.push('/profile');
    }catch(e){if(!stopped){Alert.alert('დასწრების პასუხი',(e as Error).message);router.push('/profile')}}
    return;
   }
   if(typeof data.notificationId==='string')void api('/api/notifications',{method:'PATCH',body:{id:data.notificationId}}).then(()=>Promise.all([refreshCounts(),refreshResource('/api/notifications')])).catch(()=>{});
   if(stopped)return;
   if(typeof data.callId==='string'&&/^[a-f\d-]{36}$/i.test(data.callId)){router.push({pathname:'/call/[id]',params:{id:data.callId}});return}
   if(typeof data.conversationId==='string'){openNotice({target:'chat',target_id:data.conversationId});return}
   openNotice({target:typeof data.target==='string'?data.target:data.attendance?'attendance':'notifications',target_id:typeof data.targetId==='string'?data.targetId:''});
  };
  const response=native?Notifications.addNotificationResponseReceivedListener(r=>void handle(r)):undefined;
  const receipt=native?Notifications.addNotificationReceivedListener(()=>{void refreshCounts();void refreshResource('/api/notifications')}):undefined;
  const token=native?Notifications.addPushTokenListener(value=>void registerPush(id,value).catch(()=>{})):undefined;
  if(native){void Notifications.getLastNotificationResponseAsync().then(last=>{if(last&&!stopped)return handle(last)}).catch(()=>{});void registerPush(id).catch(()=>{})}
  return()=>{stopped=true;if(timer)clearTimeout(timer);wake.remove();unsubscribe();response?.remove();receipt?.remove();token?.remove()};
 },[approved,id,preview]);return null;
}
