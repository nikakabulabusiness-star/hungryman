import {redirect} from 'next/navigation';
import {getAdminAccess} from '@/lib/admin';
import {getPositions} from '@/lib/positions';
import {getDepartments} from '@/lib/departments';
import {canManageRole,hasPermission,permissionGroups,permissionKeys} from '@/lib/permissions';
import AdminHeader from '../admin-header';
import PositionsManager from './positions-manager';
import './roles.css';
export const dynamic='force-dynamic';
export default async function PositionsPage(){
 const access=await getAdminAccess();if(!access||!hasPermission(access,'positions.view'))redirect('/team');
 const [positions,departments]=await Promise.all([getPositions(),getDepartments()]);
 return <main className="admin-shell"><AdminHeader active="positions" isOwner={access.isOwner} canManagePeople={access.canManageAccess} access={access}/><div className="admin-heading"><div><p className="eyebrow">გუნდის სტრუქტურა</p><h1>შტატების მართვა</h1><p className="lead">შტატები, დეპარტამენტები და თითოეული პოზიციის უფლებები ერთ სივრცეში.</p></div></div><PositionsManager initialPositions={positions} departments={departments} groups={permissionGroups} editableNames={positions.filter(position=>canManageRole(access,position.name)).map(position=>position.name)} grantable={permissionKeys.filter(key=>hasPermission(access,key))} canCreate={hasPermission(access,'positions.manage')&&canManageRole(access,'ახალი შტატი')} isDeveloper={access.isDeveloper} canEditStructure={access.isDeveloper||access.isSiteAdmin||access.role==='Owner'||access.role==='HR'}/></main>;
}
