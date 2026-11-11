import {getAdminAccess} from '@/lib/admin';
import AdminHeader from '../admin-header';
import FunctionPanel from './panel';
export const dynamic='force-dynamic';
export default async function Page(){const a=await getAdminAccess();if(!a?.isDeveloper)return <main className="staff-shell"><h1>მხოლოდ დეველოპერისთვის.</h1><a href="/team">ჩემი კაბინეტი</a></main>;return <main className="admin-shell"><AdminHeader access={a} active="functions"/><FunctionPanel/></main>}
