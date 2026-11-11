import {getWorkContext,requireWorkWrite,workRouteError} from '@/lib/work-policy';
import {createWorkTask,listWorkTasks,readWorkBody} from '@/lib/work-tasks';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:Request){try{return Response.json(await listWorkTasks(await getWorkContext(),new URL(req.url)),{headers})}catch(error){return workRouteError(error)}}
export async function POST(req:Request){try{requireWorkWrite(req);const context=await getWorkContext(),task=await createWorkTask(context,await readWorkBody(req));return Response.json({task},{status:201,headers})}catch(error){return workRouteError(error)}}
