import {useCallback,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {resourceEntry,subscribeResource,refreshResource,setResource,prefetchResource} from './resource-cache';
export function useResource<T>(path:string,interval=0,enabled=true){
 const subscribe=useCallback((fn:()=>void)=>subscribeResource(path,fn),[path]);
 const snapshot=useCallback(()=>resourceEntry<T>(path),[path]);
 const current=useSyncExternalStore(subscribe,snapshot,snapshot);
 const refresh=useCallback(()=>enabled?refreshResource(path):Promise.resolve(),[path,enabled]);
 const setData=useCallback((value:T|null|((old:T|null)=>T|null))=>setResource<T>(path,value),[path]);
 useFocusEffect(useCallback(()=>{if(!enabled)return;void prefetchResource(path);const listener=AppState.addEventListener('change',state=>{if(state==='active')void refresh()});const timer=interval?setInterval(()=>{if(AppState.currentState==='active')void refresh()},interval):undefined;return()=>{listener.remove();if(timer)clearInterval(timer)}},[path,interval,refresh,enabled]));
 return {...current,...(!enabled?{data:null,error:'',loading:false}:{}),refresh,setData};
}
