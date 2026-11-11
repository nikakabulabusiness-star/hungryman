'use client';
import LockedWorkButton from '@/components/locked-work-button';
import {canControl,featureCatalog} from '@/lib/site-controls';
import {TimeOffBell,useWorkData} from '@/components/cabinet-panel';
import {canManageAbsences} from '@/lib/absence-policy';
import ChatWidget from '@/app/team/chat-widget';
import {WorkSessionSeed,type WorkMobileSession} from '@/components/work-mobile-shell';
import WorkspaceMenu,{type WorkspaceLink} from '@/components/workspace-menu';
import {hasPermission,type PermissionActor,type PermissionKey} from '@/lib/permissions';
type AdminPage='functions'|'features'|'system'|'absences'|'inbox'|'applications'|'employees'|'access'|'shoots'|'calendar'|'positions'|'departments'|'analytics'|'attendance';
const sections:{id:AdminPage;href:string;label:string;permission:PermissionKey}[]=[
 {id:'inbox',href:'/admin/inbox',label:'საიტის შემოსულები',permission:'inbox.view'},
 {id:'applications',href:'/admin',label:'განაცხადები',permission:'applications.view'},
 {id:'employees',href:'/admin/employees',label:'თანამშრომლები',permission:'employees.view'},
 {id:'positions',href:'/admin/positions',label:'შტატები და უფლებები',permission:'positions.view'},
 {id:'departments' as const,href:'/admin/departments',label:'დეპარტამენტები',permission:'departments.view'},
 {id:'access',href:'/admin/access',label:'ანგარიშები',permission:'accounts.view'},
 {id:'shoots' as const,href:'/admin/shoots',label:'გადაღებები',permission:'shoots.view'},
 {id:'calendar',href:'/admin/calendar',label:'კალენდარი',permission:'calendar.manage'},
 {id:'attendance',href:'/admin/attendance',label:'ოფისი და დასწრება',permission:'attendance.view'},
 {id:'analytics',href:'/admin/analytics',label:'ანალიტიკა',permission:'analytics.view'},
];
export default function AdminHeader({active,access:initialAccess}:{active:AdminPage;isOwner?:boolean;canManagePeople?:boolean;access?:PermissionActor}){
 const me=useWorkData<WorkMobileSession>('/api/mobile/me',30000),access=me.data?.permissions||initialAccess;
 const links:WorkspaceLink[]=[...(access?.features?.work!==false?[{id:'work' as const,locked:!access?.isDeveloper,href:'/work/tasks',label:'Work · სამუშაო სივრცე'}]:[]),...(access?.isDeveloper?[{id:'system' as const,href:'/admin/system',label:'ადმინისტრაციის მართვა'},{id:'functions' as const,href:'/admin/functions',label:'ფუნქციების ამოღება'}]:[]),...(featureCatalog.some(f=>canControl(access,'features.'+f.key))?[{id:'features' as const,href:'/admin/features',label:'საიტის ფუნქციები'}]:[]),...sections.filter(item=>hasPermission(access,item.permission)).map(({permission,...link})=>link),...(canManageAbsences(access)?[{id:'absences' as const,href:'/admin/absences',label:'შვებულებების მართვა'}]:[]),...(hasPermission(access,'cabinet.view')?[{id:'team' as const,href:'/team',label:'ჩემი კაბინეტი'}]:[]),{id:'home' as const,href:'/',label:'მთავარი გვერდი'}];
 const chat=hasPermission(access,'chat.view'),requests=hasPermission(access,'cabinet.view')||hasPermission(access,'calendar.manage');
 return <>{me.data&&<WorkSessionSeed session={me.data}/>}<header className="top admin-header workspace-desktop"><a className="brand" href="/">HUNGRY<span>MAN</span></a><span className="badge">ადმინისტრატორის პანელი</span><nav className="admin-nav" aria-label="ადმინისტრაციის გვერდები">{links.map(link=>link.locked?<LockedWorkButton key={link.id}/>:<a key={link.id} href={link.href} style={link.href==='/admin/system'?{background:'#392b60',color:'#d8c5ff',marginLeft:12,borderRadius:12}:undefined} className={active===link.id?'active':''} aria-current={active===link.id?'page':undefined}>{link.label}</a>)}{requests&&<TimeOffBell/>}{chat&&<ChatWidget/>}</nav></header><header className="workspace-mobile">{requests&&<TimeOffBell/>}{chat&&<ChatWidget/>}<a className="brand" href="/">HUNGRY<span>MAN</span></a><WorkspaceMenu links={links} active={active} title="ადმინისტრაცია"/></header><nav className="workspace-quicknav" aria-label="სწრაფი გადასვლა">{links.filter(link=>['applications','employees','positions','departments','calendar','analytics'].includes(link.id)).map(link=><a key={link.id} style={link.href==='/admin/system'?{background:'#392b60',color:'#d8c5ff',marginLeft:12,borderRadius:12}:undefined} className={active===link.id?'active':''} href={link.href} aria-current={active===link.id?'page':undefined}>{link.label}</a>)}</nav></>;
}
