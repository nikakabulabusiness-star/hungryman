import type {WorkCallSheet,WorkBoard,WorkVideo,WorkVideoMutation} from './work-model';
import type {WorkContactInput} from './work-task-model';
/** Keep row references valid after explicit removal/reordering in the call-sheet editor. */
export function replaceWorkRows<K extends 'days'|'crew'|'locations'>(sheet:WorkCallSheet,key:K,rows:WorkCallSheet[K]):WorkCallSheet{
 const result={...sheet,[key]:rows};
 const days=new Set(result.days.map(row=>row.id)),crew=new Set(result.crew.map(row=>row.id)),locations=new Set(result.locations.map(row=>row.id));
 return {...result,days:result.days.map(row=>({...row,locationId:locations.has(row.locationId)?row.locationId:''})),crew:result.crew.map(row=>({...row,dayIds:row.dayIds.filter(id=>days.has(id))})),scenes:result.scenes.map(row=>({...row,dayId:days.has(row.dayId)?row.dayId:'',locationId:locations.has(row.locationId)?row.locationId:'',crewIds:row.crewIds.filter(id=>crew.has(id))}))};
}
/** The saved base revision travels with its draft; never replace it with a refreshed revision. */
export function workSaveMutation(video:WorkVideo,board:WorkBoard):WorkVideoMutation{return {version:video.version,board,action:'save',...(board==='technical'?{technical:video.technical}:{title:video.title,content:video.content,...(board==='editing'?{}:{callSheet:video.callSheet})})}}
/** Read-only audit fields returned by the API must never be posted back as editable fields. */
export function workContactPayload(value:WorkContactInput):WorkContactInput{return {company:value.company,category:value.category,firstName:value.firstName,lastName:value.lastName,position:value.position,phone:value.phone,email:value.email,notes:value.notes}}
export function workLocalDateTime(value:string){return value.replace(' ','T')}

/** Export a shoot's approved record, never today's draft or later approval snapshots. */
export function frozenWorkShoot(detail:import('./work-model').WorkVideoDetail,shoot:import('./types').Shoot):import('./work-model').WorkVideoDetail|null{
 if(!shoot.work_snapshot||shoot.work_video_id!==detail.video.id)return null;
 try{
  const raw=JSON.parse(shoot.work_snapshot) as import('./work-model').WorkSnapshot['data']&{videoId:string;version:number;approvedAt?:number;approvedBy?:string;technicalApprovedAt?:number;completedAt?:number};
  if(raw.videoId!==detail.video.id||!Number.isSafeInteger(raw.version)||!raw.title||!raw.callSheet?.days||!raw.content||!raw.technical||!raw.totals)return null;
  const stamp=Math.max(raw.approvedAt||0,raw.technicalApprovedAt||0,raw.completedAt||0)||shoot.updated||0;
  const data={title:raw.title,kind:raw.kind,content:raw.content,callSheet:raw.callSheet,technical:raw.technical,approvedTechnical:raw.approvedTechnical,totals:raw.totals};
  const board:WorkBoard=raw.kind==='short'?'social':'production';
  return {...detail,video:{...detail.video,...data,version:raw.version,updated:stamp,reviewNotes:{},stages:{story:raw.kind==='short'?null:'approved',production:raw.kind==='short'?null:shoot.status==='completed'?'filmed':'scheduled',social:raw.kind==='short'?shoot.status==='completed'?'done':'scheduled':null,editing:null,technical:raw.approvedTechnical?'approved':null},permissions:{editBoards:[],approve:false,remove:false},shoots:[{id:shoot.id,dayId:shoot.work_day_id||'',date:shoot.shoot_date,status:shoot.status}]},history:detail.history.filter(h=>h.version<=raw.version&&h.created<=stamp),snapshots:[{id:'shoot-'+shoot.id,board,version:raw.version,created:stamp,actorName:raw.approvedBy||'',data}],meta:{...detail.meta,people:[],assignable:[],editBoards:[],canApprove:false,canContacts:false,unlinkedShoots:[]}};
 }catch{return null}
}
