import WorkVideoClient from '@/components/work-callsheet-client';
import {workBoards,type WorkBoard} from '@/mobile/src/lib/work-model';

export const dynamic='force-dynamic';
export default async function WorkVideoPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{board?:string}>}){
 const [{id},query]=await Promise.all([params,searchParams]);
 const board=workBoards.some(b=>b.id===query.board)?query.board as WorkBoard:undefined;
 return <WorkVideoClient id={id} initialBoard={board}/>;
}
