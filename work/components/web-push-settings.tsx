'use client';
import {useEffect,useRef,useState} from 'react';
import {Bell,BellOff} from 'lucide-react';

type Config={enabled:boolean;publicKey:string|null;userId:string};
function applicationKey(value:string){const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function saveSubscription(subscription:PushSubscription){const response=await fetch('/api/web-push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(subscription.toJSON()),cache:'no-store'});if(!response.ok)throw new Error('შეტყობინებების ჩართვა ვერ მოხერხდა. სცადე ხელახლა.')}
export function WebPushSettings(){
 const [config,setConfig]=useState<Config|null>(null),[status,setStatus]=useState('იტვირთება…'),[subscribed,setSubscribed]=useState(false),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[login,setLogin]=useState(false),[iosInstall,setIosInstall]=useState(false),[supported,setSupported]=useState(true);
 const registration=useRef<ServiceWorkerRegistration|null>(null);
 useEffect(()=>{
  let alive=true;
  const standalone=window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone;
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(ios&&!standalone){setIosInstall(true);setStatus('iPhone-ზე ჯერ დაამატე აპი მთავარ ეკრანზე, გახსენი მისი ხატულიდან და შემდეგ ჩართე შეტყობინებები.');return}
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){setSupported(false);setStatus('ამ ბრაუზერში ფონური შეტყობინებები მიუწვდომელია. გამოიყენე Safari-ის, Chrome-ის ან Firefox-ის განახლებული ვერსია.');return}
  void (async()=>{try{
   const response=await fetch('/api/web-push',{cache:'no-store'});if(!alive)return;
   if(response.status===401){setLogin(true);setStatus('შეტყობინებების ჩასართავად შედი შენს ანგარიშში.');return}
   if(!response.ok)throw new Error('პარამეტრები ვერ ჩაიტვირთა. განაახლე გვერდი.');
   const c=await response.json() as Config;setConfig(c);
   if(!c.enabled){setStatus('შეტყობინებები ამჟამად გამორთულია სამუშაო სივრცეში.');return}
   const reg=await navigator.serviceWorker.ready;if(!alive)return;registration.current=reg;setReady(true);
   const subscription=await reg.pushManager.getSubscription();if(!alive)return;
   if(subscription&&Notification.permission==='granted'){
    const expected=applicationKey(c.publicKey||''),actual=subscription.options.applicationServerKey;
    if(actual&&new Uint8Array(actual).every((v,i)=>v===expected[i])&&actual.byteLength===expected.length){await saveSubscription(subscription);if(alive){setSubscribed(true);setStatus('შეტყობინებები ჩართულია ამ მოწყობილობაზე.')}return}
    await subscription.unsubscribe();
   }
   if(alive)setStatus(Notification.permission==='denied'?'ბრაუზერის პარამეტრებში დაუშვი ამ საიტის შეტყობინებები და განაახლე გვერდი.':'მიიღე ახალი შეტყობინებები მაშინაც, როცა აპი დახურულია.');
  }catch(error){if(alive)setStatus(error instanceof Error?error.message:'შეტყობინებების პარამეტრები ვერ ჩაიტვირთა.')}})();
  return()=>{alive=false};
 },[]);
 async function enable(){
  if(busy||!registration.current||!config?.publicKey)return;setBusy(true);
  // Request permission synchronously in the click handler (required by Safari).
  const permission=Notification.permission==='granted'?Promise.resolve('granted' as NotificationPermission):Notification.requestPermission();
  try{if(await permission!=='granted'){setStatus('შეტყობინებები არ ჩაირთო. ნებართვის შეცვლა ბრაუზერის პარამეტრებიდან შეგიძლია.');return}
   const subscription=await registration.current.pushManager.getSubscription()||await registration.current.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationKey(config.publicKey)});
   try{await saveSubscription(subscription)}catch(error){await subscription.unsubscribe();throw error}
   setSubscribed(true);setStatus('შეტყობინებები ჩართულია ამ მოწყობილობაზე.');
  }catch(error){setStatus(error instanceof Error?error.message:'შეტყობინებების ჩართვა ვერ მოხერხდა. სცადე ხელახლა.')}finally{setBusy(false)}
 }
 async function disable(){if(busy||!registration.current)return;setBusy(true);try{const subscription=await registration.current.pushManager.getSubscription();if(subscription){await subscription.unsubscribe();await fetch('/api/web-push',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})})}for(const n of await registration.current.getNotifications())n.close();setSubscribed(false);setStatus('შეტყობინებები გამორთულია ამ მოწყობილობაზე.')}catch{setStatus('გამორთვა ვერ მოხერხდა. სცადე ხელახლა.')}finally{setBusy(false)}}
 return <section aria-label="შეტყობინებების პარამეტრები" style={{borderTop:'1px solid #193d50',marginTop:24,paddingTop:20}}><h2 style={{fontSize:15,fontWeight:650,margin:0}}>შეტყობინებები</h2><p className="hm-pwa-help" role="status" aria-live="polite">{status}</p>{login?<a className="hm-pwa-open" href="/team/auth?return_to=/install">ანგარიშში შესვლა</a>:config?.enabled&&supported&&!iosInstall?<button className="hm-pwa-primary" type="button" onClick={subscribed?disable:enable} disabled={busy||!ready}>{subscribed?<BellOff size={18}/>:<Bell size={18}/>} {busy?'მიმდინარეობს…':subscribed?'შეტყობინებების გამორთვა':'შეტყობინებების ჩართვა'}</button>:null}<p className="hm-pwa-help">შეტყობინებაში პირადი ტექსტი არ ჩანს. ზარზე პასუხისთვის აპი უნდა გახსნა; მიღება დამოკიდებულია მოწყობილობის ინტერნეტსა და შეტყობინებების პარამეტრებზე.</p></section>;
}

/** Refresh an existing browser registration after a new authenticated session. Never prompt here. */
export function WebPushSessionSync(){
 useEffect(()=>{
  if(!('serviceWorker'in navigator)||!('Notification'in window)||Notification.permission!=='granted')return;
  let alive=true;
  void (async()=>{try{
   const reg=await navigator.serviceWorker.ready;if(!alive||!reg.pushManager)return;
   const subscription=await reg.pushManager.getSubscription();if(!subscription||!alive)return;
   const response=await fetch('/api/web-push',{cache:'no-store'});if(!response.ok||!alive)return;
   const config=await response.json() as Config;if(!config.enabled||!config.publicKey)return;
   const expected=applicationKey(config.publicKey),actual=subscription.options.applicationServerKey;
   if(actual&&actual.byteLength===expected.length&&new Uint8Array(actual).every((v,i)=>v===expected[i]))await saveSubscription(subscription);
  }catch{/* The install screen exposes retry; foreground actions must remain available. */}})();
  return()=>{alive=false};
 },[]);
 return null;
}
