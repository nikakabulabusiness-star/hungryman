import {getWorkContext,requireWorkWrite,workRouteError,WorkError,readWorkText} from '@/lib/work-policy';
import {listWorkVideos,createWorkVideo,validWorkBoard} from '@/lib/work-store';
import type {WorkVideoCreate} from '@/mobile/src/lib/work-model';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const context=await getWorkContext(),query=new URL(req.url).searchParams,board=query.get('board');if(board&&!validWorkBoard(board))throw new WorkError(400,'სამუშაო დაფა არასწორია.');return Response.json(await listWorkVideos(context,validWorkBoard(board)?board:undefined,{cursor:query.get('cursor'),review:query.get('review')==='1'}),{headers:{'Cache-Control':'private, no-store'}})}catch(e){return workRouteError(e)}}
export async function POST(req:Request){try{requireWorkWrite(req);const context=await getWorkContext(),raw=await readWorkText(req);let input:WorkVideoCreate;try{input=JSON.parse(raw)}catch{throw new WorkError(400,'მონაცემები არასწორია.')}return Response.json({video:await createWorkVideo(context,input)},{status:201,headers:{'Cache-Control':'private, no-store'}})}catch(e){return workRouteError(e)}}
