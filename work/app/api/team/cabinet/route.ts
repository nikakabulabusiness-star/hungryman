import {hasPermission} from '@/lib/permissions';
import {getStaffAccess} from '@/lib/staff-access';
import {cabinetStats} from '@/lib/cabinet';
import {localDate} from '@/lib/attendance';
import {monthRange} from '@/lib/staff-calendar';
export const dynamic='force-dynamic';
export async function GET(req:Request){const a=await getStaffAccess();if(!a?.isApproved||!hasPermission(a,'cabinet.view'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});const month=new URL(req.url).searchParams.get('month')||localDate().slice(0,7);if(!monthRange(month))return Response.json({error:'არასწორი თვე.'},{status:400});return Response.json(await cabinetStats(a.email,a.userId,month),{headers:{'Cache-Control':'private, no-store'}})}
