/** Portable Work API contract shared by web, server and Expo. Monetary amounts are integer tetri. */
export type WorkBoard='story'|'production'|'editing'|'social'|'technical';
export type WorkKind='video'|'short';
export const workBoards:readonly {id:WorkBoard;label:string;departmentId:string;stages:readonly {id:string;label:string}[]}[]=[
 {id:'story',label:'სცენარი',departmentId:'story',stages:[{id:'idea',label:'იდეა'},{id:'script',label:'სცენარი'},{id:'review',label:'დასტურის მოლოდინი'},{id:'approved',label:'დამტკიცებული'}]},
 {id:'production',label:'პროდაქშენი',departmentId:'preproduction',stages:[{id:'ready',label:'მიღებული სცენარი'},{id:'planning',label:'ქოლშითი'},{id:'review',label:'დასტურის მოლოდინი'},{id:'scheduled',label:'დაგეგმილი'},{id:'filmed',label:'გადაღებული'}]},
 {id:'technical',label:'ტექნიკური',departmentId:'technical',stages:[{id:'needed',label:'დაგეგმილი გადაღებები'},{id:'preparing',label:'ტექნიკური სია'},{id:'review',label:'დასტურის მოლოდინი'},{id:'approved',label:'დამტკიცებული'}]},
 {id:'editing',label:'მონტაჟი',departmentId:'production',stages:[{id:'footage',label:'გადაღებული მასალა'},{id:'editing',label:'მონტაჟი'},{id:'done',label:'დასრულებული'}]},
 {id:'social',label:'სოციალური მედია',departmentId:'social',stages:[{id:'idea',label:'იდეები'},{id:'planning',label:'მომზადება'},{id:'review',label:'დასტურის მოლოდინი'},{id:'scheduled',label:'დაგეგმილი'},{id:'done',label:'დასრულებული'}]},

];
export const callSheetSections=['ზოგადი','სცენარი','განრიგი','გუნდი','ლოკაციები','საჭიროებები','ბიუჯეტი','ფაილები','შენიშვნები'] as const;
export type VideoTracker={priority?:string;paused?:boolean;status?:string;youtube?:string;transfer?:string;finished?:number;history?:{status:string;at:number}[]};
export type WorkContent={scriptHtml?:string;editorId?:string;tracker?:VideoTracker;summary:string;idea:string;script:string;requirements:string;coverId:string|null;photoIds:string[]};
export type WorkDay={id:string;date:string;callTime:string;cameraTime:string;endTime:string;goal:string;locationId:string;notes:string};
export type WorkCrew={id:string;userId:string|null;name:string;role:string;task:string;phone:string;email:string;callTime:string;dayIds:string[]};
export type WorkLocation={id:string;name:string;address:string;mapUrl:string;latitude:number|null;longitude:number|null;contactName:string;contactPhone:string;parking:string;access:string;photoIds:string[]};
export type WorkScene={id:string;title:string;description:string;dayId:string;arrivalTime:string;cameraTime:string;endTime:string;locationId:string;crewIds:string[];interior:'INT'|'EXT';light:'DAY'|'NIGHT';props:string;effects:string};
export type WorkNeed={id:string;category:string;description:string;responsible:string;done:boolean};
export type WorkBudgetLine={id:string;category:string;type:'item'|'product'|'service';label:string;quantity:number;unitPrice:number};
export type WorkCallSheet={producer:string;director:string;client:string;format:string;duration:string;days:WorkDay[];crew:WorkCrew[];locations:WorkLocation[];scenes:WorkScene[];needs:WorkNeed[];budget:WorkBudgetLine[];photoIds:string[];notes:string;departmentNotes:string;catering:string;radioChannels:string;emergency:string;weather:string;daylight:string;backupPrimary:boolean;backupSecondary:boolean};
export type WorkEquipment={id:string;name:string;quantity:number;source:'owned'|'rental';unitPrice:number;vendor:string;phone:string;pickupAt:string;returnAt:string;responsible:string;ready:boolean};
export type WorkTechnical={items:WorkEquipment[];notes:string;photoIds:string[]};
export type WorkBudgetTotals={currency:'GEL';base:number;technicalApproved:number;technicalPending:number;grandTotal:number;categories:{name:string;total:number}[]};
export type WorkVideoPermissions={editBoards:WorkBoard[];approve:boolean;remove:boolean};
export type WorkVideo={id:string;title:string;kind:WorkKind;entryBoard:WorkBoard;stages:Record<WorkBoard,string|null>;content:WorkContent;callSheet:WorkCallSheet;technical:WorkTechnical;approvedTechnical:WorkTechnical|null;totals:WorkBudgetTotals;version:number;createdBy:string;created:number;updated:number;permissions:WorkVideoPermissions;shoots:{id:string;dayId:string;date:string;status:string}[];reviewNotes:Partial<Record<WorkBoard,string>>};
export type WorkHistory={id:string;board:WorkBoard;action:string;fromStage:string|null;toStage:string|null;comment:string;actorName:string;created:number;version:number};
export type WorkSnapshot={id:string;board:WorkBoard;version:number;created:number;actorName:string;data:Pick<WorkVideo,'title'|'kind'|'content'|'callSheet'|'technical'|'approvedTechnical'|'totals'>};
export type WorkPerson={userId:string;email:string;name:string;role:string;memberships:{departmentId:string;level:number;reportsTo:string}[]};
export type WorkMeta={canAssignEditor?:boolean;boards:typeof workBoards;editBoards:WorkBoard[];canApprove:boolean;canContacts:boolean;people:WorkPerson[];assignable:WorkPerson[];unlinkedShoots:{id:string;title:string;date:string;startTime:string;locationName:string}[]};
export type WorkVideoList={videos:WorkVideo[];meta:WorkMeta;nextCursor:string|null};
export type WorkVideoDetail={video:WorkVideo;history:WorkHistory[];snapshots:WorkSnapshot[];meta:WorkMeta};
export type WorkVideoCreate={id?:string;board:WorkBoard;title:string;kind?:WorkKind;shootId?:string;content?:Partial<WorkContent>};
/** Every mutation requires current version. Save touches only fields for its board; stage is a separate action. */
export type WorkVideoMutation={version:number;board:WorkBoard;action:'save'|'move'|'approve'|'return';stage?:string;comment?:string;title?:string;content?:Partial<WorkContent>;callSheet?:WorkCallSheet;technical?:WorkTechnical};
export function emptyWorkContent():WorkContent{return {summary:'',idea:'',script:'',requirements:'',coverId:null,photoIds:[]}}
export function emptyCallSheet():WorkCallSheet{return {producer:'',director:'',client:'',format:'',duration:'',days:[],crew:[],locations:[],scenes:[],needs:[],budget:[],photoIds:[],notes:'',departmentNotes:'',catering:'',radioChannels:'',emergency:'',weather:'',daylight:'',backupPrimary:false,backupSecondary:false}}
export function emptyTechnical():WorkTechnical{return {items:[],notes:'',photoIds:[]}}
export function workStageLabel(board:WorkBoard,stage:string|null){return workBoards.find(b=>b.id===board)?.stages.find(s=>s.id===stage)?.label||''}
export function workMoveTargets(board:WorkBoard,current:string|null):string[]{const stages=workBoards.find(b=>b.id===board)?.stages.map(s=>s.id)||[],from=stages.indexOf(current||'');return from<0||current==='review'?[]:stages.filter((stage,to)=>Math.abs(to-from)===1&&!['approved','scheduled'].includes(stage)&&!(['approved','scheduled'].includes(current||'')&&to<from))}
