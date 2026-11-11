'use client';

import {useEffect,useSyncExternalStore} from 'react';
import {Download,RefreshCw,WifiOff,Check,Share2,X} from 'lucide-react';
import {isWorkPwaHost} from '@/lib/pwa-policy';
import release from '@/lib/pwa-release.json';
import './pwa-runtime.css';

type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
type State={offline:boolean;installed:boolean;ios:boolean;installable:boolean;update:boolean;applying:boolean;message:string;dismissed:boolean};
const initial:State={offline:false,installed:false,ios:false,installable:false,update:false,applying:false,message:'',dismissed:false};
let state=initial,promptEvent:InstallPrompt|null=null,registration:ServiceWorkerRegistration|null=null,requestedReload=false;
const listeners=new Set<()=>void>();
function change(patch:Partial<State>){state={...state,...patch};for(const listener of listeners)listener()}
function subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}
function usePwa(){return useSyncExternalStore(subscribe,()=>state,()=>initial)}
function activeCallOrRecording(){return !!document.querySelector('.hm-call-window:not([hidden]),.hm-call-incoming:not([hidden]),.hm-voice-recorder[data-active="true"]')}
async function install(){
 if(!promptEvent)return;
 const event=promptEvent;promptEvent=null;change({installable:false,message:''});
 try{await event.prompt();const result=await event.userChoice;if(result.outcome==='accepted')change({installed:true})}catch{change({message:'დაყენებისთვის გახსენი ბრაუზერის მენიუ და აირჩიე მთავარ ეკრანზე დამატება.'})}
}
async function applyUpdate(){
 if(activeCallOrRecording()){change({message:'განახლებამდე დაასრულე ზარი ან ხმოვანი შეტყობინების ჩაწერა.'});return}
 if(!window.confirm('გვერდი განახლდება. გაგზავნე ან შეინახე დაწყებული ცვლილებები. განვაახლოთ ახლა?'))return;
 change({applying:true,message:''});
 if(registration?.waiting){requestedReload=true;registration.waiting.postMessage({type:'HMW_APPLY_UPDATE'});return}
 window.location.reload();
}

/** Registration and update checks are shared by the browser and the installed app. */
export default function PwaRuntime(){
 const current=usePwa();
 useEffect(()=>{
  if(!isWorkPwaHost(location.hostname)||!window.isSecureContext)return;
  let disposed=false,lastCheck=0,checking=false;
  const standalone=matchMedia('(display-mode: standalone)');
  const syncInstalled=()=>change({installed:standalone.matches||!!(navigator as Navigator&{standalone?:boolean}).standalone});
  syncInstalled();change({ios:/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),offline:!navigator.onLine});
  const online=()=>{change({offline:false});void check(true)},offline=()=>change({offline:true});
  const prompt=(event:Event)=>{event.preventDefault();promptEvent=event as InstallPrompt;change({installable:true})};
  const installed=()=>{promptEvent=null;change({installed:true,installable:false})};
  const waiting=()=>{if(navigator.serviceWorker.controller&&registration?.waiting)change({update:true,dismissed:false})};
  const found=()=>{const installing=registration?.installing;if(!installing)return;installing.addEventListener('statechange',()=>{if(installing.state==='installed'&&!disposed)waiting()})};
  const controller=()=>{
   if(!requestedReload)return;requestedReload=false;
   if(activeCallOrRecording()){change({applying:false,message:'განახლება მზადაა. გვერდი განაახლე ზარის ან ჩანაწერის დასრულების შემდეგ.'});return}
   window.location.reload();
  };
  async function check(force=false){
   if(disposed||checking||document.visibilityState==='hidden'||!navigator.onLine||(!force&&Date.now()-lastCheck<5*60*1000))return;
   lastCheck=Date.now();checking=true;
   try{
    await registration?.update();waiting();
    const response=await fetch('/api/pwa/release',{cache:'no-store'});
    if(response.ok){const next=await response.json() as {version?:string};if(!disposed&&next.version&&next.version!==release.version)change({update:true,dismissed:false})}
   }catch{/* Offline and deployment interruptions are retried on the next foreground check. */}finally{checking=false}
  }
  if('serviceWorker' in navigator){
   navigator.serviceWorker.addEventListener('controllerchange',controller);
   void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(value=>{
    if(disposed)return;registration=value;waiting();value.addEventListener('updatefound',found);void check(true);
   }).catch(()=>{/* The website remains fully usable when a browser disables service workers. */});
  }
  const foreground=()=>{if(document.visibilityState==='visible')void check()};
  window.addEventListener('online',online);window.addEventListener('offline',offline);window.addEventListener('beforeinstallprompt',prompt);window.addEventListener('appinstalled',installed);window.addEventListener('focus',foreground);document.addEventListener('visibilitychange',foreground);standalone.addEventListener('change',syncInstalled);
  const timer=setInterval(()=>void check(),5*60*1000);
  return()=>{disposed=true;clearInterval(timer);window.removeEventListener('online',online);window.removeEventListener('offline',offline);window.removeEventListener('beforeinstallprompt',prompt);window.removeEventListener('appinstalled',installed);window.removeEventListener('focus',foreground);document.removeEventListener('visibilitychange',foreground);standalone.removeEventListener('change',syncInstalled);registration?.removeEventListener('updatefound',found);if('serviceWorker'in navigator)navigator.serviceWorker.removeEventListener('controllerchange',controller)};
 },[]);
 if(current.offline)return <aside className="hm-pwa-notice" role="status"><WifiOff size={18}/><div><strong>ინტერნეტთან კავშირი გაწყდა</strong><small>ახალი მონაცემები კავშირის აღდგენის შემდეგ გამოჩნდება.</small></div></aside>;
 if(!current.update||current.dismissed)return null;
 return <aside className="hm-pwa-notice" role="status"><RefreshCw size={18}/><div><strong>განახლება მზადაა</strong><small>{current.message||'განაახლე გვერდი, როცა შენთვის მოსახერხებელია.'}</small></div><button type="button" disabled={current.applying} onClick={()=>void applyUpdate()}>{current.applying?'ახლდება…':'განახლება'}</button><button type="button" className="hm-pwa-dismiss" aria-label="მოგვიანებით განახლება" onClick={()=>change({dismissed:true})}><X size={16}/></button></aside>;
}

export function PwaInstallPanel(){
 const current=usePwa();
 return <div className="hm-pwa-install-content">
  <div className="hm-pwa-install-status">{current.installed?<><Check size={18}/><span>მთავარ ეკრანზე დამატებულია</span></>:<><Download size={18}/><span>სამუშაო სივრცე შენს ტელეფონში</span></>}</div>
  {!current.installed&&<>
   {current.installable&&<button type="button" className="hm-pwa-primary" onClick={()=>void install()}><Download size={18}/>აპის დამატება</button>}
   {current.ios?<ol className="hm-pwa-steps"><li>გახსენი ეს გვერდი Safari-ში.</li><li>დააჭირე გაზიარებას <Share2 size={16}/>.</li><li>აირჩიე „მთავარ ეკრანზე დამატება“ (Add to Home Screen) და შემდეგ „დამატება“.</li></ol>:<p className="hm-pwa-help">{current.installable?'დაყენების შემდეგ აპი გაიხსნება საკუთარი ფანჯრით.':'Chrome-ის ან Edge-ის მენიუში აირჩიე „აპის დაყენება“ ან „მთავარ ეკრანზე დამატება“. თუ ეს არჩევანი არ ჩანს, საიტი ბრაუზერშიც ჩვეულებრივ მუშაობს.'}</p>}
  </>}
  <p className="hm-pwa-help">საიტის ცვლილებები აპშიც გამოჩნდება. ახალი ვერსია გაიხსნება ხელახლა გაშვებისას; უკვე გახსნილ გვერდზე განახლების ღილაკს დაინახავ. მიმდინარე ზარი ავტომატურად არ შეწყდება.</p>
  <p className="hm-pwa-help">ჩატის, ზარებისა და სამუშაო მონაცემებისთვის ინტერნეტია საჭირო. კავშირის გარეშე გამოჩნდება დაბრუნების გვერდი.</p>
  {current.update&&<button className="hm-pwa-primary" type="button" disabled={current.applying} onClick={()=>void applyUpdate()}><RefreshCw size={18}/>განახლების გამოყენება</button>}
  {current.message&&<p className="hm-pwa-feedback" role="status">{current.message}</p>}
  <a className="hm-pwa-open" href="/work">სამუშაო სივრცის გახსნა <span aria-hidden="true">→</span></a>
 </div>;
}
