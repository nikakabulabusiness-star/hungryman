import {redirect} from 'next/navigation';
import WorkWorkspace from './work-workspace';
export const dynamic='force-dynamic';
export default async function WorkTasksPage({searchParams}:{searchParams:Promise<{board?:string;view?:string;video?:string;task?:string}>}){
 const params=await searchParams;
 if(params.video&&/^[a-zA-Z0-9_-]{1,100}$/.test(params.video))redirect('/work/tasks/video/'+encodeURIComponent(params.video));
 return <WorkWorkspace initialBoard={params.board} initialView={params.view} initialTask={params.task}/>;
}
