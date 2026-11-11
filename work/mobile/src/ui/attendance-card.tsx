import {useState} from 'react';
import {Text,View} from 'react-native';
import {useResource} from '../lib/use-resource';
import {api} from '../lib/api';
import {refreshResource} from '../lib/resource-cache';
import {cancelTodayReminder,type Office} from '../lib/location';
import {Button,Fold,S,State,C} from './components';
export type AttendanceDay={date:string;planned:string;mode:string;officeMinutes:number;firstArrival:number|null;inside:boolean};
export type AttendanceData={office:Office|null;days:AttendanceDay[];today?:AttendanceDay;askRemote:boolean;request?:{answer:string;status:string;response:string}|null};
export function AttendanceCard(){const r=useResource<AttendanceData>('/api/attendance',30000),[busy,setBusy]=useState(false),[error,setError]=useState(''),day=r.data?.today,minutes=Math.round(day?.officeMinutes||0);
 async function answer(answer:string){if(busy)return;setBusy(true);setError('');try{await api('/api/attendance/requests',{method:'POST',body:{answer}});await cancelTodayReminder();await r.refresh();void refreshResource('/api/notifications?counts=1')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <><Fold title="ჩემი დასწრება" subtitle={Math.floor(minutes/60)+' სთ '+minutes%60+' წთ · დღეს'}><Text style={[S.title,{fontSize:30}]}>{Math.floor(minutes/60)}<Text style={S.muted}> სთ </Text>{minutes%60}<Text style={S.muted}> წთ</Text></Text><Text style={[S.muted,{fontSize:12}]}>{day?.inside?'ახლა ოფისში ხარ':day?.mode==='remote'?'დისტანციური სამუშაო დღე დადასტურებულია':'დღეს ოფისში აღრიცხული დრო'}</Text>{r.data?.request?<View style={{gap:5}}><Text style={{color:r.data.request.status==='approved'?C.green:C.blue,fontSize:13}}>{r.data.request.status==='pending'?'მოთხოვნა გაგზავნილია · ელოდება განხილვას':r.data.request.status==='approved'?'მოთხოვნა დადასტურებულია':'მოთხოვნა უარყოფილია'}</Text>{!!r.data.request.response&&<Text style={S.muted}>{r.data.request.response}</Text>}</View>:day?.planned==='work'&&!day.firstArrival&&<Button secondary title="დისტანციურად მუშაობის მოთხოვნა" busy={busy} onPress={()=>void answer('remote')}/>}<State error={error||r.error}/></Fold>{r.data?.askRemote&&<View style={S.card}><Text style={S.subtitle}>აგვიანებ?</Text><Text style={[S.muted,{fontSize:12}]}>შენი პასუხი გაეგზავნება HR-ს.</Text>{[['late','მაგვიანდება'],['absent','არ ვმუშაობ'],['remote','დისტანციურზე ვარ']].map(([value,label])=><Button key={value} secondary title={label} busy={busy} onPress={()=>void answer(value)}/>)}</View>}</>;
}
