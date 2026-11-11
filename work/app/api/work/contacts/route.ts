import {getWorkContext,requireWorkWrite,workRouteError} from '@/lib/work-policy';
import {readWorkBody} from '@/lib/work-tasks';
import {createWorkContact,listWorkContacts} from '@/lib/work-contacts';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:Request){try{return Response.json(await listWorkContacts(await getWorkContext(),new URL(req.url)),{headers})}catch(error){return workRouteError(error)}}
export async function POST(req:Request){try{requireWorkWrite(req);const context=await getWorkContext(),contact=await createWorkContact(context,await readWorkBody(req));return Response.json({contact},{status:201,headers})}catch(error){return workRouteError(error)}}
