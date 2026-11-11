import {hasPermission} from '@/lib/permissions';
import {redirect} from 'next/navigation';
import {getAdminAccess} from '@/lib/admin';
import AdminHeader from '../admin-header';
import AnalyticsClient from './analytics-client';
export const dynamic='force-dynamic';
export default async function AnalyticsPage(){
 const access=await getAdminAccess();if(!access||!hasPermission(access,'analytics.view'))redirect('/team');
 return <main className="admin-shell"><AdminHeader access={access} active="analytics" isOwner={access.isOwner} canManagePeople={access.canManageEmployees}/><div className="admin-heading"><div><p className="eyebrow">მონაცემები ერთ სივრცეში</p><h1>ანალიტიკა</h1></div></div><AnalyticsClient canManagePeople={access.canManageEmployees}/></main>;
}
