import LockedWorkButton from '@/components/locked-work-button';
import {hasPermission} from '@/lib/permissions';
import {NotificationButtons} from '@/components/work-notifications';
import {canReviewRequests} from '@/lib/notification-policy';
import {canManageAbsences} from '@/lib/absence-policy';
import {ShootsDropdown} from '@/components/header-previews';
/* eslint-disable @next/next/no-html-link-for-pages -- Vinext Link currently cancels navigation when its client router fails. */
import {ShieldCheck,UserRound} from 'lucide-react';
import type {StaffAccess} from '@/lib/staff-access';
import WorkspaceMenu,{type WorkspaceLink} from '@/components/workspace-menu';
import ChatWidget from './chat-widget';
import LogoutButton from './logout-button';
import {WorkSessionSeed} from '@/components/work-mobile-shell';

export type NextShootNotice={id:string;title:string;shootDate:string;startTime?:string|null};
export type StaffPage='team'|'shoots'|'chat'|'admin'|'social'|'map';

export default function StaffHeader({access,nextShoot,active}:{access:StaffAccess;nextShoot?:NextShootNotice|null;active:StaffPage}){
 const links:WorkspaceLink[]=[...(access.features?.work!==false?[{id:'work' as const,locked:!access.isDeveloper,href:'/work/tasks',label:'Work · სამუშაო სივრცე'}]:[]),...(access.isDeveloper?[{id:'system' as const,href:'/admin/system',label:'ადმინისტრაციის მართვა'}]:[]),...(access.features?.map!==false&&hasPermission(access,'workspace.view')?[{id:'map' as const,href:'/team/map',label:'რუკა'}]:[]),...(hasPermission(access,'cabinet.view')?[{id:'team' as const,href:'/team',label:'ჩემი კაბინეტი'}]:[]),...(hasPermission(access,'shoots.view')?[{id:'shoots' as const,href:'/shoots',label:'გადაღებები'}]:[]),...(hasPermission(access,'departments.view')?[{id:'departments' as const,href:'/admin/departments',label:'დეპარტამენტები'}]:[]),...(canManageAbsences(access)?[{id:'absences' as const,href:'/admin/absences',label:'შვებულებები და ბიულეტენები'}]:[]),...(hasPermission(access,'social.view')?[{id:'social' as const,href:'/team/social',label:'სოციალური მედია'}]:[]),...(access.canAccessAdmin?[{id:'applications' as const,href:'/admin',label:'ადმინისტრატორის პანელი'}]:[]),{id:'home' as const,href:'/',label:'მთავარი გვერდი'}];
 return <><WorkSessionSeed session={{user:{userId:access.userId,fullName:access.fullName,hasAvatar:access.hasAvatar,profileUpdated:access.profileUpdated},permissions:access}}/><header className="staff-brandbar workspace-desktop"><a className="brand" href="/">HUNGRY<span>MAN</span></a><nav aria-label="თანამშრომლის სივრცე">{access.features?.work!==false&&(access.isDeveloper?<a className="action staff-work-link" href="/work/tasks">Work</a>:<LockedWorkButton/>)}
  {hasPermission(access,'shoots.view')&&nextShoot&&<a className="next-shoot-marker" href={'/shoots#shoot-'+nextShoot.id} title={nextShoot.title}><span className="next-shoot-full">გადაღება · {formatShootDate(nextShoot.shootDate)}{nextShoot.startTime?' · '+nextShoot.startTime:''}</span><span className="next-shoot-short">გადაღება</span></a>}
  {hasPermission(access,'cabinet.view')&&<a className={`staff-round-link ${active==='team'?'active':''}`} href="/team" aria-current={active==='team'?'page':undefined} aria-label="ჩემი კაბინეტი" title="ჩემი კაბინეტი"><UserRound/></a>}
  {hasPermission(access,'shoots.view')&&<ShootsDropdown active={active==='shoots'}/>}
  <NotificationButtons review={canReviewRequests(access)}/>{hasPermission(access,'chat.view')&&<ChatWidget active={active==='chat'}/>}
  {access.canAccessAdmin&&<a className={`action staff-admin-link ${active==='admin'?'active':''}`} href="/admin" aria-current={active==='admin'?'page':undefined} title="ადმინისტრატორის პანელი"><ShieldCheck/><span>ადმინისტრატორის პანელი</span></a>}
  {access.isDeveloper&&<a className="action" style={{background:"#392b60",color:"#d8c5ff"}} href="/admin/system">ადმინისტრაციის მართვა</a>}
  <LogoutButton/>
 </nav></header><header className="workspace-mobile work-notification-header">{hasPermission(access,'shoots.view')&&<ShootsDropdown active={active==='shoots'}/>}<NotificationButtons review={canReviewRequests(access)}/>{hasPermission(access,'chat.view')&&<ChatWidget active={active==='chat'}/>}<a className="brand" href="/">HUNGRY<span>MAN</span></a><WorkspaceMenu links={links} active={active}/></header><nav className="workspace-quicknav" aria-label="ჩემი სივრცე">{links.filter(link=>link.id!=='home').map(link=>link.locked?<LockedWorkButton key={link.id}/>:<a key={link.id} href={link.href} className={active===link.id?'active':''}>{link.label}</a>)}<LogoutButton/></nav></>
}

function formatShootDate(value:string){try{return new Intl.DateTimeFormat('ka-GE',{day:'numeric',month:'short',timeZone:'Asia/Tbilisi'}).format(new Date(value+'T12:00:00+04:00'))}catch{return value}}
