import {getWorkContext,workRouteError} from '@/lib/work-policy';
import {workMeta} from '@/lib/work-store';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json(await workMeta(await getWorkContext()),{headers:{'Cache-Control':'private, no-store'}})}catch(e){return workRouteError(e)}}
