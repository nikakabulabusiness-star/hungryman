import {workBoards,type WorkBoard,type WorkVideo} from '@/mobile/src/lib/work-model';

/** Approval stages only move through the dedicated server-checked approval action. */
export function availableWorkMoves(board:WorkBoard,current:string|null){
 const stages=workBoards.find(item=>item.id===board)?.stages||[];
 if(current===null||current==='review')return [];
 const index=stages.findIndex(stage=>stage.id===current);
 if(index<0)return [];
 if(board==='editing')return stages.filter((_stage,stageIndex)=>Math.abs(stageIndex-index)===1);
 return stages.filter((stage,stageIndex)=>Math.abs(stageIndex-index)===1&&stage.id!=='approved'&&stage.id!=='scheduled'&&(stage.id!=='review'||stageIndex>index));
}
export async function moveWorkVideo(video:WorkVideo,board:WorkBoard,stage:string,request:(id:string,body:{version:number;board:WorkBoard;action:'move';stage:string})=>Promise<{video:WorkVideo}>,optimistic:(video:WorkVideo)=>void,rollback:()=>void){
 if(!video.permissions.editBoards.includes(board)||!availableWorkMoves(board,video.stages[board]).some(item=>item.id===stage))throw Error('ამ ეტაპზე გადატანა არ არის ხელმისაწვდომი.');
 optimistic({...video,stages:{...video.stages,[board]:stage}});
 try{const result=await request(video.id,{version:video.version,board,action:'move',stage});optimistic(result.video);return result.video}catch(error){rollback();throw error}
}
