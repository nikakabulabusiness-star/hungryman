import {roleLabel} from '../lib/departments';
import {GroupEditor} from './group-editor';
import {ChatMute} from './chat-mute';
import {VoiceMessage} from './voice-message';
import {useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Image,Linking,Pressable,Text,View} from 'react-native';
import {router} from 'expo-router';
import {useAuth} from '../lib/auth';
import {hasPermission} from '../lib/permissions';
import {useResource} from '../lib/use-resource';
import {refreshResource,setResource} from '../lib/resource-cache';
import {api,chatImageSource} from '../lib/api';
import {pickChatPhoto,sendChatPhoto} from '../lib/chat-media';
import type {ChatMessage,ChatSettings,ChatPerson,ConversationsData,ChatData} from '../lib/types';
import {Avatar,Button,Fold,Icon,Sheet,S,C} from './components';
const EMOJIS=['❤️','😂','👍','😮','😢','🙌','🔥','👏','😍','🎉','💪','✅'];
export function ChatInfo({id,title,settings,pins,onClose,onUpdated,onPhoto,onCall}:{id:string;title:string;settings?:ChatSettings;pins:ChatMessage[];onClose:()=>void;onUpdated:()=>void;onPhoto:(id:string)=>void;onCall:(mode:'audio'|'video')=>void}){
 const p=useAuth().session?.permissions,self=useAuth().session?.user.userId;
 const canManage=hasPermission(p,'chat.manage_group'),canAttach=hasPermission(p,'chat.attach'),canCall=hasPermission(p,'chat.call');
 const members=useResource<{members:ChatPerson[];permissions:{canDelete:boolean}}>('/api/chat/conversations?id='+encodeURIComponent(id));
 const [opening,setOpening]=useState('');
 async function direct(person:ChatPerson){if(opening||!hasPermission(p,'chat.send'))return;setOpening(person.userId);try{const result=await api<{id:string}>('/api/chat/conversations',{method:'POST',body:{userId:person.userId}});onClose();router.replace({pathname:'/conversation/[id]',params:{id:result.id,title:person.name}})}catch(e){Alert.alert('პირადი ჩატი',(e as Error).message)}finally{setOpening('')}}
 const [manage,setManage]=useState(false);
 const [busy,setBusy]=useState(false),[emoji,setEmoji]=useState(settings?.emoji||'❤️'),[photo,setPhoto]=useState(settings?.photoId||null),[tab,setTab]=useState<'images'|'audio'|'links'>('images');
 async function removeConversation(){
  if(busy||!members.data?.permissions.canDelete)return;setBusy(true);
  try{
   const result=await api<{clearedBefore?:number}>('/api/chat/conversations',{method:'DELETE',body:{id}});
   setResource<ChatData>(id==='team'?'/api/chat/messages':'/api/chat/messages?conversationId='+encodeURIComponent(id),{messages:[],pinned:[],historyStart:result.clearedBefore||0});
   setResource<ConversationsData>('/api/chat/conversations',old=>old?{...old,conversations:old.conversations.filter(c=>c.id!==id),canRestoreTeam:id==='team'||old.canRestoreTeam}:old);
   void refreshResource('/api/chat/conversations');void refreshResource('/api/notifications?counts=1');
   onClose();router.replace('/(main)/chat');
  }catch(e){Alert.alert('ჩატის წაშლა',(e as Error).message)}finally{setBusy(false)}
 }
 function confirmDelete(){Alert.alert(id.startsWith('dm_')?'პირადი ჩატის წაშლა':'ჩატის წაშლა ყველასთვის',id.startsWith('dm_')?'წარსული შეტყობინებები მხოლოდ შენთან წაიშლება. მეორე მონაწილეს დარჩება. ახალი შეტყობინება საუბარს ხელახლა გამოაჩენს.':'ეს ჩატი, მისი შეტყობინებები და ფაილები ყველა მონაწილესთან წაიშლება.',[{text:'გაუქმება',style:'cancel'},{text:'წაშლა',style:'destructive',onPress:()=>void removeConversation()}])}
 async function save(body:{emoji?:string;photoId?:string|null}){await api('/api/chat/settings',{method:'PATCH',body:{conversationId:id,...body}});onUpdated()}
 async function changePhoto(){if(busy)return;setBusy(true);try{const picked=await pickChatPhoto();if(picked){const uploaded=await sendChatPhoto(picked,id);await save({photoId:uploaded});setPhoto(uploaded)}}catch(e){Alert.alert('ჩატის ფოტო',(e as Error).message)}finally{setBusy(false)}}
 if(manage)return <GroupEditor id={id} title={title} onClose={()=>setManage(false)} onSaved={()=>{setManage(false);onUpdated()}}/>;
 return <Sheet visible title={title} onClose={onClose}><View style={[S.row,{justifyContent:'center'}]}><Pressable accessibilityLabel="ჩატის ფოტოს შეცვლა" disabled={busy||!canManage||!canAttach} onPress={()=>void changePhoto()}>{photo?<Image source={chatImageSource(photo)} style={{width:80,height:80,borderRadius:40}}/>:<View style={{width:80,height:80,borderRadius:40,backgroundColor:C.raised,alignItems:'center',justifyContent:'center'}}><Icon name="camera-outline" size={30}/></View>}</Pressable></View>{photo&&canManage&&<Button secondary title="ჩატის ფოტოს მოხსნა" onPress={()=>{void save({photoId:null}).then(()=>setPhoto(null)).catch(e=>Alert.alert('ფოტო',e.message))}}/>}<Text style={[S.muted,{fontSize:12}]}>ფოტო და მთავარი ემოჯი საუბრის ყველა წევრს ეცვლება.</Text>{canManage&&id.startsWith('grp_')&&<Button secondary title="ჯგუფის სახელი და მონაწილეები" icon="people-outline" onPress={()=>setManage(true)}/>}<Text style={S.subtitle}>მთავარი ემოჯი</Text><View style={[S.row,{flexWrap:'wrap'}]}>{EMOJIS.map(e=><Pressable accessibilityLabel={e} key={e} disabled={busy||!canManage} onPress={()=>{setBusy(true);void save({emoji:e}).then(()=>setEmoji(e)).catch(err=>Alert.alert('ემოჯი',err.message)).finally(()=>setBusy(false))}} style={{padding:10,borderRadius:14,backgroundColor:emoji===e?C.raised:'transparent',borderWidth:1,borderColor:emoji===e?C.red:'transparent'}}><Text style={{fontSize:24}}>{e}</Text></Pressable>)}</View>{canCall&&<View style={S.row}><View style={{flex:1}}><Button title="აუდიოზარი" icon="call-outline" secondary onPress={()=>onCall('audio')}/></View><View style={{flex:1}}><Button title="ვიდეოზარი" icon="videocam-outline" onPress={()=>onCall('video')}/></View></View>}<Fold title="მონაწილეები" subtitle={String(members.data?.members.length||0)}>{members.data?.members.map(person=><Pressable key={person.userId} disabled={person.userId===self||!!opening||!hasPermission(p,'chat.send')} style={S.row} onPress={()=>void direct(person)}><Avatar userId={person.userId} name={person.name} hasAvatar={person.hasAvatar} size={36}/><View style={{flex:1}}><Text style={S.text}>{person.name}{person.userId===self?' · შენ':''}</Text><Text style={[S.muted,{fontSize:11}]}>{roleLabel(person.role)}</Text></View>{person.userId!==self&&<Icon name="chatbubble-outline" size={18}/>}</Pressable>)}</Fold><ChatMute id={id}/>{members.data?.permissions.canDelete&&<Pressable accessibilityRole="button" accessibilityLabel="ჩატის წაშლა" disabled={busy} onPress={confirmDelete} style={[S.row,{paddingVertical:12}]}><Icon name="trash-outline" color={C.red}/><Text style={{color:C.red,fontSize:13}}>{busy?'იშლება…':id.startsWith('dm_')?'ჩატის წაშლა მხოლოდ ჩემთან':'ჩატის წაშლა ყველასთვის'}</Text></Pressable>}<Text style={S.subtitle}>მედია და ბმულები</Text><View style={S.row}>{(['images','audio','links'] as const).map(t=><Pressable key={t} onPress={()=>setTab(t)} style={[S.chip,{backgroundColor:tab===t?C.raised:C.bg}]}><Text style={S.text}>{t==='images'?'ფოტოები':t==='audio'?'ვოისები':'ბმულები'}</Text></Pressable>)}</View><SharedMedia key={tab} id={id} kind={tab} onPhoto={onPhoto}/><Text style={S.subtitle}>აპინული შეტყობინებები</Text>{pins.length?pins.map(m=><View key={m.id} style={S.card}><Text style={[S.muted,{fontSize:11}]}>{m.authorName}</Text><Text style={S.text}>{m.body||'📷 ფოტო'}</Text></View>):<Text style={S.muted}>ჯერ არაფერია აპინული</Text>}</Sheet>
}
type Media={id:string;body:string;attachmentId:string|null;created:number;authorName:string;durationMs?:number};
function SharedMedia({id,kind,onPhoto}:{id:string;kind:string;onPhoto:(id:string)=>void}){
 const [items,setItems]=useState<Media[]>([]),[more,setMore]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const path='/api/chat/media?conversationId='+encodeURIComponent(id)+'&kind='+kind;
 useEffect(()=>{let stopped=false;void api<{items:Media[];hasMore:boolean}>(path).then(r=>{if(!stopped){setItems(r.items);setMore(r.hasMore)}}).catch(e=>{if(!stopped)setError(e.message)}).finally(()=>{if(!stopped)setBusy(false)});return()=>{stopped=true}},[path]);
 async function next(){if(busy)return;setBusy(true);setError('');try{const last=items.at(-1),r=await api<{items:Media[];hasMore:boolean}>(path+(last?'&before='+last.created+'&beforeId='+last.id:''));setItems(old=>[...old,...r.items.filter(i=>!old.some(v=>v.id===i.id))]);setMore(r.hasMore)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <>{kind==='images'?<View style={[S.row,{flexWrap:'wrap'}]}>{items.map(m=><Pressable key={m.id} onPress={()=>onPhoto(m.attachmentId!)}><Image source={chatImageSource(m.attachmentId!)} style={{width:82,height:82,borderRadius:14}}/></Pressable>)}</View>:kind==='audio'?items.map(m=><View key={m.id} style={S.card}><Text style={S.muted}>{m.authorName}</Text><VoiceMessage id={m.attachmentId!} durationMs={m.durationMs}/></View>):items.map(m=><View key={m.id} style={S.card}><Text style={[S.muted,{fontSize:11}]}>{m.authorName}</Text>{m.body.match(/https?:\/\/[^\s]+/g)?.map((url,i)=><Pressable key={i} onPress={()=>void Linking.openURL(url).catch(()=>Alert.alert('ბმული ვერ გაიხსნა'))}><Text numberOfLines={2} style={{color:C.blue,fontSize:13}}>{url}</Text></Pressable>)}</View>)}{busy&&<ActivityIndicator color={C.blue}/>}<Text style={S.muted}>{error||(!busy&&!items.length?'ჯერ არაფერი გაზიარებულა':'')}</Text>{(more||error)&&<Button secondary title={error?'ხელახლა ცდა':'მეტის ნახვა'} busy={busy} onPress={()=>void next()}/>}</>
}
