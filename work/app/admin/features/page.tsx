import {getAdminAccess} from '@/lib/admin';
import {canControl,featureCatalog} from '@/lib/site-controls';
import AdminHeader from '../admin-header';
import FeaturesPanel from './panel';
export const dynamic='force-dynamic';
export default async function Page(){const access=await getAdminAccess();if(!access||!featureCatalog.some(f=>canControl(access,'features.'+f.key)))return <main className="staff-shell"><h1>წვდომა შეზღუდულია</h1><a href="/team">ჩემი კაბინეტი</a></main>;return <main className="admin-shell"><AdminHeader access={access} active="features"/><FeaturesPanel/></main>}
