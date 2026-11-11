'use client';

import {createContext,useCallback,useContext,useState,type ReactNode} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {ArrowLeft,LayoutGrid,ListChecks,BadgeCheck,CalendarDays,Clapperboard,Scissors,NotebookPen,Smartphone,Camera,ContactRound,ChevronRight,ShieldCheck} from 'lucide-react';
import type {WorkMeta} from '@/mobile/src/lib/work-model';
import {NotificationButtons} from '@/components/work-notifications';

type FrameState={canApprove:boolean;canContacts:boolean;setMeta:(meta:WorkMeta)=>void};
const Frame=createContext<FrameState>({canApprove:false,canContacts:false,setMeta:()=>{}});
export const useWorkFrame=()=>useContext(Frame);
export const boardIcons={story:NotebookPen,production:Clapperboard,editing:Scissors,social:Smartphone,technical:Camera};
const sections=[{href:'/work/tasks',label:'სამუშაო დაფები',icon:LayoutGrid},{href:'/work/tasks?view=mine',label:'ჩემი დავალებები',icon:ListChecks},{href:'/work/tasks?view=approvals',label:'დამტკიცებები',icon:BadgeCheck,approval:true},{href:'/work/calendar',label:'კალენდარი',icon:CalendarDays},{href:'/shoots',label:'გადაღებები',icon:Clapperboard},{href:'/shoots?kind=short',label:'Shorts-ის გადაღებები',icon:Smartphone}];
const departments=[{id:'story',label:'სცენარი'},{id:'production',label:'პროდაქშენი'},{id:'technical',label:'ტექნიკური'},{id:'editing',label:'მონტაჟი'},{id:'social',label:'სოციალური მედია'}] as const;

export default function WorkFrame({children,name,canApprove:initialApprove,canContacts:initialContacts}:{children:ReactNode;name:string;canApprove:boolean;canContacts:boolean}){
 const [capabilities,setCapabilities]=useState({canApprove:initialApprove,canContacts:initialContacts}),path=usePathname(),params=useSearchParams();
 const setMeta=useCallback((meta:WorkMeta)=>setCapabilities(old=>old.canApprove===meta.canApprove&&old.canContacts===meta.canContacts?old:{canApprove:meta.canApprove,canContacts:meta.canContacts}),[]);
 const query=params?.toString()||'',current=(path||'/work/tasks')+(query?'?'+query:''),label=departments.find(d=>params?.get('board')===d.id)?.label||({'mine':'ჩემი დავალებები','contacts':'კონტაქტების ბაზა','approvals':'დამტკიცებები'} as Record<string,string>)[params?.get('view')||'']||(path?.includes('/video/')?'ვიდეოს სამუშაო სივრცე':'სამუშაო დაფები');
 return <Frame.Provider value={{...capabilities,setMeta}}>
  <div className="hm-work-frame">
   <aside className="hm-work-sidebar" aria-label="Work-ის მენიუ">
    <a className="hm-work-brand" href="/work/tasks"><img src="/work/pwa/icon-192.png" width="38" height="38" alt=""/><span>HUNGRYMAN<small>W O R K</small></span></a>
    <p>სამუშაო სივრცე</p><nav>{sections.filter(item=>!item.approval||capabilities.canApprove).map(item=><a key={item.href} href={item.href} aria-current={current===item.href?'page':undefined}><item.icon size={18}/><span>{item.label}</span></a>)}</nav>
    <p>დეპარტამენტები</p><nav>{departments.map(item=>{const Icon=boardIcons[item.id],href='/work/tasks?board='+item.id;return <a href={href} key={item.id} aria-current={params?.get('board')===item.id?'page':undefined}><Icon size={18}/><span>{item.label}</span></a>})}</nav>
    {capabilities.canContacts&&<><p>გუნდი</p><nav><a href="/work/tasks?view=contacts" aria-current={params?.get('view')==='contacts'?'page':undefined}><ContactRound size={18}/><span>კონტაქტების ბაზა</span></a></nav></>}
    <footer><a href="/work"><ArrowLeft size={17}/>მთავარზე დაბრუნება</a><ShieldCheck size={18}/><span>გუნდისთვის.<br/>ერთი სივრცე, ყველა ეტაპი.</span></footer>
   </aside>
   <div className="hm-work-right">
    <header className="hm-work-top"><a href="/work/tasks">სამუშაო სივრცე</a><ChevronRight size={15}/><strong>{label}</strong><div className="hm-work-top-person"><NotificationButtons/><span className="hm-work-person-initial">{name.trim().slice(0,1)}</span><span>{name}</span></div></header>
    <nav className="hm-work-mobile-nav" aria-label="სამუშაო სივრცის გვერდები"><a href="/work/tasks" aria-current={!params?.get('view')&&!path?.includes('/video/')?'page':undefined}><LayoutGrid size={17}/>დაფები</a><a href="/work/tasks?view=mine" aria-current={params?.get('view')==='mine'?'page':undefined}><ListChecks size={17}/>ჩემი საქმეები</a>{capabilities.canApprove&&<a href="/work/tasks?view=approvals" aria-current={params?.get('view')==='approvals'?'page':undefined}><BadgeCheck size={17}/>დასტური</a>}{capabilities.canContacts&&<a href="/work/tasks?view=contacts" aria-current={params?.get('view')==='contacts'?'page':undefined}><ContactRound size={17}/>კონტაქტები</a>}</nav>
    <div className="hm-work-content">{children}</div>
   </div>
  </div>
 </Frame.Provider>;
}
