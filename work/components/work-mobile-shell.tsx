'use client';

// Vinext client routing can cancel navigation; browser anchors preserve working destinations.
/* eslint-disable @next/next/no-img-element -- Avatars use the authenticated origin directly; do not send private images through a public optimizer. */
import LockedWorkButton from '@/components/locked-work-button';
import {usePathname} from 'next/navigation';
import {useEffect,useState,useSyncExternalStore,type MouseEvent} from 'react';
import {Video,MessagesSquare,CircleUserRound,Grid2X2,SlidersHorizontal,MapPin,Ellipsis,ChevronRight,Users,CalendarDays,Radio,Smartphone,ArrowLeft,Map as MapIcon,Plus,SquarePen} from 'lucide-react';
import {canReviewRequests} from '@/lib/notification-policy';
import {hasPermission,type PermissionActor} from '@/lib/permissions';
import {isWorkRoute,workTabForPath,workTabs} from '@/lib/work-navigation';
import {NotificationButtons,useNotificationCounts} from './work-notifications';
import LogoutButton from '@/app/team/logout-button';
import {setWorkDataAccount} from '@/lib/work-data-cache';
import {WORK_MOBILE_QUERY,type WorkChatChrome} from '@/lib/work-mobile';
import './work-mobile-shell.css';

export type WorkMobileSession={user:{userId:string;fullName:string;hasAvatar:boolean;profileUpdated:number};permissions:PermissionActor|null};
let shellSession:WorkMobileSession|null=null,sessionRevision=0,sessionUpdated=0;
const sessionListeners=new Set<()=>void>();
function publishSession(value:WorkMobileSession|null){
 shellSession=value;sessionRevision++;sessionUpdated=Date.now();
 setWorkDataAccount(value?.permissions&&hasPermission(value.permissions,'workspace.view')?value.user.userId:null);
 for(const listener of sessionListeners)listener();
}
function subscribeSession(listener:()=>void){sessionListeners.add(listener);return()=>{sessionListeners.delete(listener)}}
/** Reuses this page's freshly authorized server result instead of an extra startup API request. */
export function WorkSessionSeed({session}:{session:WorkMobileSession|null}){
 useEffect(()=>{publishSession(session)},[session]);return null;
}
const icons={home:Grid2X2,shoots:Video,chat:MessagesSquare,team:CircleUserRound,manage:SlidersHorizontal};
const labels={home:'Hungryman Work',shoots:'გადაღებები',chat:'ჩატები',team:'ჩემი კაბინეტი',manage:'მართვის ცენტრი'};
const noChatChrome:WorkChatChrome={ready:false,conversation:false,canDirect:false,canCreateGroups:false};

/** One mobile navigation surface shared by the browser and installed PWA. */
export default function WorkMobileShell(){
 const pathname=(usePathname()||'/').replace(/\/$/,'')||'/',session=useSyncExternalStore(subscribeSession,()=>shellSession,()=>null),[mobile,setMobile]=useState(false),[menuPath,setMenuPath]=useState<string|null>(null),[pendingHref,setPendingHref]=useState<string|null>(null),[chatChrome,setChatChrome]=useState(noChatChrome),[selectedShoot,setSelectedShoot]=useState(false);
 const menu=menuPath===pathname,eligible=isWorkRoute(pathname),actor=session?.permissions,approved=!!actor&&hasPermission(actor,'workspace.view');
 const conversation=pathname==='/chat'&&chatChrome.ready&&chatChrome.conversation,shootDetail=pathname==='/shoots'&&selectedShoot,chatWired=pathname==='/chat'&&chatChrome.ready;
 const noticeCounts=useNotificationCounts(eligible&&mobile&&approved&&hasPermission(actor,'chat.view'));
 function follow(event:MouseEvent<HTMLAnchorElement>){if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;setMenuPath(null);setPendingHref(event.currentTarget.getAttribute('href'));}
 useEffect(()=>{const restore=()=>setPendingHref(null);window.addEventListener('pageshow',restore);return()=>window.removeEventListener('pageshow',restore)},[]);
 useEffect(()=>{const media=matchMedia(WORK_MOBILE_QUERY),update=()=>setMobile(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 useEffect(()=>{
  if(pathname!=='/chat')return;
  const update=(event:Event)=>{const detail=(event as CustomEvent<WorkChatChrome>).detail;if(detail)setChatChrome(detail)};
  window.addEventListener('hmw:chat-chrome',update);window.dispatchEvent(new Event('hmw:chat-chrome-request'));
  return()=>window.removeEventListener('hmw:chat-chrome',update);
 },[pathname]);
 useEffect(()=>{
  if(pathname!=='/shoots')return;
  const update=(event:Event)=>setSelectedShoot((event as CustomEvent<{active?:boolean}>).detail?.active===true);
  window.addEventListener('hmw:shoot-detail',update);window.dispatchEvent(new Event('hmw:shoot-detail-request'));
  return()=>window.removeEventListener('hmw:shoot-detail',update);
 },[pathname]);
 useEffect(()=>{
  if(!eligible||!mobile)return;
  let alive=true,pending=false;
  const refresh=async()=>{
   if(pending||document.visibilityState==='hidden'||Date.now()-sessionUpdated<60000)return;
   pending=true;const revision=sessionRevision;
   try{const response=await fetch('/api/mobile/me',{cache:'no-store'});if(!alive||revision!==sessionRevision)return;
    if(response.ok){const value=await response.json() as WorkMobileSession;if(alive&&revision===sessionRevision)publishSession(value)}
    else if(response.status===401||response.status===403)publishSession(null);
   }catch{/* The server continues to authorize every page/API request. */}finally{pending=false}
  };
  const startup=setTimeout(()=>void refresh(),0),timer=setInterval(()=>void refresh(),60000);
  const visible=()=>void refresh(),changed=()=>{sessionUpdated=0;void refresh()};document.addEventListener('visibilitychange',visible);window.addEventListener('hmw-work-updated',changed);
  return()=>{alive=false;clearTimeout(startup);clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('hmw-work-updated',changed)};
 },[eligible,mobile]);
 useEffect(()=>{document.body.classList.toggle('hm-mobile-work',eligible&&mobile&&approved);return()=>document.body.classList.remove('hm-mobile-work')},[eligible,mobile,approved]);
 useEffect(()=>{
  const enabled=eligible&&mobile&&approved;
  document.body.classList.toggle('hm-mobile-chat-wired',enabled&&chatWired);document.body.classList.toggle('hm-mobile-chat-conversation',enabled&&conversation);document.body.classList.toggle('hm-mobile-shoot-detail',enabled&&shootDetail);
  return()=>document.body.classList.remove('hm-mobile-chat-wired','hm-mobile-chat-conversation','hm-mobile-shoot-detail');
 },[eligible,mobile,approved,chatWired,conversation,shootDetail]);
 useEffect(()=>{
  if(!eligible||!mobile||!approved||conversation)return;
  const header=document.querySelector('.hm-mobile-topbar');if(!header)return;
  const fit=()=>document.body.style.setProperty('--hm-mobile-top',header.getBoundingClientRect().height+'px');
  const observer=new ResizeObserver(fit);observer.observe(header);fit();
  return()=>{observer.disconnect();document.body.style.removeProperty('--hm-mobile-top')};
 },[eligible,mobile,approved,conversation]);
 useEffect(()=>{
  if(!eligible||!mobile||!approved)return;
  const viewport=window.visualViewport;
  let fullHeight=window.innerHeight;
  const fit=()=>{
   const editing=document.activeElement instanceof HTMLInputElement||document.activeElement instanceof HTMLTextAreaElement||document.activeElement instanceof HTMLElement&&document.activeElement.isContentEditable;
   if(!editing)fullHeight=window.innerHeight;
   const height=viewport?.height||window.innerHeight;
   document.body.style.setProperty('--hm-mobile-viewport',height+'px');
   document.body.classList.toggle('hm-mobile-keyboard',editing&&fullHeight-height>140);
  };
  fit();viewport?.addEventListener('resize',fit);window.addEventListener('resize',fit);document.addEventListener('focusin',fit);document.addEventListener('focusout',fit);
  return()=>{viewport?.removeEventListener('resize',fit);window.removeEventListener('resize',fit);document.removeEventListener('focusin',fit);document.removeEventListener('focusout',fit);document.body.style.removeProperty('--hm-mobile-viewport');document.body.classList.remove('hm-mobile-keyboard')};
 },[eligible,mobile,approved]);
 if(!eligible||!mobile||!approved||!session||!actor)return null;
 const active=workTabForPath(pathname),tabs=workTabs(actor),secondary=!tabs.some(tab=>tab.href===pathname);
 const title=pathname.startsWith('/work/tasks/video/')?'ვიდეოს სამუშაო სივრცე':pathname==='/work/tasks'?'Work':shootDetail?'გადაღების დეტალები':pathname==='/team/map'?'გუნდის რუკა':pathname==='/team/notifications'?'შეტყობინებები':pathname==='/team/requests'?'ჩემი მოთხოვნები':pathname==='/work/calendar'?'კალენდარი':labels[active];
 const more=[
  {href:'/work/tasks',label:'Work · სამუშაო სივრცე',icon:Grid2X2,show:actor.features?.work!==false},
  {href:'/install',label:'დაყენება და შეტყობინებები',icon:Smartphone,show:true},
  {href:'/team/map',label:'გუნდის რუკა',icon:MapPin,show:actor.features?.map!==false},
  {href:'/admin/departments',label:'დეპარტამენტები',icon:Users,show:hasPermission(actor,'departments.view')},
  {href:'/team/requests',label:'ჩემი მოთხოვნები',icon:CalendarDays,show:hasPermission(actor,'cabinet.leave.request')},
  {href:'/team/social',label:'სოციალური მედია',icon:Radio,show:hasPermission(actor,'social.view')},
 ];
 return <>
  {!conversation&&<header className="hm-mobile-topbar">
   <div className="hm-mobile-heading">{(secondary||shootDetail)&&<a className="hm-mobile-icon" href={pathname.startsWith('/work/tasks/video/')?'/work/tasks':shootDetail?'/shoots':active==='home'?'/work':active==='manage'?'/work/manage':'/team'} onClick={follow} aria-label="უკან"><ArrowLeft size={22}/></a>}<h1>{title}</h1></div>
   <div className="hm-mobile-header-actions">
    {active==='shoots'&&!shootDetail&&hasPermission(actor,'shoots.create')&&<button className="hm-mobile-icon hm-mobile-add" type="button" aria-label="ახალი გადაღება" onClick={()=>window.dispatchEvent(new CustomEvent('hmw:shoot-create'))}><Plus size={22}/></button>}
    {chatWired&&chatChrome.canDirect&&<button className="hm-mobile-icon" type="button" aria-label="ახალი პირადი ჩატი" onClick={()=>window.dispatchEvent(new CustomEvent('hmw:chat-compose',{detail:{kind:'direct'}}))}><SquarePen size={22}/></button>}
    {chatWired&&chatChrome.canCreateGroups&&<button className="hm-mobile-icon" type="button" aria-label="ახალი ჯგუფი" onClick={()=>window.dispatchEvent(new CustomEvent('hmw:chat-compose',{detail:{kind:'group'}}))}><Users size={22}/></button>}
    {active==='home'&&actor.features?.notifications!==false&&<NotificationButtons review={canReviewRequests(actor)}/>}
    {active==='home'&&actor.features?.map!==false&&<a className="hm-mobile-icon" href="/team/map" onClick={follow} aria-label="გუნდის რუკა"><MapIcon size={20}/></a>}
    {active==='home'&&hasPermission(actor,'cabinet.view')?<a className="hm-mobile-avatar" href="/team" onClick={follow} aria-label="ჩემი კაბინეტი">{session.user.hasAvatar?<img src={'/api/team/avatar?userId='+encodeURIComponent(session.user.userId)+'&v='+session.user.profileUpdated} alt="" width={42} height={42}/>:<CircleUserRound size={28}/>}</a>:active==='shoots'||active==='chat'?null:<button className="hm-mobile-icon" type="button" aria-label="დამატებითი გვერდები" aria-expanded={menu} aria-controls="hm-mobile-more" onClick={()=>setMenuPath(value=>value===pathname?null:pathname)}><Ellipsis size={21}/></button>}
   </div>
  </header>}
  {menu&&!conversation&&<><button className="hm-mobile-menu-backdrop" aria-label="მენიუს დახურვა" onClick={()=>setMenuPath(null)}/><section id="hm-mobile-more" className="hm-mobile-more" aria-label="დამატებითი გვერდები"><div className="hm-mobile-menu-person"><span>{session.user.fullName}</span><small>სამუშაო სივრცე</small></div>{more.filter(item=>item.show).map(item=>item.href==='/work/tasks'&&!actor.isDeveloper?<LockedWorkButton key={item.href}/>:<a key={item.href} href={item.href} onClick={follow}><item.icon size={18}/><span>{item.label}</span><ChevronRight size={16}/></a>)}<div className="hm-mobile-logout"><span>გასვლა</span><LogoutButton/></div></section></>}
  {!conversation&&!shootDetail&&<nav className="hm-mobile-tabs" aria-label="სამუშაო სივრცის მთავარი მენიუ">{tabs.map(tab=>{const Icon=icons[tab.id as keyof typeof icons],unread=tab.id==='chat'?noticeCounts.chatUnread:0;return <a key={tab.id} href={tab.href} onClick={follow} data-pending={pendingHref===tab.href||undefined} aria-current={active===tab.id?'page':undefined} aria-label={unread>0?tab.label+' · '+unread+' წაუკითხავი':undefined}><span><Icon size={22} strokeWidth={1.8}/>{unread>0&&<b className="hm-mobile-tab-badge" aria-hidden="true">{unread>99?'99+':unread}</b>}</span><small>{tab.label}</small></a>})}</nav>}
  {pendingHref&&<div className="hm-mobile-navigation-status" role="status" aria-live="polite">გვერდი იხსნება…</div>}
 </>;
}
