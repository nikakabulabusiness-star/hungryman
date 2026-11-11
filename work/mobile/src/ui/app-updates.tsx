import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {Alert,AppState,Platform,Text,View} from 'react-native';
import {usePathname} from 'expo-router';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import {audioBusy} from '../lib/audio-focus';
import {api} from '../lib/api';
import {mayReloadUpdate,shouldCheckUpdate,requiredNativeBuild,UPDATE_CHECK_INTERVAL,type NativeBuild} from '../lib/update-policy';
import {Button,Fold,S,C} from './components';
const Context=createContext<{pending:boolean;busy:boolean;build:NativeBuild|null;error:string;message:string;check:()=>void;apply:()=>void}|null>(null);
export function AppUpdatesProvider({children}:{children:React.ReactNode}){
 const native=Updates.useUpdates(),path=usePathname();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [build,setBuild]=useState<NativeBuild|null>(null);
 const flight=useRef(false),last=useRef(0),current=useRef({path,pending:native.isUpdatePending,busy:native.isChecking||native.isDownloading});
 const releaseFlight=useRef(false),lastRelease=useRef(0);
 useEffect(()=>{current.current={path,pending:native.isUpdatePending,busy:native.isChecking||native.isDownloading}},[path,native.isUpdatePending,native.isChecking,native.isDownloading]);
 const checkRelease=useCallback(async(manual=false)=>{
  if(__DEV__||Platform.OS!=='ios'||Updates.channel!=='personal-iphone'||!Updates.runtimeVersion||releaseFlight.current||AppState.currentState!=='active'||(!manual&&Date.now()-lastRelease.current<UPDATE_CHECK_INTERVAL))return;
  releaseFlight.current=true;lastRelease.current=Date.now();
  try{const result=await api<unknown>('/api/mobile/release',{public:true});setBuild(requiredNativeBuild(result,Platform.OS,Updates.channel,Updates.runtimeVersion))}catch{if(manual)setError('ახალი ბილდის საჭიროება ვერ შემოწმდა. მოგვიანებით სცადე.')}finally{releaseFlight.current=false}
 },[]);
 const check=useCallback(async(manual=false)=>{
  if(manual)setError('');void checkRelease(manual);
  const state=current.current;
  if(!shouldCheckUpdate(Updates.isEnabled,__DEV__,AppState.currentState==='active',state.pending,flight.current||state.busy,last.current,Date.now(),manual))return;
  flight.current=true;last.current=Date.now();setBusy(true);setMessage('');
  try{const result=await Updates.checkForUpdateAsync();if(result.isAvailable||result.isRollBackToEmbedded){await Updates.fetchUpdateAsync();setMessage('განახლება მზადაა. ჩაირთვება შემდეგი გაშვებისას.')}else if(manual)setMessage('ამ ბილდისთვის ახალი ავტომატური განახლება არ არის.')}catch{if(manual)setError('განახლება ვერ შემოწმდა. აპის გამოყენება შეგიძლია გააგრძელო. მოგვიანებით სცადე.')}finally{flight.current=false;setBusy(false)}
 },[checkRelease]);
 useEffect(()=>{last.current=Date.now();const startup=setTimeout(()=>void checkRelease(),0);const listener=AppState.addEventListener('change',s=>{if(s==='active')void check()});return()=>{clearTimeout(startup);listener.remove()}},[check,checkRelease]);
 function apply(){
  if(!current.current.pending||!mayReloadUpdate(current.current.path,audioBusy(),AppState.currentState==='active'))return;
  Alert.alert('განახლების ჩართვა','აპი თავიდან გაიხსნება. ჯერ შეინახე მიმდინარე ცვლილებები.',[{text:'მოგვიანებით',style:'cancel'},{text:'განახლება',onPress:()=>{if(!mayReloadUpdate(current.current.path,audioBusy(),AppState.currentState==='active'))return;void Updates.reloadAsync().catch(()=>setError('ვერ გადაიტვირთა. დახურე და თავიდან გახსენი აპი.'))}}]);
 }
 return <Context.Provider value={{pending:native.isUpdatePending,busy:busy||native.isChecking||native.isDownloading,build,error,message,check:()=>void check(true),apply}}>{children}</Context.Provider>
}
function BuildDetails({build}:{build:NativeBuild}){return <View style={{gap:10}}><Text style={[S.subtitle,{color:C.red}]}>საჭიროა ახალი ბილდი · {build.version}</Text><Text style={S.muted}>ამ ვერსიას ავტომატური განახლება ვერ დააყენებს. არსებული აპის გამოყენება შეგიძლია გააგრძელო.</Text><Button secondary title="როგორ განვაახლო?" onPress={()=>Alert.alert('ახალი ბილდის დაყენება','მიიღე განახლების ახალი პაკეტი. Mac-ზე გახსენი Update-on-Mac.command, შემდეგ Xcode-ში აირჩიე შენი iPhone და დააჭირე ▶ Run-ს. არსებული აპი არ წაშალო. ეს არ მოითხოვს Expo Go-ს.')}/></View>}
export function AppBuildNotice(){const state=useContext(Context);return state?.build?<View style={[S.card,{borderColor:C.red}]}><BuildDetails build={state.build}/></View>:null}
export function AppUpdatesCard(){const state=useContext(Context);if(!state)return null;const enabled=Updates.isEnabled&&!__DEV__;return <Fold title="აპის განახლებები" subtitle={state.build?'საჭიროა ახალი ბილდი':state.pending?'ახალი განახლება მზადაა':`ვერსია ${Constants.expoConfig?.version||'—'}`}>
 {state.build&&<BuildDetails build={state.build}/>}<Text style={S.muted}>{enabled?'განახლებები ავტომატურად ჩამოიტვირთება. მუშაობა არ შეწყდება; ახალი ვერსია შემდეგ გაშვებაზე ჩაირთვება.':'ამ საცდელ ვერსიაში ავტომატური განახლება მიუწვდომელია.'}</Text>{state.error&&<Text style={S.error}>{state.error}</Text>}{state.message&&<Text style={S.muted}>{state.message}</Text>}{enabled&&<View style={{gap:10}}>{state.pending&&<Button title="განახლების ჩართვა" onPress={state.apply}/>}<Button title="განახლების შემოწმება" secondary busy={state.busy} onPress={state.check}/></View>}</Fold>}
