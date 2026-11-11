import {memo,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,Pressable,Text,View} from 'react-native';
import {AudioModule,RecordingPresets,setAudioModeAsync,useAudioPlayer,useAudioPlayerStatus,useAudioRecorder,useAudioRecorderState,type AudioSource} from 'expo-audio';
import * as Crypto from 'expo-crypto';
import {uploadChatVoice} from '../lib/api';
import {downloadVoice} from '../lib/voice-file';
import {loadAudio} from '../lib/voice-playback';
import type {File} from 'expo-file-system';
import {claimAudio,setRecording} from '../lib/audio-focus';
import {Button,Icon,Sheet,S,C} from './components';
const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
export const VoiceMessage=memo(function VoiceMessage({id,durationMs,source}:{id?:string;durationMs?:number|null;source?:AudioSource}){
 const player=useAudioPlayer(null,{updateInterval:250}),status=useAudioPlayerStatus(player);
 const file=useRef<File|null>(null),loaded=useRef(false),release=useRef<(()=>void)|null>(null),operation=useRef<AbortController|null>(null),alive=useRef(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{alive.current=true;const sub=AppState.addEventListener('change',s=>{if(s!=='active'){operation.current?.abort();player.pause();release.current?.();if(alive.current)setBusy(false)}});return()=>{alive.current=false;operation.current?.abort();sub.remove();release.current?.();try{file.current?.delete()}catch{}file.current=null}},[player]);
 useEffect(()=>{const sub=player.addListener('playbackStatusUpdate',s=>{if(s.didJustFinish)release.current?.();if(s.error){loaded.current=false;release.current?.();setBusy(false);setError('ჩანაწერი ვერ გაიხსნა. დააჭირე ხელახლა.')}});return()=>sub.remove()},[player]);
 async function toggle(){
  if(busy){operation.current?.abort();release.current?.();setBusy(false);return}
  if(status.playing){player.pause();release.current?.();return}
  const request=new AbortController();operation.current=request;setBusy(true);setError('');
  let relinquish:()=>void=()=>{};
  try{
   release.current?.();relinquish=claimAudio(()=>{request.abort();player.pause();if(alive.current&&operation.current===request)setBusy(false)});release.current=relinquish;
   await setAudioModeAsync({allowsRecording:false,playsInSilentMode:true,shouldPlayInBackground:false});
   if(request.signal.aborted||!alive.current)return;
   if(!loaded.current){
    let uri=typeof source==='string'?source:source&&typeof source==='object'?source.uri:undefined;
    if(!uri&&id){if(!file.current){const downloaded=await downloadVoice(id,request.signal);if(request.signal.aborted||!alive.current){downloaded.delete();return}file.current=downloaded}uri=file.current.uri}
    if(!uri)throw new Error('ჩანაწერი ვერ მოიძებნა.');
    await loadAudio(player,uri,request.signal);if(request.signal.aborted||!alive.current)return;loaded.current=true;
   }
   if(request.signal.aborted||!alive.current)return;
   if(status.didJustFinish||status.duration>0&&status.currentTime>=status.duration)await player.seekTo(0);
   if(!request.signal.aborted)player.play();
  }catch(e){relinquish();if(operation.current===request)loaded.current=false;if(alive.current&&operation.current===request&&!request.signal.aborted)setError((e as Error).message||'ჩანაწერი ვერ ჩაიტვირთა. სცადე ხელახლა.')}
  finally{if(alive.current&&operation.current===request)setBusy(false)}
 }
 const total=status.duration||((durationMs||0)/1000),progress=total?Math.min(1,status.currentTime/total):0;
 return <View style={{width:220,gap:6}}><View style={[S.row,{gap:10}]}><Pressable onPress={()=>void toggle()} accessibilityLabel={busy?'ჩატვირთვის გაუქმება':status.playing?'პაუზა':'ხმოვანი შეტყობინების მოსმენა'} style={{padding:10,minWidth:44,minHeight:44}}>{busy?<ActivityIndicator color={C.text}/>:<Icon name={status.playing?'pause':error?'refresh':'play'} color={C.text} size={23}/>}</Pressable><View style={{flex:1,gap:6}}><View style={{height:4,borderRadius:2,backgroundColor:'#ffffff40',overflow:'hidden'}}><View style={{width:`${progress*100}%`,height:4,backgroundColor:C.text}}/></View><Text style={{color:C.text,fontSize:11}}>{clock(status.playing?status.currentTime:total)}</Text></View><Icon name="mic-outline" color={C.text} size={16}/></View>{!!error&&<Text accessibilityRole="alert" style={{color:C.text,fontSize:11}}>{error}</Text>}</View>
});
type Draft={uri:string;id:string;durationMs:number};
export function VoiceRecorder({conversationId,onClose,onSend}:{conversationId:string;onClose:()=>void;onSend:(id:string,durationMs:number)=>void}){
 const recorder=useAudioRecorder({...RecordingPresets.HIGH_QUALITY,numberOfChannels:1,bitRate:64000}),state=useAudioRecorderState(recorder,200),[draft,setDraft]=useState<Draft|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),started=useRef(0),ending=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;let disposed=false;void(async()=>{try{const permission=await AudioModule.requestRecordingPermissionsAsync();if(disposed)return;if(!permission.granted)throw new Error('ჩანაწერისთვის პარამეტრებში დაუშვი მიკროფონზე წვდომა.');setRecording(true);await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true,shouldPlayInBackground:false});await recorder.prepareToRecordAsync();if(disposed)return;started.current=Date.now();recorder.record();setBusy(false)}catch(e){setRecording(false);if(!disposed){setBusy(false);setError((e as Error).message)}}})();return()=>{disposed=true;alive.current=false;setRecording(false);void recorder.stop().catch(()=>{}).finally(()=>setAudioModeAsync({allowsRecording:false,playsInSilentMode:false}).catch(()=>{}))}},[recorder]);
 async function stop(){if(ending.current||!started.current)return;ending.current=true;setBusy(true);try{const durationMs=Math.min(300000,Date.now()-started.current);await recorder.stop();setRecording(false);await setAudioModeAsync({allowsRecording:false,playsInSilentMode:true});if(!recorder.uri||durationMs<500)throw new Error('ჩაწერე მინიმუმ 1 წამი.');if(alive.current)setDraft({uri:recorder.uri,id:Crypto.randomUUID(),durationMs})}catch(e){if(alive.current)setError((e as Error).message)}finally{if(alive.current)setBusy(false)}}
 const stopRef=useRef(stop);useEffect(()=>{stopRef.current=stop});
 useEffect(()=>{const timer=setInterval(()=>{if(started.current&&Date.now()-started.current>=300000)void stopRef.current()},500);const sub=AppState.addEventListener('change',s=>{if(s!=='active')void stopRef.current()});return()=>{clearInterval(timer);sub.remove()}},[]);
 async function send(){if(!draft||busy)return;setBusy(true);setError('');try{const id=await uploadChatVoice(draft.uri,conversationId,draft.id,draft.durationMs);if(alive.current){onSend(id,draft.durationMs);onClose()}}catch(e){if(alive.current){setError((e as Error).message);setBusy(false)}}}
 return <Sheet visible title="ხმოვანი შეტყობინება" onClose={()=>{if(!busy)onClose()}}>{draft?<VoiceMessage source={{uri:draft.uri}} durationMs={draft.durationMs}/>:<View style={[S.row,{justifyContent:'center',padding:20}]}><Icon name="mic" color={C.red} size={32}/><Text style={[S.title,{fontVariant:['tabular-nums']}]}>{clock(state.durationMillis/1000)}</Text></View>}{error&&<Text style={S.error}>{error}</Text>}{draft?<Button title="გაგზავნა" icon="send" busy={busy} onPress={()=>void send()}/>:!error&&<Button title="შეჩერება და მოსმენა" icon="stop" busy={busy} onPress={()=>void stop()}/>}<Button secondary title="გაუქმება" disabled={busy} onPress={onClose}/><Text style={[S.muted,{fontSize:11}]}>მაქსიმუმ 5 წუთი · გაგზავნამდე შეგიძლია მოუსმინო.</Text></Sheet>
}
