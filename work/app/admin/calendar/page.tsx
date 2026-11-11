import {validIsoDate} from '@/lib/staff-calendar';
import {redirect} from 'next/navigation';
import {getAdminAccess} from '@/lib/admin';
import AdminHeader from '../admin-header';
import AdminCalendarClient from './admin-calendar-client';

export const dynamic='force-dynamic';

export default async function AdminCalendarPage({searchParams}:{searchParams:Promise<{date?:string}>}){
 const query=await searchParams,initialDate=typeof query.date==='string'&&validIsoDate(query.date)?query.date:undefined;
 const access=await getAdminAccess();
 if(!access?.canAccessAdmin)redirect('/team');
 if(!access.canManageCalendar)redirect('/admin');
 return <main className="admin-shell"><AdminHeader active="calendar" isOwner={access.isOwner} canManagePeople={access.canManageEmployees}/><section className="mx-auto w-full max-w-[1480px] px-4 pb-16 pt-8 sm:px-6 lg:px-10"><div className="mb-8"><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-sky-300">გუნდის მართვა</p><h1 className="text-3xl font-black text-white sm:text-4xl">კალენდრის მართვა</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">სამუშაო საათები, შვებულება, დასვენების დღეები, ოვერთაიმი და გუნდისთვის საერთო ინფორმაცია.</p></div><AdminCalendarClient initialDate={initialDate}/></section></main>;
}
