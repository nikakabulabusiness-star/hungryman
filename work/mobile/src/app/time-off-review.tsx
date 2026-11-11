import {AttendanceRequests} from '../ui/attendance-requests';
import {canReviewRequests} from '../ui/notification-center';
import {Screen,State} from '../ui/components';import {TimeOffList} from '../ui/cabinet-panel';import {useAuth} from '../lib/auth';export default function Review(){const session=useAuth().session;return <Screen back title="მოთხოვნების განხილვა">{canReviewRequests(session)?<>{session?.permissions?.features?.attendance!==false&&<AttendanceRequests/>}<TimeOffList review/></>:<State error="წვდომა შეზღუდულია"/>}</Screen>}
