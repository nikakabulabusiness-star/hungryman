'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- native navigation survives unavailable client routing. */
import LockedWorkButton from '@/components/locked-work-button';
import {useState} from 'react';
import {BriefcaseBusiness,Video,MapPin,ArrowRight,Pin,CalendarDays,RefreshCw,Play,ChevronRight,Gift,Wallet,Sun} from 'lucide-react';
import {hasPermission,type PermissionActor} from '@/lib/permissions';
import {addDays,appliesOn} from '@/lib/staff-calendar';
import type {ShootWithTasks} from '@/lib/shoots';
import {useWorkData} from '@/components/cabinet-panel';
import {ShootPhoto} from '@/components/shoot-photo';
import './work-hub.css';

function localToday(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tbilisi',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),part=(type:string)=>parts.find(item=>item.type===type)?.value||'';return `${part('year')}-${part('month')}-${part('day')}`}
function dateLabel(date:string){return new Date(date+'T12:00:00Z').toLocaleDateString('ka-GE',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Tbilisi'})}
function DataState({error,retry,children}:{error?:string;retry?:()=>Promise<void>;children?:React.ReactNode}){return <div className={'hm-hub-state '+(error?'error':'')} role={error?'alert':'status'}>{error||children||'იტვირთება…'}{error&&retry&&<button type="button" onClick={()=>void retry()}><RefreshCw size={14}/>ხელახლა ცდა</button>}</div>}

export default function WorkHub({actor}:{actor:PermissionActor}){
 const [today]=useState(localToday);
 return <div className="hm-work-hub">
  <div className="hm-hub-date"><img src="/work/pwa/icon-192.png" alt="Hungryman" width={34} height={34}/><div>{actor.features?.youtubeShortcut!==false&&<a href="https://www.youtube.com/@hungrymantv" target="_blank" rel="noopener noreferrer" aria-label="Hungryman YouTube არხი"><Play size={20}/></a>}<time dateTime={today}>{dateLabel(today)}</time></div></div>
  {actor.features?.work!==false&&(actor.isDeveloper?<a className="hm-hub-work-entry" href="/work/tasks"><span><BriefcaseBusiness size={24}/></span><div><strong>Work</strong><small>დავალებები, ვიდეოები და ქოლშითები</small></div><ArrowRight size={20}/></a>:<LockedWorkButton/>)}
  {hasPermission(actor,'shoots.view')&&<NextShoot today={today}/>}
  {hasPermission(actor,'calendar.view')&&<UpcomingWeek today={today}/>}
  {hasPermission(actor,'chat.view')&&actor.features?.teamChat!==false&&<PinnedMessages/>}
  {!hasPermission(actor,'shoots.view')&&!hasPermission(actor,'calendar.view')&&(!hasPermission(actor,'chat.view')||actor.features?.teamChat===false)&&<section className="hm-hub-card"><h1>შენი სამუშაო სივრცე</h1><p>ხელმისაწვდომი გვერდი ქვედა მენიუდან აირჩიე.</p></section>}
 </div>;
}
function NextShoot({today}:{today:string}){
 const result=useWorkData<{shoots:ShootWithTasks[]}>('/api/shoots',30000);
 const now=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tbilisi',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
 const next=result.data?.shoots.filter(shoot=>shoot.status==='planned'&&(shoot.shoot_date>today||shoot.shoot_date===today&&(shoot.end_time||'23:59')>=now)).sort((a,b)=>(a.shoot_date+a.start_time).localeCompare(b.shoot_date+b.start_time))[0];
 return <section className="hm-hub-card hm-hub-next"><header><span className="hm-hub-chip">შემდეგი გადაღება</span><Video size={20}/></header>
  {!result.data?<DataState error={result.error} retry={result.refresh}/>:next?<><h1>{next.title}</h1><ShootPhoto id={next.photo_id}/><p className="hm-hub-shoot-time">{dateLabel(next.shoot_date)}<span>·</span>{next.start_time}</p><p className="hm-hub-location"><MapPin size={17}/>{next.location_name||'ლოკაცია მოგვიანებით დაზუსტდება'}</p><a className="hm-hub-action" href={'/shoots#shoot-'+next.id}>გადაღების დეტალები</a></>:<><h2>ახალი გადაღება ჯერ არ დაგეგმილა</h2><p>დაგეგმილი გადაღება აქ გამოჩნდება.</p></>}
  {result.data&&result.error&&<DataState error="შენახული ასლი · განახლება ვერ მოხერხდა" retry={result.refresh}/>}
 </section>;
}
type CalendarItem={id:string;kind:string;title:string;start_date:string;end_date:string;recurring_yearly:number;start_time?:string|null;employee_name?:string|null;href?:string};
function UpcomingWeek({today}:{today:string}){
 const days=Array.from({length:7},(_,index)=>addDays(today,index));
 const result=useWorkData<{events:CalendarItem[]}>('/api/calendar?from='+today+'&to='+days[6],30000);
 const rows=(result.data?.events||[]).map(event=>({event,date:days.find(day=>appliesOn(event,day))})).filter((row):row is {event:CalendarItem;date:string}=>!!row.date).sort((a,b)=>(a.date+(a.event.start_time||'')).localeCompare(b.date+(b.event.start_time||'')));
 const labels:Record<string,string>={shorts:'Shorts-ის გადაღება',shoot:'გადაღება',salary:'ხელფასი',birthday:'დაბადების დღე',leave:'შვებულება',day_off:'დეი ოფი',sick:'ბიულეტენი',holiday:'უქმე დღე',note:'პირადი ნოუთი'};
 return <section className="hm-hub-week hm-hub-upcoming"><header className="hm-hub-section-title"><h2>მოახლოებული დღეები</h2><span>შემდეგი 7 დღე</span></header>
  {!result.data?<DataState error={result.error} retry={result.refresh}/>:!rows.length?<p className="hm-hub-week-empty">ამ კვირაში მნიშვნელოვანი მოვლენა არ არის დაგეგმილი.</p>:rows.map(({event,date})=>{const EventIcon=event.kind==='shoot'||event.kind==='shorts'?Video:event.kind==='salary'?Wallet:event.kind==='birthday'?Gift:event.kind==='leave'?Sun:CalendarDays;return <a className="hm-hub-event" key={event.id} href={event.href||(event.kind==='shoot'||event.kind==='shorts'?'/shoots#shoot-'+event.id:'/team')}><i className={(date===today?'is-today ':'')+(event.kind==='shorts'?'is-shorts':'')}><EventIcon size={22}/></i><span><strong>{event.title||labels[event.kind]||'მოვლენა'}</strong><small>{date===today?'დღეს':dateLabel(date)}{event.start_time?' · '+event.start_time:''}</small><small>{labels[event.kind]||event.kind}{event.employee_name?' · '+event.employee_name:''}</small></span><ChevronRight size={16}/></a>})}
 </section>;
}
function PinnedMessages(){
 const result=useWorkData<{pinned:{id:string;authorName:string;body:string;kind:string;created:number}[]}>('/api/chat/messages',30000);
 return <section className="hm-hub-pins"><header className="hm-hub-section-title"><h2>აპინული შეტყობინებები</h2><a href="/chat?conversationId=team" aria-label="მთავარი ჩატის გახსნა"><ArrowRight size={22}/></a></header>{!result.data?<div className="hm-hub-card"><DataState error={result.error} retry={result.refresh}/></div>:result.data.pinned.length?result.data.pinned.slice(0,3).map(message=><a key={message.id} className="hm-hub-card hm-hub-pin" href="/chat?conversationId=team"><header><strong>{message.authorName}</strong><Pin size={16}/></header><p>{message.body||(message.kind==='audio'?'ხმოვანი შეტყობინება':'გაზიარებული ფაილი')}</p></a>):<div className="hm-hub-card"><p>ჩატის მნიშვნელოვანი შეტყობინებები აქ შეინახება.</p></div>}</section>;
}
