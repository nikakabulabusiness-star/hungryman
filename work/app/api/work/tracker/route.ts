import {getWorkContext,readWorkText,requireWorkWrite,WorkError,workRouteError} from '@/lib/work-policy';
import {storage} from '@/lib/storage';
import {defaultStatuses,type TrackerSettings,videoStatus} from '@/lib/video-tracker';
import {getWorkVideo} from '@/lib/work-store';
export const dynamic='force-dynamic';
const key='work.video.tracker.v1';
async function settings():Promise<TrackerSettings>{
 const row=await storage().DB.prepare('SELECT value FROM workspace_settings WHERE key=?').bind(key).first<{value:string}>();
 return row?JSON.parse(row.value):{statuses:defaultStatuses,order:[],version:0};
}
export async function GET(){try{await getWorkContext();return Response.json(await settings(),{headers:{'Cache-Control':'private, no-store'}})}catch(e){return workRouteError(e)}}
export async function PATCH(req:Request){try{
 requireWorkWrite(req);const ctx=await getWorkContext();if(!ctx.actor.isDeveloper)throw new WorkError(403,'წვდომა შეზღუდულია.');
 const b=JSON.parse(await readWorkText(req,180000)),db=storage().DB,s=await settings();
 if(b.action==='order'||b.action==='statuses'){
  if(b.version!==s.version)throw new WorkError(409,'დაფა შეიცვალა. სცადე თავიდან.');
  const items=b.items;
  if(!Array.isArray(items)||items.length>(b.action==='order'?3500:30)||new Set(items).size!==items.length||items.some(v=>typeof v!=='string'||(b.action==='order'?!/^[a-f\d-]{36}$/i.test(v):!v.trim()||v!==v.trim()||v.length>42)))throw new WorkError(400,'სია არასწორია.');
  if(b.action==='statuses'&&!items.includes('Finish'))throw new WorkError(400,'სიაში დატოვე Finish.');
  const next={...s,[b.action]:items,version:s.version+1};
  const r=await db.prepare('INSERT INTO workspace_settings(key,value,updated,updated_by) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated,updated_by=excluded.updated_by WHERE json_extract(workspace_settings.value,\'$.version\')=?').bind(key,JSON.stringify(next),Date.now(),ctx.actor.userId,s.version).run();
  if(!r.meta.changes)throw new WorkError(409,'რიგი შეიცვალა. განაახლე დაფა.');return Response.json(next);
 }
 const v=await getWorkVideo(b.id,ctx);if(v.version!==b.version)throw new WorkError(409,'ვიდეო შეიცვალა. სცადე ხელახლა.');
 const tr={...v.content.tracker},now=Date.now();
 switch(b.field){
 case 'paused':if(typeof b.value!=='boolean')throw new WorkError(400,'არასწორი მნიშვნელობა');tr.paused=b.value;break;
 case 'priority':if(!['დაბალი','საშუალო','მაღალი'].includes(b.value))throw new WorkError(400,'არასწორი პრიორიტეტი');tr.priority=b.value;break;
 case 'status':if(!s.statuses.includes(b.value))throw new WorkError(400,'ეტაპი ვერ მოიძებნა');if(b.value!==videoStatus(v)){tr.history=[...(tr.history||[]),{status:b.value,at:now}];tr.status=b.value;tr.finished=b.value==='Finish'?now:undefined}break;
 case 'youtube':case 'transfer':{const value=b.value;if(typeof value!=='string'||value.length>2048||value&&!/^https?:\/\//i.test(value))throw new WorkError(400,'ჩასვი სრული https ბმული.');if(value){try{new URL(value)}catch{throw new WorkError(400,'ბმული არასწორია.')}}tr[b.field as 'youtube'|'transfer']=value;break}
 default:throw new WorkError(400,'არასწორი ველი');
 }
 const r=await db.prepare("UPDATE work_videos SET content_json=json_set(content_json,'$.tracker',json(?)),version=version+1,updated=?,updated_by=?,mutation_id=? WHERE id=? AND version=?").bind(JSON.stringify(tr),now,ctx.actor.userId,crypto.randomUUID(),v.id,v.version).run();
 if(!r.meta.changes)throw new WorkError(409,'ვიდეო შეიცვალა. სცადე ხელახლა.');return Response.json({video:await getWorkVideo(v.id,ctx)});
 }catch(e){return workRouteError(e)}}
