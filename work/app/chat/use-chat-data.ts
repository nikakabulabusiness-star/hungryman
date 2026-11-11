'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {clearChatMemory,readChatMemory,writeChatMemory} from './chat-memory';

// Poll only after the previous request finishes; hidden dock instances do no work.
export function useChatData<T>(user:string,path:string,interval=15000,active=true){
 const [state,setState]=useState<{key:string;data:T|null;error:string}>(()=>({key:user+path,data:readChatMemory<T>(user,path)??null,error:''}));
 const alive=useRef(false),controller=useRef<AbortController|null>(null),request=useRef<Promise<void>|null>(null);
 const refresh=useCallback(()=>{
  if(request.current)return request.current;
  const abort=new AbortController();controller.current=abort;
  const timer=setTimeout(()=>abort.abort(),12000);
  const operation=(async()=>{try{
   const response=await fetch(path,{cache:'no-store',signal:abort.signal}),data=await response.json() as T & {error?:string};
   if(!response.ok){if([401,403,404].includes(response.status)){clearChatMemory(user);if(alive.current)setState({key:user+path,data:null,error:data.error||'წვდომა შეიცვალა.'})}throw Error(data.error||'ჩატი ვერ ჩაიტვირთა.')}
   if(!alive.current||abort.signal.aborted)return;
   writeChatMemory(user,path,data);setState({key:user+path,data,error:''});
  }catch(e){if(alive.current&&!abort.signal.aborted)setState(old=>({key:user+path,data:old.key===user+path?old.data:null,error:(e as Error).message}))}
  finally{clearTimeout(timer);if(controller.current===abort){request.current=null;controller.current=null}}})();
  request.current=operation;return operation;
 },[user,path]);
 useEffect(()=>{
  alive.current=true;let cancelled=false,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{if(cancelled)return;if(active&&document.visibilityState!=='hidden')await refresh();if(!cancelled)timer=setTimeout(poll,interval)};
  void poll();const visible=()=>{if(active&&document.visibilityState==='visible')void refresh()};document.addEventListener('visibilitychange',visible);
  return()=>{cancelled=true;alive.current=false;clearTimeout(timer);controller.current?.abort();controller.current=null;request.current=null;document.removeEventListener('visibilitychange',visible)};
 },[refresh,interval,active]);
 return {data:state.key===user+path?state.data:readChatMemory<T>(user,path)??null,error:state.key===user+path?state.error:'',refresh};
}
