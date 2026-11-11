import {getAdminAccess,DEVELOPER_EMAIL} from '@/lib/admin';
import AdminHeader from '../admin-header';
import SystemConsole from './system-console';
export const dynamic='force-dynamic';
export default async function SystemPage(){
 const access=await getAdminAccess();
 if(!access?.isDeveloper||access.email!==DEVELOPER_EMAIL)return <main className="staff-shell"><h1>წვდომა შეზღუდულია</h1><p>ეს სივრცე მხოლოდ დეველოპერისთვისაა.</p><a href="/team">ჩემი კაბინეტი</a></main>;
 return <main className="admin-shell"><AdminHeader active="system" access={access}/><SystemConsole/></main>;
}
