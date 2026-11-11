import Constants from 'expo-constants';
import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {api} from './api';
import {resourceEpoch} from './resource-cache';
import type {DevicePushToken} from 'expo-notifications';
const TOKEN='hm-push-token-v1';
type Registration={token:string;userId:string};
async function storedRegistration():Promise<Registration|null>{const raw=await SecureStore.getItemAsync(TOKEN);if(!raw)return null;try{const saved=JSON.parse(raw) as Registration;return typeof saved.token==='string'&&typeof saved.userId==='string'?saved:null}catch{return {token:raw,userId:''}}}
export async function hasRegisteredPush(userId:string){return (await storedRegistration())?.userId===userId}
export async function prepareNotificationChannels(){
 if(Constants.executionEnvironment==='storeClient'||Platform.OS!=='android')return;
 const N=await import('expo-notifications');
 for(const id of ['messages','calls','work','attendance'])await N.setNotificationChannelAsync(id,{name:id==='calls'?'ზარები':id==='attendance'?'დასწრება და კალენდარი':'შეტყობინებები',importance:N.AndroidImportance.HIGH,sound:'default',vibrationPattern:[0,200,100,200]});
}
export async function registerPush(userId?:string,devicePushToken?:DevicePushToken){
 if(Constants.executionEnvironment==='storeClient'||!userId)return false;
 const epoch=resourceEpoch();
 // A free Apple Personal Team cannot provision APNs. Local reminders and
 // unread badges still work; do not request an impossible token.
 if(Platform.OS==='ios'&&Constants.expoConfig?.extra?.personalTeamBuild)return false;
 const N=await import('expo-notifications');
 await prepareNotificationChannels();
 const permission=await N.getPermissionsAsync();if(!permission.granted)return false;
 const projectId=Constants.expoConfig?.extra?.eas?.projectId||Constants.easConfig?.projectId;if(!projectId)return false;
 const result=await N.getExpoPushTokenAsync({projectId,devicePushToken});if(epoch!==resourceEpoch())return false;
 await api('/api/mobile/push',{method:'POST',body:{token:result.data}});if(epoch!==resourceEpoch())return false;
 await SecureStore.setItemAsync(TOKEN,JSON.stringify({token:result.data,userId}));return true;
}
export async function unregisterPush(request=api){const saved=await storedRegistration();if(saved){await request('/api/mobile/push',{method:'DELETE',body:{token:saved.token}});await SecureStore.deleteItemAsync(TOKEN)}if(Constants.executionEnvironment!=='storeClient'){const N=await import('expo-notifications');await N.dismissAllNotificationsAsync();await N.setBadgeCountAsync(0)}}
