import {hasPermission} from '../lib/permissions';
import {memo,useRef,useState} from 'react';
import {FlatList,Pressable,Text,View} from 'react-native';
import {router} from 'expo-router';
import {api} from '../lib/api';
import {useAuth} from '../lib/auth';
import {useResource} from '../lib/use-resource';
import {refreshResource,setResource} from '../lib/resource-cache';
import type {Session} from '../lib/types';
import {Button,Icon,Screen,State,S,C} from './components';
export type NoticeCounts={disabled?:boolean;unread:number;requests:number;chatUnread:number};
type Notice={id:string;category:string;title:string;body:string;target:string;target_id:string;important:number;created:number;read_at:number|null};
type Notices={items:Notice[];next:{before:number;beforeId:string}|null}&NoticeCounts;
export function canReviewRequests(session:Session|null){return !!session?.permissions&&hasPermission(session.permissions,'calendar.manage')&&(!!session.permissions.isSiteAdmin||['HR','Owner','Developer'].includes(session.permissions.role||''))}
export function openNotice(n:{target:string;target_id:string}){
 if(n.target==='chat'&&/^(team|dm_[a-f\d]{64}|grp_[a-f\d-]{36})$/.test(n.target_id))router.push({pathname:'/conversation/[id]',params:{id:n.target_id}});
 else if(n.target==='shoot'&&/^[a-f\d-]{36}$/i.test(n.target_id))router.push({pathname:'/shoot/[id]',params:{id:n.target_id}});
 else if(n.target==='work'&&/^[a-f\d-]{36}$/i.test(n.target_id))router.push({pathname:'/work-video/[id]',params:{id:n.target_id}});
 else if(n.target==='work_task'&&/^[a-f\d-]{36}$/i.test(n.target_id))router.push({pathname:'/work-tasks',params:{pane:'tasks',taskId:n.target_id}});
 else if(n.target==='accounts')router.push('/admin/accounts');
 else if(n.target==='requests')router.push('/time-off-review');else if(n.target==='attendance'||n.target==='calendar')router.push('/profile');else router.push('/notifications');
}
export function NotificationButtons(){
 const r=useResource<NoticeCounts>('/api/notifications?counts=1'),review=canReviewRequests(useAuth().session);
 return <View style={[S.row,{gap:8}]}>{!r.data?.disabled&&<BadgeButton icon="notifications-outline" label="შეტყობინებები" count={r.data?.unread||0} onPress={()=>router.push('/notifications')}/>}{review&&<BadgeButton icon="file-tray-outline" label="შემოსული მოთხოვნები" count={r.data?.requests||0} onPress={()=>router.push('/time-off-review')}/>}</View>;
}
function BadgeButton({icon,label,count,onPress}:{icon:'notifications-outline'|'file-tray-outline';label:string;count:number;onPress:()=>void}){
 return <Pressable accessibilityRole="button" accessibilityLabel={label+(count?' · '+count+' წაუკითხავი':'')} onPress={onPress} hitSlop={5} style={[S.icon,{width:38,height:38}]}><Icon name={icon} size={20}/>{count>0&&<View pointerEvents="none" style={{position:'absolute',right:-3,top:-4,borderRadius:10,minWidth:18,height:18,paddingHorizontal:4,backgroundColor:C.red,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:10,fontWeight:'700',color:'white'}}>{count>99?'99+':count}</Text></View>}</Pressable>;
}
const NoticeRow=memo(function NoticeRow({notice:n,onPress}:{notice:Notice;onPress:(n:Notice)=>void}){
 return <Pressable accessibilityRole="button" accessibilityLabel={(n.read_at?'':'წაუკითხავი · ')+n.title} onPress={()=>onPress(n)} style={{padding:13,borderRadius:17,backgroundColor:n.read_at?C.surface:C.raised,borderWidth:1,borderColor:n.read_at?'transparent':C.line,flexDirection:'row',gap:10}}>
  <View style={{paddingTop:2}}><Icon name={n.category==='shoot'?'videocam-outline':n.category==='salary'?'wallet-outline':n.category==='request'?'file-tray-outline':'notifications-outline'} size={19} color={n.important?C.red:C.blue}/></View>
  <View style={{flex:1,gap:4}}><Text style={{color:C.text,fontSize:n.important?15:13,lineHeight:20,fontWeight:n.read_at?'500':'700'}}>{n.title}</Text><Text style={{color:C.muted,fontSize:12,lineHeight:18}} numberOfLines={3}>{n.body}</Text><Text style={{color:C.muted,fontSize:10}}>{new Date(n.created).toLocaleString('ka-GE',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</Text></View>
  {!n.read_at&&<View style={{width:7,height:7,borderRadius:4,backgroundColor:C.red,marginTop:6}}/>}
 </Pressable>;
});
export function NotificationCenter(){
 const r=useResource<Notices>('/api/notifications',15000);
 const [more,setMore]=useState<Notice[]>([]),[cursor,setCursor]=useState<Notices['next']|undefined>(),[busy,setBusy]=useState(false),[markingAll,setMarkingAll]=useState(false),[refreshing,setRefreshing]=useState(false),[error,setError]=useState('');
 const [reads,setReads]=useState<Record<string,number>>({}),[allReadAt,setAllReadAt]=useState(0),pending=useRef(new Set<string>());
 const items=[...new Map([...more,...(r.data?.items||[])].map(n=>[n.id,n])).values()].sort((a,b)=>b.created-a.created||b.id.localeCompare(a.id)).map(n=>n.read_at?n:{...n,read_at:reads[n.id]||(n.created<=allReadAt?allReadAt:null)});
 const next=cursor===undefined?r.data?.next:cursor;
 async function read(n?:Notice){
  if(n?.read_at){openNotice(n);return}
  const key=n?.id||'*';if(pending.current.has(key))return;pending.current.add(key);setError('');
  const timestamp=Date.now(),priorAll=allReadAt;
  if(n)setReads(old=>({...old,[n.id]:timestamp}));else{setAllReadAt(timestamp);setMarkingAll(true)}
  setResource<NoticeCounts>('/api/notifications?counts=1',old=>old?{...old,unread:n?Math.max(0,old.unread-1):0}:old);
  if(n)openNotice(n);
  try{await api('/api/notifications',{method:'PATCH',body:n?{id:n.id}:{all:true}});await r.refresh()}
  catch(e){if(n)setReads(old=>{const updated={...old};delete updated[n.id];return updated});else setAllReadAt(priorAll);setError((e as Error).message)}
  finally{pending.current.delete(key);setMarkingAll(false);void refreshResource('/api/notifications?counts=1')}
 }
 async function loadMore(){if(!next||busy)return;setBusy(true);setError('');try{const page=await api<Notices>('/api/notifications?before='+next.before+'&beforeId='+encodeURIComponent(next.beforeId));setMore(old=>[...old,...page.items]);setCursor(page.next)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function refresh(){setRefreshing(true);setMore([]);setCursor(undefined);setError('');try{await Promise.all([r.refresh(),refreshResource('/api/notifications?counts=1')])}finally{setRefreshing(false)}}
 return <Screen title="შეტყობინებები" back scroll={false}><FlatList
  data={items} keyExtractor={n=>n.id} renderItem={({item})=><NoticeRow notice={item} onPress={n=>void read(n)}/>}
  contentContainerStyle={[S.page,{gap:7}]} initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7}
  refreshing={refreshing} onRefresh={()=>void refresh()}
  ListHeaderComponent={<View style={{gap:8,marginBottom:5}}>{!!r.data?.unread&&<Button secondary title="ყველას წაკითხულად მონიშვნა" busy={markingAll} onPress={()=>void read()}/>}<State loading={r.loading&&!r.data} error={error||r.error}/></View>}
  ListEmptyComponent={!r.loading?<State empty="შეტყობინებები ჯერ არ არის"/>:undefined}
  ListFooterComponent={next?<Button title="მეტის ნახვა" secondary busy={busy} onPress={()=>void loadMore()}/>:undefined}
 /></Screen>;
}
