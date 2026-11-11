import {hasPermission} from '@/lib/permissions';
import {redirect} from 'next/navigation';
/* eslint-disable @next/next/no-html-link-for-pages -- keep a native fallback independent of Vinext hydration. */
import {getAdminAccess} from '@/lib/admin';
import {storage} from '@/lib/storage';
import {getVacancyStates} from '@/lib/vacancies';
import {chatGPTSignInPath,getChatGPTUser} from '@/app/chatgpt-auth';
import AdminDashboard from './admin-dashboard';

export const dynamic='force-dynamic';

type ApplicationRow={id:string;created:number;name:string;email:string;position:string;answers:string;file_name:string|null;status:string;rating:number;form_rating:number;manual_order:number;admin_note:string};

export default async function Admin(){
 const user=await getChatGPTUser();
 if(!user)return <main><h1>განაცხადების კაბინეტი</h1><a className="action" href={chatGPTSignInPath('/admin')}>ავტორიზაცია</a></main>;
 const access=await getAdminAccess();
 if(!access?.canAccessAdmin)return <main><h1>წვდომა შეზღუდულია</h1><p>ამ გვერდის ნახვა მხოლოდ ავტორიზებულ თანამშრომელს შეუძლია.</p><a href="/">ვაკანსიებზე დაბრუნება</a></main>;
 if(!hasPermission(access,'applications.view')){const destinations=[['positions.view','/admin/positions'],['accounts.view','/admin/access'],['employees.view','/admin/employees'],['calendar.manage','/admin/calendar'],['departments.view','/admin/departments'],['analytics.view','/admin/analytics']] as const;const next=destinations.find(([key])=>hasPermission(access,key));if(next)redirect(next[1]);return <main><h1>ადმინისტრატორის პანელი</h1><p>ამ შტატისთვის ადმინისტრაციის სექციები არ არის ჩართული.</p><a href='/team'>ჩემი სივრცე</a></main>}
 let applications:ApplicationRow[],states:Awaited<ReturnType<typeof getVacancyStates>>;
 try{
  const {DB}=storage();
  const [applicationResult,vacancyStates]=await Promise.all([
   DB.prepare('SELECT id,created,name,email,position,answers,file_name,status,rating,form_rating,manual_order,admin_note FROM applications ORDER BY created DESC LIMIT 500').all<ApplicationRow>(),
   getVacancyStates(),
  ]);
  applications=applicationResult.results;states=vacancyStates;
 }catch{return <main><h1>განაცხადები დროებით მიუწვდომელია</h1><p>შენახული მონაცემები არ შეცვლილა.</p><a className="action" href="/admin">სცადე ხელახლა</a></main>}
 return <AdminDashboard initialRows={applications} vacancies={Object.values(states)} isOwner={access.isOwner} canManagePeople={access.canManageEmployees} canDeleteApplications={access.canDeleteApplications} canAddCandidates={hasPermission(access,'applications.edit')} permissions={access}/>;
}
