import {requireApprovedStaff} from '@/lib/staff-access';
import {hasPermission} from '@/lib/permissions';
import StaffHeader from '../staff-header';
import {TeamMap} from '@/components/work-map';
export const dynamic='force-dynamic';
export default async function Page(){const access=await requireApprovedStaff('/team/map');return <main className="staff-shell"><StaffHeader access={access} active="map"/>{access.features?.map!==false&&hasPermission(access,'workspace.view')?<TeamMap/>:<p>რუკაზე წვდომა შეზღუდულია.</p>}</main>}
