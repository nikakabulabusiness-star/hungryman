import {useMemo,useRef,useState} from 'react';
import {FlatList,Pressable,Text,View} from 'react-native';
import {api} from '../../lib/api';
import {useAuth} from '../../lib/auth';
import {hierarchyForRole,staffGroupingDefinitions,roleLabel} from '../../lib/departments';
import {useResource} from '../../lib/use-resource';
import type {Account} from '../../lib/types';
import {Button,Chip,Icon,Screen,Select,Sheet,State,confirm,success,S,C} from '../../ui/components';
const statuses=[{value:'approved',label:'აქტიური'},{value:'suspended',label:'შეჩერებული'}];
type Row={key:string;heading:string}|{key:string;account:Account};
export default function Accounts(){
 const r=useResource<{accounts:Account[];roles:string[]}>('/api/mobile/admin/accounts'),{refresh:refreshSession}=useAuth();
 const [edit,setEdit]=useState<Account|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[highlight,setHighlight]=useState('');
 const list=useRef<FlatList<Row>>(null),accounts=r.data?.accounts,pending=accounts?.filter(a=>a.status==='pending')||[];
 const rows=useMemo(()=>{const result:Row[]=[],groups=new Map<string,Account[]>();for(const a of accounts||[])groups.set(a.department,[...(groups.get(a.department)||[]),a]);const names=[...groups.keys()].sort((a,b)=>(staffGroupingDefinitions.find(d=>d.name===a)?.order??99)-(staffGroupingDefinitions.find(d=>d.name===b)?.order??99));for(const name of names){result.push({key:'department:'+name,heading:name});for(const account of groups.get(name)!.sort((a,b)=>hierarchyForRole(a.role||'')-hierarchyForRole(b.role||'')||a.fullName.localeCompare(b.fullName,'ka')))result.push({key:account.email,account})}return result},[accounts]);
 function open(a:Account){setEdit({...a});setError('')}
 function showPending(){const a=pending[0];if(!a)return;const index=rows.findIndex(row=>row.key===a.email);if(index>=0)list.current?.scrollToIndex({index,animated:true,viewPosition:0.2});setHighlight(a.email);open(a)}
 async function save(){if(!edit||edit.status==='pending')return;setBusy(true);setError('');try{await api('/api/admin/users',{method:'PATCH',body:{email:edit.email,role:edit.role,status:edit.status}});setEdit(null);success();await r.refresh();await refreshSession()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 function remove(a:Account){confirm(`ნამდვილად წაიშალოს ${a.fullName||a.email}-ის ანგარიში? აღდგენა შეუძლებელი იქნება.`,async()=>{setBusy(true);try{const result=await api<{self:boolean}>('/api/admin/users',{method:'DELETE',body:{email:a.email,confirmation:a.email}});setEdit(null);success();if(result.self)await refreshSession();else await r.refresh()}finally{setBusy(false)}})}
 return <Screen title="ანგარიშები" back scroll={false}>
  <View style={[S.row,{paddingHorizontal:20,paddingBottom:12}]}><Chip>{accounts?.length||0} ანგარიში</Chip><Pressable accessibilityRole="button" onPress={showPending} disabled={!pending.length}><Chip color={pending.length?C.amber:C.muted}>{pending.length} მოთხოვნა ↗</Chip></Pressable></View>
  {r.loading&&!r.data?<State loading/>:r.error?<State error={r.error} retry={r.refresh}/>:<FlatList ref={list} data={rows} keyExtractor={row=>row.key} contentContainerStyle={{paddingHorizontal:20,paddingBottom:30,gap:10}} refreshing={r.loading} onRefresh={()=>void r.refresh()} onScrollToIndexFailed={info=>list.current?.scrollToOffset({offset:info.averageItemLength*info.index,animated:true})} renderItem={({item})=>'heading'in item?<Text style={[S.eyebrow,{marginTop:12}]}>{item.heading}</Text>:<Pressable style={[S.card,highlight===item.account.email&&{borderColor:C.amber}]} onPress={()=>open(item.account)}><View style={S.between}><View style={{flex:1}}><Text style={S.subtitle}>{item.account.fullName||item.account.email}</Text><Text style={[S.muted,{fontSize:11}]}>{item.account.email}</Text></View><Icon name="chevron-forward" size={18}/></View><View style={[S.row,{flexWrap:'wrap',gap:6}]}><Chip color={item.account.status==='pending'?C.amber:item.account.status==='approved'?C.green:C.red}>{item.account.status==='pending'?'მოლოდინში':statuses.find(s=>s.value===item.account.status)?.label}</Chip>{item.account.role&&<Chip>{roleLabel(item.account.role)}</Chip>}</View></Pressable>}/>}
  <Sheet visible={!!edit} title="ანგარიშის მართვა" onClose={()=>{if(!busy){setEdit(null);setHighlight('')}}}>
   {edit&&<><Text style={S.subtitle}>{edit.fullName}</Text><Text style={S.muted}>{edit.email}</Text>{edit.status==='pending'&&<Chip color={C.amber}>ახალი მოთხოვნა · აირჩიე აქტიური ან შეჩერებული</Chip>}
    {edit.canManage?<><Select label="შტატი" value={edit.role||''} options={[{value:'',label:'პოზიციის გარეშე'},...[...new Set([...(r.data?.roles||[]),...(edit.role?[edit.role]:[])])].map(role=>({value:role,label:roleLabel(role)}))]} onChange={role=>setEdit({...edit,role:role||null})}/><Select label="ანგარიშის სტატუსი" value={edit.status==='pending'?'':edit.status} options={statuses} onChange={status=>setEdit({...edit,status})}/><Text style={[S.muted,{fontSize:12}]}>უფლებები ავტომატურად გადმოდის არჩეული შტატიდან. მათი შეცვლა შესაძლებელია შტატების მართვაში.</Text><Button title="შენახვა" disabled={edit.status==='pending'} busy={busy} onPress={()=>void save()}/></>:<Text style={S.muted}>{edit.role==='Developer'?'Developer-ს ყოველთვის სრული წვდომა აქვს.':'ამ ანგარიშის როლისა და სტატუსის შეცვლის უფლება არ გაქვს.'}</Text>}
    {error&&<State error={error}/>} {edit.canDelete&&<Button title="ანგარიშის სრულად წაშლა" secondary icon="trash-outline" disabled={busy} onPress={()=>remove(edit)}/>}</>}
  </Sheet>
 </Screen>;
}
