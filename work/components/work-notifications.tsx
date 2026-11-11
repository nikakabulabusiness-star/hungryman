'use client';
import {useState,useSyncExternalStore} from 'react';
import {Bell,Inbox,CheckCheck,CalendarDays,Video,Wallet,ArrowUpRight,Clock3,ChevronDown} from 'lucide-react';
import {useWorkData,workRequest} from './cabinet-panel';
import {attendanceAnswers,noticeHref,type NoticeTarget,type AttendanceAnswer} from '@/lib/notification-policy';
import './work-notifications.css';
import HeaderPopover from './header-popover';
import {NoticesPreview,RequestsPreview} from './header-previews';
import {DesktopNotificationControls} from './desktop-notification-controls';

type Counts={disabled?:boolean;unread:number;requests:number;chatUnread:number};
type Notice={id:string;title:string;body:string;target:NoticeTarget;target_id:string;category:string;important:number;read_at:number|null;created:number};
type Notices=Counts&{items:Notice[];next:{before:number;beforeId:string}|null};
const emptyCounts:Counts={unread:0,requests:0,chatUnread:0};
let counts=emptyCounts,countRequest:Promise<void>|null=null,countTimer:ReturnType<typeof setInterval>|null=null;
const countListeners=new Set<()=>void>();
async function refreshCounts(){
 if(countRequest)return countRequest;
 countRequest=(async()=>{try{const next=await workRequest<Counts>('/api/notifications?counts=1');
  if(next.disabled!==counts.disabled||next.unread!==counts.unread||next.requests!==counts.requests||next.chatUnread!==counts.chatUnread){counts=next;for(const listener of countListeners)listener()}
 }catch{/* Keep the last count while temporarily offline. */}finally{countRequest=null}})();
 return countRequest;
}
function visibleRefresh(){if(document.visibilityState==='visible')void refreshCounts()}
function subscribeCounts(listener:()=>void){
 countListeners.add(listener);
 if(countListeners.size===1){void refreshCounts();countTimer=setInterval(visibleRefresh,10000);document.addEventListener('visibilitychange',visibleRefresh);window.addEventListener('hmw-work-updated',visibleRefresh);window.addEventListener('hmw:chat-read',visibleRefresh)}
 return()=>{countListeners.delete(listener);if(!countListeners.size){if(countTimer)clearInterval(countTimer);countTimer=null;document.removeEventListener('visibilitychange',visibleRefresh);window.removeEventListener('hmw-work-updated',visibleRefresh);window.removeEventListener('hmw:chat-read',visibleRefresh)}};
}
const subscribeNoCounts=()=>()=>{};
/** Header and mobile tab badges share one request and one refresh timer. */
export function useNotificationCounts(enabled=true){return useSyncExternalStore(enabled?subscribeCounts:subscribeNoCounts,()=>enabled?counts:emptyCounts,()=>emptyCounts)}
export function NotificationButtons({review=false}:{review?:boolean}){
 const value=useNotificationCounts();
 return <>{!value.disabled&&<HeaderPopover title="შეტყობინებები" icon={<Bell/>} count={value.unread} href="/team/notifications"><NoticesPreview/><DesktopNotificationControls/></HeaderPopover>}
  {review&&<HeaderPopover title="შემოსული მოთხოვნები" icon={<Inbox/>} count={value.requests} href="/admin/time-off"><RequestsPreview/></HeaderPopover>}</>;
}
export function NotificationInbox(){
 const result=useWorkData<Notices>('/api/notifications'),[more,setMore]=useState<Notice[]>([]),[cursor,setCursor]=useState<Notices['next']|undefined>(),[read,setRead]=useState<Set<string>>(new Set()),[error,setError]=useState(''),[busy,setBusy]=useState(false),[marking,setMarking]=useState(false);
 const items=[...new Map([...(result.data?.items||[]),...more].map(notice=>[notice.id,notice])).values()],next=cursor===undefined?result.data?.next:cursor;
 const unread=Math.max(0,(result.data?.unread||0)-items.filter(notice=>!notice.read_at&&read.has(notice.id)).length);
 async function mark(notice?:Notice){
  if(marking)return;setMarking(true);setError('');const previous=read;
  setRead(new Set([...read,...(notice?[notice.id]:items.map(item=>item.id))]));
  try{await workRequest('/api/notifications','PATCH',notice?{id:notice.id}:{all:true});
   if(notice)location.assign(noticeHref(notice.target,notice.target_id));
   else{const now=Date.now();setMore(rows=>rows.map(row=>({...row,read_at:row.read_at??now})));await result.refresh();setRead(new Set())}
  }catch(reason){setRead(previous);setError((reason as Error).message)}finally{setMarking(false)}
 }
 async function nextPage(){
  if(!next||busy)return;setBusy(true);setError('');
  try{const page=await workRequest<Notices>('/api/notifications?before='+next.before+'&beforeId='+encodeURIComponent(next.beforeId));setMore(value=>[...value,...page.items]);setCursor(page.next)}
  catch(reason){setError((reason as Error).message)}finally{setBusy(false)}
 }
 return <section className="notice-inbox">
  <div className="notice-heading"><div><h1>შეტყობინებები</h1><small aria-live="polite">{unread} წაუკითხავი</small></div>{unread>0&&<button type="button" className="action" disabled={marking} onClick={()=>void mark()}><CheckCheck size={16}/>ყველას წაკითხვა</button>}</div>
  {(error||result.error)&&<p role="alert" className="notice-error">{error||result.error}</p>}
  {!items.length&&<p className="notice-empty">{result.data?'შეტყობინებები ჯერ არ არის.':'იტვირთება…'}</p>}
  <div className="notice-list">{items.map(notice=>{
   const isUnread=!notice.read_at&&!read.has(notice.id);
   return <button type="button" key={notice.id} disabled={marking} className={'notice-item '+(isUnread?'unread ':'')+(notice.important?'important':'')} onClick={()=>void mark(notice)} aria-label={`${isUnread?'წაუკითხავი · ':''}${notice.title}. ${notice.body}`}>
    {notice.category==='shoot'?<Video aria-hidden="true"/>:notice.category==='salary'?<Wallet aria-hidden="true"/>:notice.category==='request'?<Inbox aria-hidden="true"/>:notice.category==='attendance'?<Clock3 aria-hidden="true"/>:<CalendarDays aria-hidden="true"/>}
    <span><strong>{notice.title}</strong><span>{notice.body}</span><time dateTime={new Date(notice.created).toISOString()}>{new Date(notice.created).toLocaleString('ka-GE',{timeZone:'Asia/Tbilisi',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></span><i aria-hidden="true"/>
   </button>;
  })}</div>
  {next&&<button type="button" className="action" disabled={busy} onClick={()=>void nextPage()}>{busy?'იტვირთება…':'მეტის ნახვა'}</button>}
 </section>;
}

type RequestRow={id:string;employee_name:string;work_date:string;answer:AttendanceAnswer;status:string;comment:string;response:string};
export function AttendanceRequests({review=true}:{review?:boolean}){
 const result=useWorkData<{requests:RequestRow[]}>('/api/attendance/requests'+(review?'?review=1':''));
 const pending=result.data?.requests.filter(row=>row.status==='pending')||[],resolved=result.data?.requests.filter(row=>row.status!=='pending')||[];
 return <section className="work-panel attendance-request-list"><h2>{review?'დასწრების მოთხოვნები':'ჩემი დასწრების მოთხოვნები'}{pending.length>0&&<small>{pending.length} მოლოდინში</small>}</h2>
  {result.error&&<p role="alert">{result.error}</p>}{!result.data&&!result.error&&<p className="work-help">იტვირთება…</p>}
  {result.data?.requests.length===0&&<p className="work-help">მოთხოვნები ჯერ არ არის.</p>}
  <div className="notice-list">{pending.map(row=><AttendanceRequest key={row.id} row={row} review={review} refresh={result.refresh}/>)}</div>
  {resolved.length>0&&<details className="notice-resolved"><summary>განხილული მოთხოვნები · {resolved.length}<ChevronDown size={16}/></summary><div className="notice-list">{resolved.map(row=><AttendanceRequest key={row.id} row={row} review={review} refresh={result.refresh}/>)}</div></details>}
 </section>;
}
function AttendanceRequest({row,review,refresh}:{row:RequestRow;review:boolean;refresh:()=>Promise<void>}){
 const [response,setResponse]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function decide(action:string){setBusy(true);setError('');try{await workRequest('/api/attendance/requests','PATCH',{id:row.id,action,response});await refresh()}catch(reason){setError((reason as Error).message)}finally{setBusy(false)}}
 return <article className="notice-request" id={'request-'+row.id}>
  {review&&<strong>{row.employee_name}</strong>}<p>{attendanceAnswers[row.answer]} · <time>{row.work_date}</time></p>{row.comment&&<p className="notice-comment">{row.comment}</p>}
  {row.status==='pending'&&review?<><input aria-label={`${row.employee_name} · პასუხის კომენტარი`} placeholder="კომენტარი · სურვილისამებრ" maxLength={1000} value={response} onChange={event=>setResponse(event.target.value)}/><div className="notice-actions"><button type="button" className="action" disabled={busy} onClick={()=>void decide('approved')}>{row.answer==='late'?'ვნახე':'დადასტურება'}</button><button type="button" className="action secondary" disabled={busy} onClick={()=>void decide('rejected')}>უარყოფა</button></div></>:<small className={'notice-status '+row.status}>{row.status==='pending'?'განხილვის მოლოდინში':row.status==='approved'?'დადასტურებულია':'უარყოფილია'}{row.response?' · '+row.response:''}</small>}
  {error&&<p role="alert">{error}</p>}
 </article>;
}

type AttendanceData={today?:{officeMinutes:number;mode:string;planned:string;firstArrival:number|null};request?:{answer:AttendanceAnswer;status:string;response:string}|null;askRemote:boolean};
export function AttendanceSummary(){
 const result=useWorkData<AttendanceData>('/api/attendance',30000),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function answer(answer:AttendanceAnswer){setBusy(true);setError('');try{await workRequest('/api/attendance/requests','POST',{answer});await result.refresh()}catch(reason){setError((reason as Error).message)}finally{setBusy(false)}}
 const minutes=Math.max(0,Math.round(result.data?.today?.officeMinutes||0)),request=result.data?.request;
 const mode=result.data?.today?.mode,remote=mode==='remote',canRequest=!request&&result.data?.today?.planned==='work'&&!result.data?.today.firstArrival&&mode==='pending';
 return <section className="work-panel attendance-summary">
  <div className="attendance-summary-head"><div><h2>ჩემი დასწრება</h2><span>დღეს აღრიცხული დრო</span></div><strong>{result.data?`${Math.floor(minutes/60)} სთ ${minutes%60} წთ`:'—'}</strong></div>
  {remote&&<p className="notice-status approved">დღეს დისტანციურად მუშაობ</p>}
  {request&&<p className={'notice-status '+request.status}>{attendanceAnswers[request.answer]} · {request.status==='pending'?'HR-ის პასუხის მოლოდინში':request.status==='approved'?'დადასტურებულია':'უარყოფილია'}{request.response?' · '+request.response:''}</p>}
  {canRequest&&<button type="button" className="action" disabled={busy} onClick={()=>void answer('remote')}>დისტანციურად მუშაობის მოთხოვნა<ArrowUpRight size={16}/></button>}
  {result.data?.askRemote&&<div className="attendance-question"><h3>აგვიანებ?</h3><div className="notice-actions">{Object.entries(attendanceAnswers).map(([value,title])=><button type="button" key={value} className="action" disabled={busy} onClick={()=>void answer(value as AttendanceAnswer)}>{title}</button>)}</div></div>}
  {(error||result.error)&&<p role="alert">{error||result.error}</p>}
 </section>;
}
