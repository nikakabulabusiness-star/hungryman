'use client';

import {useEffect,useState} from 'react';
import {Clapperboard,CalendarDays,Inbox,Clock3} from 'lucide-react';
import HeaderPopover from './header-popover';
import {workRequest} from './cabinet-panel';
import {attendanceAnswers,noticeHref,type NoticeTarget,type AttendanceAnswer} from '@/lib/notification-policy';

type Notice={id:string;title:string;body:string;target:NoticeTarget;target_id:string;read_at:number|null;created:number};
type Leave={id:string;employee_name:string;kind:'leave'|'day_off'|'sick';start_date:string;end_date:string;status:string};
type Attendance={id:string;employee_name:string;work_date:string;answer:AttendanceAnswer;status:string};
type Shoot={id:string;title:string;shoot_date:string;start_time:string;location_name:string;status:string};
const labels={leave:'შვებულება',day_off:'დეი ოფი',sick:'ბიულეტენი'};

function usePreview<T>(load:()=>Promise<T>){
 const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let alive=true;const refresh=()=>{void load().then(result=>{if(alive){setData(result);setError('');}}).catch(reason=>{if(alive)setError(reason instanceof Error?reason.message:'ჩატვირთვა ვერ მოხერხდა.');});};const visibleRefresh=()=>{if(document.visibilityState==='visible')refresh();};setError('');refresh();const timer=setInterval(visibleRefresh,15000);window.addEventListener('hmw-work-updated',visibleRefresh);return()=>{alive=false;clearInterval(timer);window.removeEventListener('hmw-work-updated',visibleRefresh);};},[load,retry]);
 return {data,error,retry:()=>setRetry(value=>value+1)};
}
const loadNotices=()=>workRequest<{items:Notice[]}>('/api/notifications');
const loadRequests=async()=>{const [leave,attendance]=await Promise.all([workRequest<{requests:Leave[]}>('/api/time-off?review=1'),workRequest<{requests:Attendance[]}>('/api/attendance/requests?review=1')]);return {leave:leave.requests.filter(item=>item.status==='pending'),attendance:attendance.requests.filter(item=>item.status==='pending')};};
const loadShoots=()=>workRequest<{shoots:Shoot[]}>('/api/shoots');
function PreviewState({error,retry,loading,empty}:{error:string;retry:()=>void;loading:boolean;empty:string}){return error?<div className="header-popover-error" role="alert">{error}<button type="button" className="header-popover-retry" onClick={retry}>თავიდან ცდა</button></div>:<p className="header-popover-state" role="status">{loading?'იტვირთება…':empty}</p>;}
function formatDate(value:string){return new Intl.DateTimeFormat('ka-GE',{day:'numeric',month:'short',timeZone:'Asia/Tbilisi'}).format(new Date(value+'T12:00:00+04:00'));}

export function NoticesPreview(){
 const {data,error,retry}=usePreview(loadNotices),[opening,setOpening]=useState<string|null>(null),[actionError,setActionError]=useState('');
 async function open(notice:Notice){setOpening(notice.id);setActionError('');try{await workRequest('/api/notifications','PATCH',{id:notice.id});location.assign(noticeHref(notice.target,notice.target_id));}catch(reason){setActionError((reason as Error).message);setOpening(null);}}
 return <>{actionError&&<p className="header-popover-error" role="alert">{actionError}</p>}{error||!data?.items.length?<PreviewState error={error} retry={retry} loading={!data} empty="ახალი შეტყობინებები ჯერ არ არის."/>:data.items.slice(0,6).map(notice=><button key={notice.id} type="button" disabled={!!opening} className={'header-popover-row '+(!notice.read_at?'unread':'')} onClick={()=>void open(notice)}><CalendarDays/><span><strong>{notice.title}</strong><small>{notice.body}</small><time dateTime={new Date(notice.created).toISOString()}>{new Date(notice.created).toLocaleString('ka-GE',{timeZone:'Asia/Tbilisi',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></span>{!notice.read_at&&<i aria-hidden="true"/>}</button>)}</>;
}
export function RequestsPreview(){
 const {data,error,retry}=usePreview(loadRequests),empty=!data||(!data.leave.length&&!data.attendance.length);
 return <>{error||empty?<PreviewState error={error} retry={retry} loading={!data} empty="განსახილველი მოთხოვნები არ არის."/>:<>{data.attendance.slice(0,3).map(row=><a key={'attendance-'+row.id} className="header-popover-row" href={'/admin/time-off#request-'+encodeURIComponent(row.id)}><Clock3/><span><strong>{row.employee_name}</strong><small>{attendanceAnswers[row.answer]} · {formatDate(row.work_date)}</small></span></a>)}{data.leave.slice(0,4).map(row=><a key={'leave-'+row.id} className="header-popover-row" href="/admin/time-off"><Inbox/><span><strong>{row.employee_name}</strong><small>{labels[row.kind]} · {formatDate(row.start_date)}{row.end_date!==row.start_date?' — '+formatDate(row.end_date):''}</small></span></a>)}</>}<a className="header-popover-extra" href="/admin/absences">შვებულებებისა და ბიულეტენების მართვა ↗</a></>;
}
function ShootsPreview(){
 const {data,error,retry}=usePreview(loadShoots),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tbilisi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const shoots=(data?.shoots||[]).filter(row=>row.status==='planned'&&row.shoot_date>=today).sort((a,b)=>(a.shoot_date+a.start_time).localeCompare(b.shoot_date+b.start_time)).slice(0,5);
 return error||!shoots.length?<PreviewState error={error} retry={retry} loading={!data} empty="დაგეგმილი გადაღებები ჯერ არ არის."/>:<>{shoots.map(shoot=><a key={shoot.id} className="header-popover-row" href={'/shoots#shoot-'+encodeURIComponent(shoot.id)}><Clapperboard/><span><strong>{shoot.title}</strong><small>{formatDate(shoot.shoot_date)} · {shoot.start_time}{shoot.location_name?' · '+shoot.location_name:''}</small></span></a>)}</>;
}
export function ShootsDropdown({active=false}:{active?:boolean}){return <HeaderPopover title="გადაღებები" icon={<Clapperboard/>} href="/shoots" active={active}><ShootsPreview/></HeaderPopover>;}
