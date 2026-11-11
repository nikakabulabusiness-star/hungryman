import {getWorkContext,requireWorkWrite,workRouteError} from '@/lib/work-policy';
import {readWorkBody} from '@/lib/work-tasks';
import {deleteWorkContact,getWorkContact,updateWorkContact} from '@/lib/work-contacts';
export const dynamic='force-dynamic';
type Route={params:Promise<{id:string}>};
const headers={'Cache-Control':'private, no-store'};
export async function GET(_req:Request,{params}:Route){try{return Response.json({contact:await getWorkContact(await getWorkContext(),(await params).id)},{headers})}catch(error){return workRouteError(error)}}
export async function PATCH(req:Request,{params}:Route){try{requireWorkWrite(req);const context=await getWorkContext(),contact=await updateWorkContact(context,(await params).id,await readWorkBody(req));return Response.json({contact},{headers})}catch(error){return workRouteError(error)}}
export async function DELETE(req:Request,{params}:Route){try{requireWorkWrite(req);return Response.json(await deleteWorkContact(await getWorkContext(),(await params).id,await readWorkBody(req)),{headers})}catch(error){return workRouteError(error)}}
