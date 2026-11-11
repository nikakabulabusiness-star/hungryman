import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import {api,restoreToken,setToken} from './api';
import {buildReminderPlan,isLocalReminder,type ReminderDay} from './reminder-plan';
const GEO='hm-office-boundary-v1',WATCH='hm-office-confirm-v1',KEY='hm-office-opt-in',CONFIG='hm-office-config';
export type Office={name:string;latitude:number;longitude:number;radius:number;checkInAfter:string;reminderTime:string};
function distance(a:number,b:number,c:number,d:number){const r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,q=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 6371000*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))}
export async function currentPosition(){const permission=await Location.requestForegroundPermissionsAsync();if(permission.status!=='granted')throw Error('ლოკაციის გაზიარებისთვის Settings-ში დაუშვი მდებარეობაზე წვდომა.');return Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High})}
export async function currentLocationLink(){const p=await currentPosition();return `📍 ჩემი მდებარეობა\nhttps://www.google.com/maps/search/?api=1&query=${p.coords.latitude},${p.coords.longitude}`}
export async function locationEnabled(){return await SecureStore.getItemAsync(KEY)==='yes'}
export async function confirmOffice(position?:Location.LocationObject){if(!await locationEnabled()||!await restoreToken())return;const raw=await SecureStore.getItemAsync(CONFIG);if(!raw)return;const office=JSON.parse(raw) as Office,p=position||await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced}),d=distance(p.coords.latitude,p.coords.longitude,office.latitude,office.longitude),accuracy=p.coords.accuracy??999;if(Date.now()-p.timestamp>5*60_000||accuracy>100)return;
 if(d<=office.radius){await api('/api/attendance',{method:'POST',body:{latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy,observedAt:p.timestamp}});await cancelTodayReminder();if(Constants.executionEnvironment!=='storeClient'&&await Location.getBackgroundPermissionsAsync().then(p=>p.granted)&&!await Location.hasStartedLocationUpdatesAsync(WATCH))await Location.startLocationUpdatesAsync(WATCH,{accuracy:Location.Accuracy.Balanced,timeInterval:90_000,distanceInterval:0,deferredUpdatesInterval:90_000,pausesUpdatesAutomatically:false,foregroundService:{notificationTitle:'Hungryman Work',notificationBody:'ჩართულია ოფისში დასწრების აღრიცხვა.'}})}
 else if(d>office.radius){await api('/api/attendance',{method:'POST',body:{outside:true,observedAt:p.timestamp}});if(await Location.hasStartedLocationUpdatesAsync(WATCH))await Location.stopLocationUpdatesAsync(WATCH)}
}
if(!TaskManager.isTaskDefined(GEO))TaskManager.defineTask<{eventType:Location.GeofencingEventType;region:Location.LocationRegion}>(GEO,async({error,data})=>{if(error||!data||!await locationEnabled())return;try{if(data.eventType===Location.GeofencingEventType.Exit){if(await restoreToken())await api('/api/attendance',{method:'POST',body:{outside:true,observedAt:Date.now()}});if(await Location.hasStartedLocationUpdatesAsync(WATCH))await Location.stopLocationUpdatesAsync(WATCH)}else await confirmOffice()}catch{}});
if(!TaskManager.isTaskDefined(WATCH))TaskManager.defineTask<{locations:Location.LocationObject[]}>(WATCH,async({error,data})=>{if(error||!data?.locations?.length)return;try{await confirmOffice(data.locations.at(-1))}catch{}});
const storeOptions={keychainAccessible:SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY};
export async function enableAttendance(office:Office,background=false,requestPermission=true){
 const permission=await (requestPermission?Location.requestForegroundPermissionsAsync():Location.getForegroundPermissionsAsync());if(!permission.granted)return false;
 // Upgrade existing sessions so geofence events can authenticate while locked.
 const token=await restoreToken();if(token)await setToken(token);
 await SecureStore.setItemAsync(CONFIG,JSON.stringify(office),storeOptions);await SecureStore.setItemAsync(KEY,'yes',storeOptions);
 let granted=false;if(background&&Constants.executionEnvironment!=='storeClient'){granted=(await (requestPermission?Location.requestBackgroundPermissionsAsync():Location.getBackgroundPermissionsAsync())).granted;if(granted)await Location.startGeofencingAsync(GEO,[{identifier:'hungryman-office',latitude:office.latitude,longitude:office.longitude,radius:office.radius,notifyOnEnter:true,notifyOnExit:true}])}
 await confirmOffice().catch(()=>{});return granted;
}
export async function disableAttendance(notifyServer=true,request=api){await SecureStore.deleteItemAsync(KEY);await SecureStore.deleteItemAsync(CONFIG);if(await Location.hasStartedGeofencingAsync(GEO))await Location.stopGeofencingAsync(GEO);if(await Location.hasStartedLocationUpdatesAsync(WATCH))await Location.stopLocationUpdatesAsync(WATCH);if(notifyServer)await request('/api/attendance',{method:'POST',body:{disabled:true}}).catch(()=>{});await cancelAttendanceReminders()}
export async function cancelTodayReminder(){const N=await import('expo-notifications');const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tbilisi'}).format(new Date());await N.cancelScheduledNotificationAsync('hm-attendance-'+date).catch(()=>{})}
export async function cancelAttendanceReminders(){const N=await import('expo-notifications');for(const n of await N.getAllScheduledNotificationsAsync())if((n.identifier.startsWith('hm-attendance-')||n.identifier.startsWith('hm-salary-')))await N.cancelScheduledNotificationAsync(n.identifier)}
export async function scheduleAttendanceReminders(days:ReminderDay[],time='13:00',salaries:string[]=[],options:{userId:string;serverScheduling?:boolean;remoteReady?:boolean}={userId:''}){
 if(Constants.executionEnvironment==='storeClient')return false;
 const N=await import('expo-notifications');if(!(await N.getPermissionsAsync()).granted)return false;
 if(process.env.EXPO_OS==='android')await N.setNotificationChannelAsync('attendance',{name:'დასწრება და კალენდარი',importance:N.AndroidImportance.HIGH,sound:'default'});
 await N.setNotificationCategoryAsync('attendanceStatus',[
  {identifier:'late',buttonTitle:'მაგვიანდება',options:{opensAppToForeground:true,isAuthenticationRequired:true}},
  {identifier:'absent',buttonTitle:'არ ვმუშაობ',options:{opensAppToForeground:true,isAuthenticationRequired:true}},
  {identifier:'remote',buttonTitle:'დისტანციურზე ვარ',options:{opensAppToForeground:true,isAuthenticationRequired:true}},
 ]);
 const desired=buildReminderPlan({days,salaries,time,...options,personalTeam:!!Constants.expoConfig?.extra?.personalTeamBuild});
 const byId=new Map(desired.map(item=>[item.identifier,item]));
 const existing=await N.getAllScheduledNotificationsAsync();
 for(const item of existing)if(isLocalReminder(item.identifier)&&!byId.has(item.identifier))await N.cancelScheduledNotificationAsync(item.identifier);
 for(const item of desired){
  const fingerprint=JSON.stringify({at:item.at,user:options.userId,category:item.category||'',title:item.title});
  const prior=existing.find(n=>n.identifier===item.identifier);
  if(prior?.content.data?.scheduleFingerprint===fingerprint)continue;
  if(prior)await N.cancelScheduledNotificationAsync(item.identifier);
  await N.scheduleNotificationAsync({identifier:item.identifier,content:{title:item.title,body:item.body,sound:'default',categoryIdentifier:item.category,data:{...item.data,scheduleFingerprint:fingerprint}},trigger:{type:N.SchedulableTriggerInputTypes.DATE,date:new Date(item.at),channelId:'attendance'}});
 }
 return true;
}
export async function refreshOfficeConfiguration(){if(!await locationEnabled())return;const {office}=await api<{office:Office|null}>('/api/workspace');if(!office){if(await Location.hasStartedGeofencingAsync(GEO))await Location.stopGeofencingAsync(GEO);if(await Location.hasStartedLocationUpdatesAsync(WATCH))await Location.stopLocationUpdatesAsync(WATCH);await SecureStore.deleteItemAsync(CONFIG);return}const next=JSON.stringify(office),changed=next!==await SecureStore.getItemAsync(CONFIG);await SecureStore.setItemAsync(CONFIG,next,storeOptions);await SecureStore.setItemAsync(KEY,'yes',storeOptions);const token=await restoreToken();if(token)await setToken(token);if(Constants.executionEnvironment!=='storeClient'&&(await Location.getBackgroundPermissionsAsync()).granted&&(changed||!await Location.hasStartedGeofencingAsync(GEO)))await Location.startGeofencingAsync(GEO,[{identifier:'hungryman-office',latitude:office.latitude,longitude:office.longitude,radius:office.radius,notifyOnEnter:true,notifyOnExit:true}])}

// Remember only whether the initial prompt was shown, never a location history.
export async function requestInitialLocationPermission(){
 const key='hm-location-prompt-v1';
 if(await SecureStore.getItemAsync(key))return;
 await SecureStore.setItemAsync(key,'asked');
 const permission=await Location.getForegroundPermissionsAsync();
 if(permission.status==='undetermined')await Location.requestForegroundPermissionsAsync();
}
