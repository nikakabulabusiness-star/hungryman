import {hasPermission} from '@/lib/permissions';
import {redirect} from 'next/navigation';
import {requireApprovedStaff} from '@/lib/staff-access';
import {canUseSocial} from '@/lib/social';
import {SocialAnalytics} from '@/components/social-workspace';
import StaffHeader from '../staff-header';
export const dynamic='force-dynamic';
export default async function SocialPage(){const access=await requireApprovedStaff('/team/social');if(!hasPermission(access,'social.view'))redirect('/team');return <main className="staff-shell"><StaffHeader access={access} active="social"/><section className="staff-hero"><div><p className="eyebrow">Hungryman Work</p><h1>სოციალური მედია</h1></div></section><SocialAnalytics canManage={hasPermission(access,'social.manage')}/></main>}
