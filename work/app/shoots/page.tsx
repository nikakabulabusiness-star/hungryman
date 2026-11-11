import {hasPermission} from '@/lib/permissions';
import {listApprovedStaff,requireApprovedStaff,syncStaffProfile} from '@/lib/staff-access';
import {getNextShoot,listShootsWithTasks} from '@/lib/shoots';
import {redirect} from 'next/navigation';
import StaffHeader from '@/app/team/staff-header';
import ShootsClient from './shoots-client';

export const dynamic='force-dynamic';

export default async function ShootsPage({searchParams}:{searchParams:Promise<{kind?:string}>}){
 const initialKind=(await searchParams).kind==='short'?'short':'video';
 const access=await syncStaffProfile(await requireApprovedStaff('/shoots'));
 if(!hasPermission(access,'shoots.view'))redirect('/team');
 const [shoots,people,nextShoot]=await Promise.all([listShootsWithTasks(),listApprovedStaff(),getNextShoot()]);
 return <main className="staff-shell shoots-page"><StaffHeader active="shoots" access={access} nextShoot={nextShoot?{id:nextShoot.id,title:nextShoot.title,shootDate:nextShoot.shoot_date,startTime:nextShoot.start_time}:null}/><section className="staff-hero"><div><p className="eyebrow">HUNGRYMAN WORK</p><h1>გადაღებების გეგმა</h1><p className="muted">თარიღები, მდებარეობა, მონაწილეები და თითოეული ადამიანის დავალება.</p></div></section><ShootsClient initialKind={initialKind} canWorkFlow={access.features?.work!==false} initialShoots={shoots} people={people} canCreate={access.canCreateShoots} canEdit={access.canEditShoots} canDelete={hasPermission(access,'shoots.delete')}/></main>;
}
