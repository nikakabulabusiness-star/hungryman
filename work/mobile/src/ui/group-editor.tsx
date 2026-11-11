import {roleLabel} from '../lib/departments';
import {useState} from 'react';
import {Image,Pressable,Text,View} from 'react-native';
import {api} from '../lib/api';
import {useResource} from '../lib/use-resource';
import {pickChatPhoto,sendChatPhoto} from '../lib/chat-media';
import type {ConversationsData} from '../lib/types';
import {Button,Field,Icon,Sheet,State,S,C} from './components';
export function GroupEditor({id,title='',onClose,onSaved}:{id?:string;title?:string;onClose:()=>void;onSaved:(id:string)=>void}){
 const [name,setName]=useState(title),[selected,setSelected]=useState<string[]>([]),[departments,setDepartments]=useState<string[]>([]),[query,setQuery]=useState(''),[photo,setPhoto]=useState<{uri:string;id:string}|null>(null),[created,setCreated]=useState(id),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const r=useResource<ConversationsData>('/api/chat/conversations'),members=useResource<{members:{userId:string;name:string}[]}>('/api/chat/conversations?id='+encodeURIComponent(id||'team'),0,!!id),people=r.data?.people||[],filter=query.trim().toLocaleLowerCase();
 const results=filter?people.filter(p=>!selected.includes(p.userId)&&!members.data?.members.some(m=>m.userId===p.userId)&&(p.name+' '+p.role).toLocaleLowerCase().includes(filter)).slice(0,30):[];
 const allowed=id?r.data?.permissions.canManageGroups:r.data?.permissions.canCreateGroups;
 async function save(){if(!allowed)return;setBusy(true);setError('');try{let next=created;if(!next){next=(await api<{id:string}>('/api/chat/conversations',{method:'POST',body:{title:name,memberIds:selected,departmentIds:departments}})).id;setCreated(next)}else await api('/api/chat/conversations',{method:'PATCH',body:{id:next,title:name,memberIds:selected,departmentIds:departments}});if(photo){const photoId=await sendChatPhoto(photo,next);await api('/api/chat/settings',{method:'PATCH',body:{conversationId:next,photoId}})}onSaved(next)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <Sheet visible title={id?'ჯგუფის მართვა':'ახალი ჯგუფი'} onClose={()=>{if(!busy)onClose()}}>
  <View style={S.row}>{r.data?.permissions.canAttach&&<Pressable accessibilityLabel="ჯგუფის ფოტოს ატვირთვა" style={[S.icon,{width:52,height:52,borderRadius:26}]} disabled={busy} onPress={()=>void pickChatPhoto().then(p=>{if(p)setPhoto(p)}).catch(e=>setError(e.message))}>{photo?<Image source={{uri:photo.uri}} style={{width:52,height:52,borderRadius:26}}/>:<Icon name="camera-outline"/>}</Pressable>}<View style={{flex:1}}><Field label="ჯგუფის სახელი" value={name} onChangeText={setName} maxLength={80}/></View></View>
  {id&&<Text style={[S.muted,{fontSize:12}]}>წევრები: {members.data?.members.map(p=>p.name).join(', ')||'იტვირთება…'}</Text>}
  <View style={[S.row,{flexWrap:'wrap',gap:6}]}>{selected.map(userId=><Pressable key={userId} accessibilityLabel="მონაწილის არჩევის გაუქმება" onPress={()=>setSelected(s=>s.filter(id=>id!==userId))} style={[S.chip,S.row,{gap:5}]}><Text style={[S.text,{fontSize:12}]}>{people.find(p=>p.userId===userId)?.name}</Text><Icon name="close" size={14}/></Pressable>)}</View>
  <Field label="მონაწილეების ძიება" placeholder="სახელი ან პოზიცია" value={query} onChangeText={setQuery}/>
  {results.map(p=><Pressable key={p.userId} style={[S.between,{paddingVertical:7}]} onPress={()=>{setSelected(s=>[...s,p.userId]);setQuery('')}}><View style={{flex:1}}><Text style={S.text}>{p.name}</Text><Text style={[S.muted,{fontSize:11}]}>{roleLabel(p.role)}</Text></View><Icon name="add-circle-outline"/></Pressable>)}
  {!!filter&&!results.length&&<Text style={S.muted}>ახალი მონაწილე ვერ მოიძებნა</Text>}
  {r.data?.permissions.canSelectDepartments&&!!r.data.departments.length&&<><Text style={S.subtitle}>მთლიანი დეპარტამენტი</Text><View style={[S.row,{flexWrap:'wrap',gap:8}]}>{r.data.departments.map(d=><Pressable key={d.id} accessibilityRole="checkbox" accessibilityState={{checked:departments.includes(d.id)}} onPress={()=>setDepartments(s=>s.includes(d.id)?s.filter(v=>v!==d.id):[...s,d.id])} style={[S.chip,{borderWidth:1,borderColor:departments.includes(d.id)?C.red:C.line}]}><Text style={[S.text,{fontSize:12}]}>{departments.includes(d.id)?'✓ ':''}{d.name}</Text></Pressable>)}</View></>}
  {(error||r.error||members.error)&&<State error={error||r.error||members.error}/>}<Button title="შენახვა" busy={busy} disabled={!allowed||!name.trim()||!id&&!selected.length&&!departments.length} onPress={()=>void save()}/>
 </Sheet>;
}
