import {useState} from 'react';
import {Text} from 'react-native';
import {api} from '../lib/api';
import {router} from 'expo-router';
import {DateRange} from './date-range';
import {Button,Field,Select,State,confirm,success,S} from './components';
const labels={info:'საჯარო ინფორმაცია',leave:'შვებულება',day_off:'დეი ოფი',sick:'ბიულეტენი',holiday:'საერთო უქმე დღე',overtime:'ოვერთაიმი',salary:'ხელფასის დღე',shoot:'გადაღება'};
type Kind=keyof typeof labels;
export function CalendarDayManager({date,people,canCreateShoots,onSaved,onNavigate}:{date:string;people:{email:string;fullName:string;role:string}[];canCreateShoots:boolean;onSaved:()=>void;onNavigate:()=>void}){
 const [kind,setKind]=useState<Kind>('info'),[visibility,setVisibility]=useState('all'),[email,setEmail]=useState(''),[title,setTitle]=useState(''),[from,setFrom]=useState(date),[to,setTo]=useState(date),[startTime,setStartTime]=useState(''),[endTime,setEndTime]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const individual=['leave','sick','overtime'].includes(kind),all=['holiday','salary','shoot'].includes(kind);
 function change(value:string){const k=value as Kind;setKind(k);setError('');setFrom(date);setTo(date);if(['leave','sick','overtime'].includes(k))setVisibility('individual');else if(['holiday','salary','shoot'].includes(k))setVisibility('all')}
 async function save(){setBusy(true);setError('');try{if(kind==='salary')await api('/api/admin/calendar/payday',{method:'PUT',body:{date}});else await api('/api/admin/calendar',{method:'POST',body:{kind,title:title.trim()||labels[kind],startDate:from,endDate:kind==='overtime'?from:to,visibility,employeeEmail:email,startTime,endTime}});success();onSaved()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <><Select label="რა ჩაინიშნოს" value={kind} options={Object.entries(labels).filter(([value])=>value!=='shoot'||canCreateShoots).map(([value,label])=>({value,label}))} onChange={change}/>
  {kind==='salary'?<Text style={S.muted}>{date} გახდება ამ თვის ხელფასის დღე და ჩაანაცვლებს ძველ თარიღს. გასული გადახდები და წინა თვეები უცვლელი დარჩება.</Text>:kind==='shoot'?<Button title="გადაღების ჩანიშვნა" icon="videocam-outline" onPress={()=>{onNavigate();router.push({pathname:'/shoot/edit',params:{date}})}}/>:<>
   {!all&&!individual&&<Select label="ვისთვის" value={visibility} options={[{value:'all',label:'ყველასთვის'},{value:'individual',label:'კონკრეტული თანამშრომლისთვის'}]} onChange={setVisibility}/>}
   {visibility==='individual'&&<Select label="თანამშრომელი" value={email} options={people.map(p=>({value:p.email,label:p.fullName+' · '+p.role}))} onChange={setEmail}/>}
   <Field label="სათაური" value={title} placeholder={labels[kind]} maxLength={120} onChangeText={setTitle}/>
   {kind!=='overtime'&&<DateRange from={from} to={to} onChange={(a,b)=>{setFrom(a);setTo(b)}}/>}
   {kind==='overtime'&&<><Field label="დაწყება (სთ:წთ)" value={startTime} placeholder="19:00" onChangeText={setStartTime}/><Field label="დასრულება (სთ:წთ)" value={endTime} placeholder="21:00" onChangeText={setEndTime}/></>}
  </>}
  {error&&<State error={error}/>} {kind!=='shoot'&&<Button title={kind==='salary'?'ხელფასის დღის შეცვლა':'ჩანაწერის დამატება'} busy={busy} disabled={kind!=='salary'&&visibility==='individual'&&!email} onPress={()=>kind==='salary'?confirm('ამ თვის ხელფასის დღე შეიცვალოს?',save):void save()}/>}
  <Button title="მართვის სრული პანელი" secondary onPress={()=>{onNavigate();router.push({pathname:'/admin/calendar',params:{date}})}}/>
 </>;
}
