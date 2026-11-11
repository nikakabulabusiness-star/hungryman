/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors preserve navigation when the Vinext router is unavailable. */
import {notFound} from 'next/navigation';
import {ChevronRight,Users,KeyRound,BriefcaseBusiness,Network,Inbox,CalendarDays,MapPin,ChartNoAxesCombined,ShieldCheck,SlidersHorizontal,Blocks,Mail} from 'lucide-react';
import {requireApprovedStaff} from '@/lib/staff-access';
import {hasPermission} from '@/lib/permissions';
import {canControl,featureCatalog} from '@/lib/site-controls';
import {canReviewRequests} from '@/lib/notification-policy';
import {canManageAbsences} from '@/lib/absence-policy';
import StaffHeader from '@/app/team/staff-header';
import '../work-hub.css';
export const dynamic='force-dynamic';
export default async function ManagePage(){
 const actor=await requireApprovedStaff('/work/manage');
 if(!hasPermission(actor,'admin.view')&&!hasPermission(actor,'youtube.view'))notFound();
 const groups=[
  {title:'გუნდი',items:[
   {href:'/admin/access',title:'ანგარიშები',sub:'მოთხოვნები და უფლებები',icon:KeyRound,show:hasPermission(actor,'accounts.view')},
   {href:'/admin/employees',title:'თანამშრომლები',sub:'გუნდი და ინფორმაცია',icon:Users,show:hasPermission(actor,'employees.view')},
   {href:'/admin/positions',title:'შტატები',sub:'პოზიციები და უფლებები',icon:BriefcaseBusiness,show:hasPermission(actor,'positions.view')},
   {href:'/admin/departments',title:'დეპარტამენტები',sub:'გუნდი და იერარქია',icon:Network,show:hasPermission(actor,'departments.view')},
  ]},
  {title:'სამუშაო სივრცე',items:[
   {href:'/admin/time-off',title:'შემოსული მოთხოვნები',sub:'შვებულება, დეი ოფი და პასუხები',icon:Inbox,show:canReviewRequests(actor)},
   {href:'/admin/absences',title:'შვებულებები და ბიულეტენები',sub:'თარიღები, დოკუმენტები და ისტორია',icon:CalendarDays,show:canManageAbsences(actor)},
   {href:'/admin/inbox',title:'საიტის შემოსულები',sub:'შეტყობინებები, კასტინგი და ფოსტა',icon:Mail,show:hasPermission(actor,'inbox.view')},
   {href:'/admin',title:'განაცხადები',sub:'კანდიდატები და ვაკანსიები',icon:BriefcaseBusiness,show:hasPermission(actor,'applications.view')},
   {href:'/admin/calendar',title:'კალენდრის მართვა',sub:'შვებულება და სამუშაო დრო',icon:CalendarDays,show:hasPermission(actor,'calendar.manage')},
   {href:'/admin/attendance',title:'ოფისი და დასწრება',sub:'ლოკაცია, დღეები და საათები',icon:MapPin,show:hasPermission(actor,'attendance.view')},
  ]},
  {title:'ანალიტიკა',items:[
   {href:'/team/social',title:'სოციალური მედია',sub:'არხები და მაჩვენებლები',icon:ChartNoAxesCombined,show:hasPermission(actor,'social.view')},
   {href:'/admin/analytics',title:'საიტი და გუნდი',sub:'სტატისტიკა და ანგარიშები',icon:ChartNoAxesCombined,show:hasPermission(actor,'analytics.view')},
  ]},
 ];
 return <main className="staff-shell hm-work-manage"><StaffHeader access={actor} active="admin"/><div className="hm-work-hub"><div className="hm-hub-date"><span>მართვის ცენტრი</span></div>
  {actor.isDeveloper&&<><a className="hm-hub-card hm-manage-special" href="/admin/system"><ShieldCheck size={23}/><span><strong>ადმინისტრაციის მართვა</strong><small>სისტემური უფლებები და ანგარიშების ბაზა</small></span><ChevronRight size={18}/></a><a className="hm-hub-card hm-manage-special" href="/admin/functions"><Blocks size={23}/><span><strong>ფუნქციების ამოღება</strong><small>ამოღება, აღდგენა და ცვლილებების ისტორია</small></span><ChevronRight size={18}/></a></>}
  {featureCatalog.some(feature=>canControl(actor,'features.'+feature.key))&&<a className="hm-hub-card hm-manage-special regular" href="/admin/features"><SlidersHorizontal size={22}/><span><strong>საიტის ფუნქციები</strong><small>შენთვის ხელმისაწვდომი პარამეტრები</small></span><ChevronRight size={18}/></a>}
  {groups.filter(group=>group.items.some(item=>item.show)).map(group=><section className="hm-manage-group" key={group.title}><h2>{group.title}</h2><div className="hm-hub-card">{group.items.filter(item=>item.show).map(item=><a key={item.href} href={item.href}><i><item.icon size={20}/></i><span><strong>{item.title}</strong><small>{item.sub}</small></span><ChevronRight size={17}/></a>)}</div></section>)}
 </div></main>;
}
