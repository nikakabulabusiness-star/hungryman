import {getWorkContext,requireWorkWrite,workRouteError} from '@/lib/work-policy';
import {deleteWorkTask,getWorkTask,readWorkBody,updateWorkTask} from '@/lib/work-tasks';
export const dynamic='force-dynamic';
type Route={params:Promise<{id:string}>};
const headers={'Cache-Control':'private, no-store'};
export async function GET(_req:Request,{params}:Route){try{return Response.json({task:await getWorkTask(await getWorkContext(),(await params).id)},{headers})}catch(error){return workRouteError(error)}}
export async function PATCH(req:Request,{params}:Route){try{requireWorkWrite(req);const context=await getWorkContext(),task=await updateWorkTask(context,(await params).id,await readWorkBody(req));return Response.json({task},{headers})}catch(error){return workRouteError(error)}}
export async function DELETE(req:Request,{params}:Route){try{requireWorkWrite(req);return Response.json(await deleteWorkTask(await getWorkContext(),(await params).id,await readWorkBody(req)),{headers})}catch(error){return workRouteError(error)}}
