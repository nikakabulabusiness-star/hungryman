import {useEffect,useState,useRef,useCallback} from 'react';
import {AppState,Text,Linking,Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import {useAuth} from '../lib/auth';
import {api} from '../lib/api';
import {registerPush,hasRegisteredPush,prepareNotificationChannels} from '../lib/push-notifications';
import {enableAttendance,disableAttendance,confirmOffice,refreshOfficeConfiguration,locationEnabled,scheduleAttendanceReminders,type Office} from '../lib/location';
import type {ReminderDay} from '../lib/reminder-plan';
import {Button,Sheet,State,S} from './components';
type Reminders={days:ReminderDay[];salaries:string[];office:Office|null;serverScheduling?:boolean};
export function LocationLifecycle(){
 const {session,loading}=useAuth(),id=session?.user.userId,approved=session?.permissions?.isApprovedStaff;
 const attendanceEnabled=session?.permissions?.features?.attendance!==false,attendanceAllowed=useRef(attendanceEnabled);
 useEffect(()=>{attendanceAllowed.current=attendanceEnabled;if(!attendanceEnabled)void disableAttendance(false).catch(()=>{})},[attendanceEnabled]);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const running=useRef(false),account=useRef(id),key='hm-background-consent-v2-'+id;
 // Async responses from a previous account must not configure the next account.
 useEffect(()=>{account.current=id},[id]);
 useEffect(()=>{if(!loading&&!approved)void disableAttendance(false).catch(()=>{})},[loading,approved]);
 const sync=useCallback(async()=>{
  if(!id||!approved||running.current||AppState.currentState!=='active')return;
  running.current=true;
  try{
   const consent=await SecureStore.getItemAsync(key);
   // Signing out stops tracking. On the next sign-in, reuse previously accepted
   // consent and existing OS permissions without repeatedly displaying prompts.
   const tracking=await locationEnabled();
   try{if(tracking&&attendanceAllowed.current){await refreshOfficeConfiguration();await confirmOffice()}}
   catch{/* A temporary location failure must not suppress calendar reminders. */}
   let plan=await api<Reminders>('/api/notifications/reminders');
   if(account.current!==id)return;
   if(!tracking&&consent==='accepted'&&plan.office&&attendanceAllowed.current){
    try{await enableAttendance(plan.office,true,false);if(!attendanceAllowed.current)await disableAttendance(false);plan=await api<Reminders>('/api/notifications/reminders')}
    catch{/* Keep the last available plan if a permission or network request fails. */}
   }
   if(account.current!==id)return;
   if(Constants.executionEnvironment!=='storeClient')await scheduleAttendanceReminders(plan.office&&attendanceAllowed.current?plan.days:[],'13:00',plan.salaries,{userId:id,serverScheduling:plan.serverScheduling===true,remoteReady:await hasRegisteredPush(id)});
  }catch{/* Keep existing schedules on transient server/network failure. */}
  finally{running.current=false}
 },[approved,id,key]);
 useEffect(()=>{
  if(!id||!approved)return;
  let stopped=false;
  void SecureStore.getItemAsync(key).then(v=>{if(!stopped){setOpen(!v);setError('')}});
  void sync();
  const timer=setInterval(()=>{void sync()},90000),listener=AppState.addEventListener('change',s=>{if(s==='active')void sync()});
  return()=>{stopped=true;clearInterval(timer);listener.remove()};
 },[id,approved,key,sync]);
 async function configure(){
  if(!id||busy)return;
  setBusy(true);setError('');
  try{
   await SecureStore.setItemAsync(key,'accepted');
   const warnings:string[]=[];
   if(Constants.executionEnvironment!=='storeClient'){
    const N=await import('expo-notifications');
    await prepareNotificationChannels();
    const permission=await N.requestPermissionsAsync();
    if(!permission.granted)warnings.push('შეტყობინებების მისაღებად ტელეფონის პარამეტრებში დაუშვი Notifications.');
    await registerPush(id).catch(()=>{});
   }
   const plan=await api<Reminders>('/api/notifications/reminders');
   if(account.current!==id)return;
   let background=false;
   if(plan.office&&attendanceAllowed.current){background=await enableAttendance(plan.office,true);if(!attendanceAllowed.current)await disableAttendance(false)}
   else if(attendanceAllowed.current){
    const foreground=await Location.requestForegroundPermissionsAsync();
    if(foreground.granted&&Constants.executionEnvironment!=='storeClient')background=(await Location.requestBackgroundPermissionsAsync()).granted;
   }
   if(!background&&attendanceAllowed.current)warnings.push(Platform.OS==='ios'?'ფონური დასწრებისთვის Settings → Hungryman Work → Location-ში აირჩიე Always.':'ფონური დასწრებისთვის აპის ლოკაციის პარამეტრებში აირჩიე Allow all the time.');
   if(warnings.length)setError(warnings.join('\n\n'));else setOpen(false);
   await sync();
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function close(){if(busy)return;if(!await SecureStore.getItemAsync(key))await SecureStore.setItemAsync(key,'shown');setOpen(false)}
 if(!approved)return null;
 return <Sheet visible={open} title={attendanceEnabled?'შეტყობინებები და დასწრება':'შეტყობინებები'} onClose={()=>void close()}>
  <Text style={S.text}>{attendanceEnabled?'დაუშვი შეტყობინებები და მდებარეობაზე მუდმივი წვდომა, რომ ოფისში მოსვლა და გასვლა ავტომატურად აღირიცხოს.':'დაუშვი შეტყობინებები, რომ მნიშვნელოვანი ცვლილებები არ გამოგრჩეს.'}</Text>
  <Text style={S.muted}>ოფისის გარეთ გადაადგილების მარშრუტი არ ინახება. ნებართვების შეცვლა ტელეფონის პარამეტრებში შეგიძლია. ფონური მუშაობა დამოკიდებულია ტელეფონის სისტემასა და ნებართვებზე.</Text>
  {Constants.expoConfig?.extra?.personalTeamBuild&&<Text style={[S.muted,{fontSize:12}]}>ამ უფასო iPhone ვერსიაში დახურულ აპზე ახალი ჩატის სისტემური შეტყობინება მიუწვდომელია. დასწრებისა და ხელფასის ადგილობრივი შეხსენებები აპის გახსნისას სინქრონდება.</Text>}
  <State error={error}/><Button title="გაგრძელება" busy={busy} onPress={()=>void configure()}/>
  {!!error&&<Button secondary title="ტელეფონის პარამეტრები" onPress={()=>void Linking.openSettings()}/>}
  <Button secondary title="დახურვა" disabled={busy} onPress={()=>void close()}/>
 </Sheet>;
}
