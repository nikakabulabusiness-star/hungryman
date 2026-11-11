import {useAuth} from '../lib/auth';
import {canUseSocial} from '../lib/social';
import {Screen,State} from '../ui/components';
import {SocialAnalytics} from '../ui/social';
export default function Social(){const {session}=useAuth();return <Screen title="სოციალური მედია" back>{canUseSocial(session?.user.role)?<SocialAnalytics/>:<State empty="ამ გვერდზე წვდომა შეზღუდულია"/>}</Screen>}
