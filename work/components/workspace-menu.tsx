'use client';
import LockedWorkButton from '@/components/locked-work-button';
import {Menu,ArrowUpRight,LayoutDashboard,UsersRound,UserRound,Clapperboard,CalendarDays,ChartNoAxesCombined,BriefcaseBusiness,KeyRound,Home,MapPin} from 'lucide-react';
import {Sheet,SheetTrigger,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';
const icons={work:BriefcaseBusiness,functions:KeyRound,features:KeyRound,system:KeyRound,absences:CalendarDays,inbox:LayoutDashboard,map:MapPin,departments:UsersRound,social:ChartNoAxesCombined,attendance:CalendarDays,applications:LayoutDashboard,employees:UsersRound,access:KeyRound,positions:BriefcaseBusiness,analytics:ChartNoAxesCombined,shoots:Clapperboard,calendar:CalendarDays,team:UserRound,home:Home};
export type WorkspaceLink={id:keyof typeof icons;href:string;locked?:boolean;label:string};
export default function WorkspaceMenu({links,active,title='ჩემი სივრცე'}:{links:WorkspaceLink[];active:string;title?:string}){
 return <Sheet><SheetTrigger asChild><button className="workspace-menu-toggle" aria-label="მენიუს გახსნა"><Menu size={22}/></button></SheetTrigger><SheetContent className="workspace-menu-sheet" showCloseButton><SheetTitle>{title}</SheetTitle><SheetDescription>აირჩიე განყოფილება</SheetDescription><nav aria-label={title}>{links.map(link=>{if(link.locked)return <LockedWorkButton key={link.id}/>;const Icon=icons[link.id];return <a key={link.id} href={link.href} style={link.id==='system'?{background:'#392b60',color:'#d8c5ff'}:undefined} className={active===link.id?'active':''} aria-current={active===link.id?'page':undefined}><span><Icon size={19}/></span>{link.label}<ArrowUpRight size={15}/></a>})}</nav></SheetContent></Sheet>;
}
