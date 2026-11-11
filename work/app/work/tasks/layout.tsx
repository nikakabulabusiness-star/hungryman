import {notFound} from 'next/navigation';
import {requireApprovedStaff} from '@/lib/staff-access';
import {hasPermission} from '@/lib/permissions';
import {getWorkContext} from '@/lib/work-policy';
import StaffHeader from '@/app/team/staff-header';
import WorkFrame from './work-frame';
import './work-space.css';

export const dynamic='force-dynamic';
export default async function WorkTasksLayout({children}:{children:React.ReactNode}){
 const access=await requireApprovedStaff('/work/tasks');
 if(!access.isDeveloper||!hasPermission(access,'workspace.view')||access.features?.work===false)notFound();
 const context=await getWorkContext(access);
 return <main className="staff-shell hm-work-space"><StaffHeader access={access} active="team"/><WorkFrame name={access.fullName} canApprove={context.canApprove} canContacts={context.canContacts}>{children}</WorkFrame></main>;
}
