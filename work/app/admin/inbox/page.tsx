import {redirect} from 'next/navigation';
import {getAdminAccess} from '@/lib/admin';
import {hasPermission} from '@/lib/permissions';
import {requireSessionUser} from '@/lib/staff-auth';
import AdminHeader from '../admin-header';
import Inbox from './inbox-client';
export const dynamic='force-dynamic';
export default async function Page(){await requireSessionUser('/admin/inbox');const access=await getAdminAccess();if(!hasPermission(access,'inbox.view'))redirect('/team');return <main className="admin-shell"><AdminHeader active="inbox" access={access!}/><div className="admin-heading"><div><p className="eyebrow">HUNGRYMAN.GE</p><h1>მთავარი საიტის შემოსულები</h1></div></div><Inbox canManage={hasPermission(access,'inbox.manage')}/></main>}
