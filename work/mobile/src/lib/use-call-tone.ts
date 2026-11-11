import {useEffect} from 'react';
import {AppState} from 'react-native';
import {createAudioPlayer} from 'expo-audio';

// An imperative, owned player: never alter the WebRTC recording/audio mode.
export function useCallTone(kind:'incoming'|'outgoing'|null){
 useEffect(()=>{
  if(!kind)return;
  const player=createAudioPlayer(kind==='incoming'?require('../../assets/call-incoming.wav'):require('../../assets/call-outgoing.wav'));
  player.loop=true;player.volume=.35;
  let disposed=false,expired=false,generation=0;
  const stop=()=>{generation++;try{player.pause()}catch{}};
  const play=async()=>{stop();const current=generation;if(disposed||expired||AppState.currentState!=='active')return;try{await player.seekTo(0);if(!disposed&&!expired&&current===generation&&AppState.currentState==='active')player.play()}catch{}};
  void play();
  const listener=AppState.addEventListener('change',state=>{if(state==='active')void play();else stop()});
  const timeout=setTimeout(()=>{expired=true;stop()},30000);
  return()=>{disposed=true;clearTimeout(timeout);listener.remove();stop();player.remove()};
 },[kind]);
}
