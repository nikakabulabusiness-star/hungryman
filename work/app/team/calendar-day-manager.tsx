'use client';
import {roleLabel} from '@/lib/department-directory';

import {useState} from 'react';
import {CalendarDays,Film,Wallet} from 'lucide-react';
import {workRequest} from '@/components/cabinet-panel';
import type {ManagedCalendarKind} from '@/lib/staff-calendar';

type Kind=ManagedCalendarKind|'salary'|'shoot';
export type CalendarPerson={email:string;fullName:string;role:string};
const labels:Record<Kind,string>={info:'საჯარო ინფორმაცია',leave:'შვებულება',day_off:'დეი ოფი',sick:'ბიულეტენი',holiday:'საერთო უქმე დღე',overtime:'ოვერთაიმი',salary:'ხელფასის დღე',shoot:'გადაღება'};

export default function CalendarDayManager({date,people,canCreateShoots,onSaved}:{date:string;people:CalendarPerson[];canCreateShoots:boolean;onSaved:()=>void}){
 const [kind,setKind]=useState<Kind>('info'),[visibility,setVisibility]=useState<'all'|'individual'>('all'),[email,setEmail]=useState(''),[title,setTitle]=useState(''),[endDate,setEndDate]=useState(date),[startTime,setStartTime]=useState(''),[endTime,setEndTime]=useState(''),[location,setLocation]=useState(''),[details,setDetails]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 function changeKind(value:Kind){setKind(value);setError('');if(['leave','sick','overtime'].includes(value))setVisibility('individual');else if(['salary','holiday','shoot'].includes(value))setVisibility('all');if(['salary','shoot','overtime'].includes(value))setEndDate(date)}
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{
  if(kind==='salary')await workRequest('/api/admin/calendar/payday','PUT',{date});
  else if(kind==='shoot')await workRequest('/api/shoots','POST',{title,shootDate:date,startTime,endTime,locationName:location,details,assignments:[]});
  else await workRequest('/api/admin/calendar','POST',{kind,title,startDate:date,endDate,visibility,employeeEmail:email,startTime:kind==='overtime'?startTime:'',endTime:kind==='overtime'?endTime:''});
  onSaved();
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const individualOnly=['leave','sick','overtime'].includes(kind),everyoneOnly=['holiday','salary','shoot'].includes(kind);
 return <form className="work-panel cabinet-date-manager" onSubmit={save}>
  <h3><CalendarDays size={18}/> კალენდრის მართვა</h3>
  <label>რა ჩაინიშნოს<select value={kind} onChange={e=>changeKind(e.target.value as Kind)}>{(Object.entries(labels) as [Kind,string][]).filter(([value])=>value!=='shoot'||canCreateShoots).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
  {kind==='salary'?<p className="work-help"><Wallet size={18}/> {date} გახდება ამ თვის ხელფასის დღე და ჩაანაცვლებს ძველ თარიღს. წინა თვეებისა და უკვე გასული გადახდის თარიღები არ იცვლება.</p>:<>
   {!everyoneOnly&&<label>ვისთვის<select disabled={individualOnly} value={visibility} onChange={e=>setVisibility(e.target.value as 'all'|'individual')}><option value="all">ყველასთვის</option><option value="individual">კონკრეტული თანამშრომელი</option></select></label>}
   {visibility==='individual'&&<label>თანამშრომელი<select required value={email} onChange={e=>setEmail(e.target.value)}><option value="">აირჩიე თანამშრომელი</option>{people.map(person=><option key={person.email} value={person.email}>{person.fullName} — {roleLabel(person.role)}</option>)}</select></label>}
   <label>სათაური<input required={kind==='shoot'} maxLength={120} placeholder={labels[kind]} value={title} onChange={e=>setTitle(e.target.value)}/></label>
   {!['shoot','overtime'].includes(kind)&&<label>როდემდე<input required type="date" min={date} value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>}
   {['shoot','overtime'].includes(kind)&&<div className="work-date-range"><label>დაწყების დრო<input required type="time" value={startTime} onChange={e=>setStartTime(e.target.value)}/></label><label>დასრულება<input required={kind==='overtime'} type="time" value={endTime} onChange={e=>setEndTime(e.target.value)}/></label></div>}
   {kind==='shoot'&&<><label>ადგილი<input maxLength={200} value={location} onChange={e=>setLocation(e.target.value)}/></label><label>აღწერა<textarea rows={3} maxLength={5000} value={details} onChange={e=>setDetails(e.target.value)}/></label><p className="work-help"><Film size={16}/> შექმნილი გადაღება გუნდის საერთო კალენდარშიც გამოჩნდება.</p></>}
  </>}
  {error&&<p role="alert">{error}</p>}
  <button className="action" disabled={busy}>{busy?'ინახება…':kind==='salary'?'ხელფასის დღის შეცვლა':'ჩანაწერის დამატება'}</button>
  <a className="cabinet-calendar-link" href={'/admin/calendar?date='+date}>მართვის სრული პანელი ↗</a>
 </form>;
}
