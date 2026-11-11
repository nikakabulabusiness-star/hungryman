import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {monthBounds,moveMonth,dateLabel} from '../lib/dates';
import {Icon,S,C} from './components';
export function DateRange({from,to,onChange}:{from:string;to:string;onChange:(a:string,b:string)=>void}) {
 const [month,setMonth]=useState(from.slice(0,7)),[end,setEnd]=useState(false);
 const bounds=monthBounds(month),[y,m]=month.split('-').map(Number),offset=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7,days=Number(bounds.to.slice(-2));
 function choose(day:string){if(!end||day<from){onChange(day,day);setEnd(true)}else{onChange(from,day);setEnd(false)}}
 return <View style={{gap:10}}>
  <View style={S.between}><Pressable accessibilityLabel="წინა თვე" style={S.icon} onPress={()=>setMonth(moveMonth(month,-1))}><Icon name="chevron-back"/></Pressable><Text style={S.text}>{month}</Text><Pressable accessibilityLabel="შემდეგი თვე" style={S.icon} onPress={()=>setMonth(moveMonth(month,1))}><Icon name="chevron-forward"/></Pressable></View>
  <Text style={[S.muted,{fontSize:12}]}>{end?'აირჩიე ბოლო დღე (ან იგივე დღე)':'აირჩიე საწყისი დღე'}</Text>
  <View style={{flexDirection:'row',flexWrap:'wrap'}}>
   {['ო','ს','ო','ხ','პ','შ','კ'].map((d,i)=><Text key={'w'+i} style={{width:'14.2857%',color:C.muted,textAlign:'center',paddingBottom:6}}>{d}</Text>)}
   {Array.from({length:offset+days},(_,i)=>{if(i<offset)return <View key={i} style={{width:'14.2857%'}}/>;const day=month+'-'+String(i-offset+1).padStart(2,'0'),selected=day>=from&&day<=to;
    return <Pressable key={day} accessibilityLabel={dateLabel(day)} accessibilityState={{selected}} onPress={()=>choose(day)} style={{width:'14.2857%',height:42,justifyContent:'center',alignItems:'center',backgroundColor:selected?C.red:'transparent',borderRadius:10}}><Text style={{color:C.text}}>{i-offset+1}</Text></Pressable>;
   })}
  </View>
  <Text style={[S.text,{fontSize:12}]}>{dateLabel(from)}{from!==to?' — '+dateLabel(to):''}</Text>
 </View>;
}
