'use client';
import {PrivateNote} from '@/components/cabinet-panel';
import CalendarDayManager,{type CalendarPerson} from './calendar-day-manager';
import {CalendarCheck2,ChevronLeft,ChevronRight,Clock3,MapPin,ArrowUpRight,StickyNote,Settings2} from 'lucide-react';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {defaultSchedule,parseSchedule,patternForDate,validateSchedule,weekday,type ManagedCalendarKind,type WorkPatternRow,type WorkSchedule} from '@/lib/staff-calendar';

const monthNames=['იანვარი','თებერვალი','მარტი','აპრილი','მაისი','ივნისი','ივლისი','აგვისტო','სექტემბერი','ოქტომბერი','ნოემბერი','დეკემბერი'];
const weekdays=['ორშ','სამ','ოთხ','ხუთ','პარ','შაბ','კვ'];
const iso=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const tbilisiToday=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tbilisi',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),value=(type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value||'';return `${value('year')}-${value('month')}-${value('day')}`};
const dateFromIso=(value:string)=>{const [year,month,day]=value.split('-').map(Number);return new Date(year,month-1,day)};
type StaffCalendarEvent={
 id:string;kind:ManagedCalendarKind|'birthday'|'shoot'|'shorts'|'salary';title:string;start_date:string;end_date:string;
 employee_email:string|null;employee_name:string|null;recurring_yearly:number;start_time?:string|null;end_time?:string|null;
 location_name?:string|null;href?:string;duration_minutes?:number|null;
};
type CalendarPayload={events?:StaffCalendarEvent[];workPatterns?:WorkPatternRow[];workSchedule?:unknown;error?:string;people?:CalendarPerson[];canManage?:boolean;canCreateShoots?:boolean;canWriteNotes?:boolean};

async function requestCalendar(from:string,to:string,signal?:AbortSignal){
 const response=await fetch(`/api/calendar?from=${from}&to=${to}`,{cache:'no-store',signal}),data=await response.json() as CalendarPayload;
 if(!response.ok)throw new Error(data.error||'კალენდარი ვერ ჩაიტვირთა.');
 return data;
}

export default function StaffCalendar({initialDate}:{initialDate?:string}={}){
 const [today,setToday]=useState(tbilisiToday),[month,setMonth]=useState(()=>dateFromIso(initialDate||tbilisiToday())),[events,setEvents]=useState<StaffCalendarEvent[]>([]),[workPatterns,setWorkPatterns]=useState<WorkPatternRow[]>([]),[workSchedule,setWorkSchedule]=useState<WorkSchedule|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [capabilities,setCapabilities]=useState({canManage:false,canCreateShoots:false,canWriteNotes:false,people:[] as CalendarPerson[]}),[dayMode,setDayMode]=useState<'note'|'manage'|null>(null);
 const [selectedDate,setSelectedDate]=useState<string|null>(initialDate||null),dayTrigger=useRef<HTMLButtonElement|null>(null);
 const swipe=useRef<{id:number;x:number;y:number;started:number;horizontal:boolean}|null>(null),suppressClickUntil=useRef(0);
 const shiftMonth=useCallback((direction:number)=>{setSelectedDate(null);setMonth(value=>new Date(value.getFullYear(),value.getMonth()+direction,1))},[]);
 function beginSwipe(event:React.PointerEvent<HTMLDivElement>){if(!event.isPrimary||event.pointerType==='mouse'&&event.button!==0)return;swipe.current={id:event.pointerId,x:event.clientX,y:event.clientY,started:Date.now(),horizontal:false}}
 function moveSwipe(event:React.PointerEvent<HTMLDivElement>){const start=swipe.current;if(!start||start.id!==event.pointerId)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(!start.horizontal&&Math.abs(dy)>16&&Math.abs(dy)>Math.abs(dx)){swipe.current=null;return}if(Math.abs(dx)>14&&Math.abs(dx)>Math.abs(dy)*1.5){start.horizontal=true;if(event.cancelable)event.preventDefault();event.currentTarget.style.transform=`translateX(${Math.max(-42,Math.min(42,dx*.18))}px)`}}
 function endSwipe(event:React.PointerEvent<HTMLDivElement>,cancelled=false){const start=swipe.current;swipe.current=null;event.currentTarget.style.transform='';if(!start||start.id!==event.pointerId)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(start.horizontal)suppressClickUntil.current=Date.now()+400;if(!cancelled&&Math.abs(dx)>=64&&Math.abs(dx)>Math.abs(dy)*1.5&&Date.now()-start.started<1200)shiftMonth(dx<0?1:-1)}
 const range=useMemo(()=>{const year=month.getFullYear(),index=month.getMonth();return {from:iso(new Date(year,index,1)),to:iso(new Date(year,index+1,0))}},[month]);
 const path=`/api/calendar/notes?from=${range.from}&to=${range.to}`;
 type Note={date:string;body:string;updated:number};
 const [snapshot,setSnapshot]=useState<{path:string;notes:Note[]}|null>(null),[noteError,setNoteError]=useState('');
 const revision=useRef(0);
 const notes=snapshot?.path===path?snapshot.notes:null;
 useEffect(()=>{
  const controller=new AbortController();
  async function refresh(){
   const ticket=++revision.current;
   try{
    const response=await fetch(path,{cache:'no-store',signal:controller.signal});
    const result=await response.json() as {notes:Note[];error?:string};
    if(controller.signal.aborted||ticket!==revision.current)return;
    if(!response.ok){if(response.status===403||response.status===401)setSnapshot(null);throw Error(result.error)}
    setSnapshot({path,notes:result.notes});setNoteError('');
   }catch(e){if(!controller.signal.aborted&&ticket===revision.current)setNoteError((e as Error).message)}
  }
  const visible=()=>{if(document.visibilityState==='visible')void refresh()};
  void refresh();window.addEventListener('pageshow',visible);document.addEventListener('visibilitychange',visible);
  return ()=>{controller.abort();window.removeEventListener('pageshow',visible);document.removeEventListener('visibilitychange',visible)};
 },[path]);
 const apply=useCallback((data:CalendarPayload)=>{setEvents(data.events||[]);setWorkPatterns(data.workPatterns||[]);setWorkSchedule(readSchedule(data.workSchedule));setCapabilities({canManage:!!data.canManage,canCreateShoots:!!data.canCreateShoots,canWriteNotes:data.canWriteNotes!==false,people:data.people||[]})},[]);
 useEffect(()=>{const controller=new AbortController();let stopped=false;const refresh=async(initial=false)=>{if(document.visibilityState==='hidden'&&!initial)return;setToday(tbilisiToday());try{const data=await requestCalendar(range.from,range.to,controller.signal);if(!stopped){apply(data);setError('')}}catch(reason){if(stopped||reason instanceof DOMException&&reason.name==='AbortError')return;if(initial)setError(reason instanceof Error?reason.message:'კალენდარი ვერ ჩაიტვირთა.')}finally{if(initial&&!stopped)setLoading(false)}};void refresh(true);const timer=window.setInterval(()=>void refresh(),30_000);const visible=()=>{if(document.visibilityState==='visible')void refresh()};document.addEventListener('visibilitychange',visible);return()=>{stopped=true;controller.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',visible)}},[apply,range.from,range.to]);
 const days=useMemo(()=>{const year=month.getFullYear(),index=month.getMonth(),empty=(new Date(year,index,1).getDay()+6)%7,count=new Date(year,index+1,0).getDate();return [...Array(empty).fill(null),...Array.from({length:count},(_,day)=>new Date(year,index,day+1))] as Array<Date|null>},[month]);
 function matching(day:Date){const value=iso(day);return events.filter(event=>event.recurring_yearly?matchesRecurring(value,event.start_date,event.end_date):value>=event.start_date&&value<=event.end_date).sort((a,b)=>Number(b.kind==='salary')-Number(a.kind==='salary'))}
 const monthValue=`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}`;
 function selectMonth(value:string){if(!/^\d{4}-\d{2}$/.test(value))return;const [year,index]=value.split('-').map(Number);if(index<1||index>12)return;setMonth(new Date(year,index-1,1))}
 async function savedCalendar(){try{apply(await requestCalendar(range.from,range.to));setError('')}catch{setError('ჩანაწერი შენახულია. კალენდრის განახლება ვერ მოხერხდა — სცადე გვერდის განახლება.')}finally{setSelectedDate(null)}}
 const selectedItems=selectedDate?matching(dateFromIso(selectedDate)):[];
 const kindLabels={shorts:'Shorts-ის გადაღება',shoot:'გადაღება',leave:'შვებულება',sick:'ბიულეტენი',overtime:'ოვერთაიმი',holiday:'სახელმწიფო დასვენება',day_off:'დასვენების დღე',info:'ინფორმაცია',birthday:'დაბადების დღე',salary:'ხელფასი'};
 return <section className="staff-calendar-wrap"><section className="staff-calendar-card">
  <div className="calendar-head"><div><span>საერთო კალენდარი</span><h2 aria-live="polite">{monthNames[month.getMonth()]} {month.getFullYear()}</h2></div><div className="calendar-controls">
   <button type="button" onClick={()=>shiftMonth(-1)} aria-label="წინა თვე"><ChevronLeft aria-hidden="true"/></button>
   <input className="calendar-month-picker" type="month" value={monthValue} onChange={event=>selectMonth(event.target.value)} aria-label="აირჩიე თვე და წელი"/>
   <button type="button" onClick={()=>shiftMonth(1)} aria-label="შემდეგი თვე"><ChevronRight aria-hidden="true"/></button>
   <button type="button" className="calendar-today-button" onClick={()=>setMonth(dateFromIso(tbilisiToday()))} aria-label="დღევანდელ თვეზე დაბრუნება" title="დღევანდელ თვეზე დაბრუნება"><CalendarCheck2 aria-hidden="true"/></button>
  </div></div>
  {error&&<p className="error">{error}</p>}{loading&&<p className="muted">იტვირთება…</p>}
  <div className="calendar-week">{weekdays.map(day=><span key={day}>{day}</span>)}</div>
  <div key={monthValue} className="calendar-days calendar-swipe" onPointerDown={beginSwipe} onPointerMove={moveSwipe} onPointerUp={event=>endSwipe(event)} onPointerCancel={event=>endSwipe(event,true)} onPointerLeave={event=>{if(event.pointerType==='mouse')endSwipe(event,true)}} onClickCapture={event=>{if(Date.now()<suppressClickUntil.current){event.preventDefault();event.stopPropagation()}}}>{days.map((day,index)=>{
   if(!day)return <div className="calendar-day empty" key={'empty-'+index}/>;
   const value=iso(day),items=matching(day),personalEmail=workPatterns[0]?.employee_email||'',pattern=personalEmail?patternForDate(workPatterns,personalEmail,value):undefined,schedule=pattern?parseSchedule(pattern.schedule_json):workSchedule||defaultSchedule(),workDay=schedule[weekday(value)],isDayOff=items.some(event=>event.kind==='holiday'||event.kind==='day_off'||(event.kind==='leave'||event.kind==='sick')),isToday=value===today,isRest=!workDay||isDayOff,fullHours=isRest?'დასვენება':`${workDay.start}–${workDay.end}`,shortHours=isRest?'დასვ.':`${shortTime(workDay.start)}–${shortTime(workDay.end)}`;
   const priority=['shorts','shoot','leave','holiday','day_off','overtime','salary','birthday','info'],tone=priority.find(kind=>items.some(item=>item.kind===kind)),className=`calendar-day ${!workDay?'weekend':''} ${isToday?'current':''} ${tone?'day-tone-'+tone:''} ${items.length?'has-events':''}`;
   const note=capabilities.canWriteNotes?notes?.find(n=>n.date===value):undefined;
   const content=<><b>{day.getDate()}</b><small><span className="calendar-hours-full">{fullHours}</span><span className="calendar-hours-short">{shortHours}</span></small>{note&&<span className="calendar-note-preview" title={note.body}><StickyNote size={21} aria-hidden="true"/><span>{note.body.trim().split(/\s+/).slice(0,2).join(' ')}</span></span>}{items.slice(0,note?2:3).map(event=><em key={event.kind+'-'+event.id} className={event.kind}>{event.kind==='salary'?'₾':event.title}</em>)}{items.length>(note?2:3)&&<span className="calendar-more">+{items.length-(note?2:3)}</span>}</>;
   return <button key={value} type="button" className={className} onClick={event=>{dayTrigger.current=event.currentTarget;setDayMode(note||!capabilities.canManage?'note':null);setSelectedDate(value)}} aria-current={isToday?'date':undefined} aria-haspopup="dialog" aria-label={`${day.getDate()} ${monthNames[month.getMonth()]}, ${items.length} ჩანაწერი — დეტალების გახსნა`}>{content}</button>;
  })}</div>
  <div className="calendar-legend"><span><i className="shoot"/>გადაღება</span><span><i className="shorts"/>Shorts</span><span><i className="leave"/>შვებულება</span><span><i className="overtime"/>ოვერთაიმი</span><span><i className="holiday"/>დასვენების დღე</span><span><i className="salary"/>ხელფასი</span><span><i className="birthday"/>დაბადების დღე</span></div>
 </section>
 <Dialog open={!!selectedDate} onOpenChange={open=>{if(!open)setSelectedDate(null)}}>
  <DialogContent className="calendar-day-dialog" onCloseAutoFocus={event=>{event.preventDefault();dayTrigger.current?.focus({preventScroll:true})}}>
   <div><DialogTitle>{selectedDate?new Intl.DateTimeFormat('ka-GE',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Tbilisi'}).format(new Date(selectedDate+'T12:00:00+04:00')):''}</DialogTitle><DialogDescription>{selectedItems.length} ჩანაწერი ამ დღეს</DialogDescription></div>
   {capabilities.canManage&&<div className="calendar-day-actions">{capabilities.canWriteNotes&&<button type="button" aria-pressed={dayMode==='note'} onClick={()=>setDayMode('note')}><StickyNote size={22}/>პირადი ნოუთი</button>}<button type="button" aria-pressed={dayMode==='manage'} onClick={()=>setDayMode('manage')}><Settings2 size={22}/>კალენდრის მართვა</button></div>}
   {selectedDate&&dayMode==='manage'&&capabilities.canManage&&<CalendarDayManager key={selectedDate} date={selectedDate} people={capabilities.people} canCreateShoots={capabilities.canCreateShoots} onSaved={()=>void savedCalendar()}/>}
   {selectedDate&&dayMode==='note'&&capabilities.canWriteNotes&&!notes&&<p role="status">{noteError||'ნოუთი იტვირთება…'}</p>}{selectedDate&&dayMode==='note'&&capabilities.canWriteNotes&&notes&&<PrivateNote key={selectedDate+':'+(notes?.find(n=>n.date===selectedDate)?.updated||0)} date={selectedDate} initial={notes?.find(n=>n.date===selectedDate)?.body||''} onSaved={body=>{
    revision.current++;
    setSnapshot(current=>{
     if(current?.path!==path)return current;
     const remaining=current.notes.filter(n=>n.date!==selectedDate);
     return {path,notes:body?[...remaining,{date:selectedDate,body,updated:Date.now()}]:remaining};
    });setSelectedDate(null)
   }}/>}<div className="calendar-day-details">{selectedItems.map(event=><article key={event.kind+'-'+event.id} className={'day-detail-event '+event.kind}>
    <span className="day-detail-kind">{event.kind==='salary'?'₾ · ':''}{kindLabels[event.kind]}</span><h3>{event.title}</h3>
    {event.employee_name&&<p>{event.employee_name}</p>}
    {event.start_date!==event.end_date&&<p>{event.start_date} — {event.end_date}</p>}
    {event.start_time&&<p><Clock3 size={16}/>{event.start_time}{event.end_time?'–'+event.end_time:''}</p>}
    {!event.start_time&&event.duration_minutes!=null&&<p><Clock3 size={16}/>{event.duration_minutes} წუთი</p>}
    {event.location_name&&<p><MapPin size={16}/>{event.location_name}</p>}
    {event.href&&<a href={event.href}>გადაღების დეტალები<ArrowUpRight size={16}/></a>}
   </article>)}</div>
  </DialogContent>
 </Dialog>
 </section>;
}

function matchesRecurring(date:string,start:string,end:string){const current=Number(date.slice(5).replace('-','')),from=Number(start.slice(5).replace('-','')),to=Number(end.slice(5).replace('-',''));return from<=to?current>=from&&current<=to:current>=from||current<=to}
function shortTime(value:string){const compact=value.replace(/^0/,'');return compact.endsWith(':00')?compact.slice(0,-3):compact}
function readSchedule(value:unknown):WorkSchedule|null{if(!value||typeof value!=='object'||Array.isArray(value))return null;if(!Object.keys(value).length)return {};return validateSchedule(value)}
