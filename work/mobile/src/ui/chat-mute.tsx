import {useState} from 'react';
import {Alert,Switch,Text,View} from 'react-native';
import {useAudioPlayer,setAudioModeAsync} from 'expo-audio';
import {audioBusy} from '../lib/audio-focus';
import {api} from '../lib/api';
import {useResource} from '../lib/use-resource';
import {setResource} from '../lib/resource-cache';
import {Button,Icon,S,C} from './components';
export function ChatMute({id}:{id:string}){
 const r=useResource<{mutedIds:string[]}>('/api/chat/preferences',10000),[pending,setPending]=useState<boolean|null>(null),sound=useAudioPlayer(require('../../assets/notification.wav'));
 const muted=pending??r.data?.mutedIds.includes(id)??false;
 async function toggle(next:boolean){if(!r.data||pending!==null)return;const before=r.data;setPending(next);setResource('/api/chat/preferences',{mutedIds:next?[...new Set([...before.mutedIds,id])]:before.mutedIds.filter(v=>v!==id)});
  try{const data=await api<{mutedIds:string[]}>('/api/chat/preferences',{method:'PATCH',body:{conversationId:id,muted:next}});setResource('/api/chat/preferences',data);if(!next&&!audioBusy()){void (async()=>{await setAudioModeAsync({allowsRecording:false,playsInSilentMode:false});await sound.seekTo(0);sound.play()})().catch(()=>{})}}
  catch(e){setResource('/api/chat/preferences',before);Alert.alert('შეტყობინებები',(e as Error).message)}finally{setPending(null)}
 }
 if(r.error&&!r.data)return <Button secondary title="შეტყობინებების ხელახლა ჩატვირთვა" onPress={()=>void r.refresh()}/>;
 return <View style={S.between}><Icon name={muted?'notifications-off-outline':'notifications-outline'} color={muted?C.muted:C.green}/><View style={{flex:1}}><Text style={S.text}>ჩატის დამიუთება</Text><Text style={[S.muted,{fontSize:11}]}>{muted?'დამიუთებულია · მონიშვნები კვლავ მოგივა':'ხმა ჩართულია'}</Text></View><Switch accessibilityLabel="ჩატის დამიუთება" value={muted} disabled={!r.data||pending!==null} onValueChange={next=>void toggle(next)} trackColor={{false:C.raised,true:C.red}} thumbColor={C.text}/></View>;
}
