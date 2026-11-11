'use client';
import {Bell,BellOff} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';

function confirmationSound(){
 try{const AudioContextClass=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!AudioContextClass)return;const context=new AudioContextClass(),gain=context.createGain(),tone=context.createOscillator();gain.gain.setValueAtTime(0.035,context.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,context.currentTime+.13);tone.frequency.setValueAtTime(740,context.currentTime);tone.frequency.exponentialRampToValueAtTime(990,context.currentTime+.09);tone.connect(gain);gain.connect(context.destination);tone.start();tone.stop(context.currentTime+.14);tone.onended=()=>void context.close();void context.resume()}catch{}
}
// Mute preferences are one small per-account list. Share it between thread
// switches (tab memory only) so opening another chat does not refetch it.
let shared:{at:number;mutedIds:string[]}|null=null,sharedRequest:Promise<string[]>|null=null;
if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){const reset=()=>{shared=null;sharedRequest=null};window.addEventListener('pagehide',reset);window.addEventListener('hmw:session-ended',reset)}
function loadPreferences(maxAge:number):Promise<string[]>{
 if(shared&&Date.now()-shared.at<maxAge)return Promise.resolve(shared.mutedIds);
 if(sharedRequest)return sharedRequest;
 const request=fetch('/api/chat/preferences',{cache:'no-store'}).then(async r=>{if(!r.ok){shared=null;throw Error()}const data=await r.json() as {mutedIds:string[]};if(sharedRequest===request)shared={at:Date.now(),mutedIds:data.mutedIds};return data.mutedIds}).finally(()=>{if(sharedRequest===request)sharedRequest=null});
 sharedRequest=request;return request;
}
export function ChatMute({conversationId,compact=false}:{conversationId:string;compact?:boolean}){
 const [muted,setMuted]=useState(false),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),busyRef=useRef(false),generation=useRef(0);
 useEffect(()=>{let active=true;++generation.current;setReady(false);setError('');const load=(maxAge:number)=>{if(busyRef.current)return;const current=generation.current;return loadPreferences(maxAge).then(mutedIds=>{if(active&&!busyRef.current&&generation.current===current){setMuted(mutedIds.includes(conversationId));setReady(true)}}).catch(()=>{})};void load(15000);const timer=setInterval(()=>void load(0),15000);return()=>{active=false;++generation.current;clearInterval(timer)}},[conversationId]);
 async function toggle(){if(busyRef.current||!ready)return;const previous=muted,next=!previous,version=++generation.current;busyRef.current=true;setBusy(true);setMuted(next);setError('');if(!next)confirmationSound();
  try{const response=await fetch('/api/chat/preferences',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId,muted:next})}),data=await response.json() as {mutedIds:string[];error?:string};if(!response.ok)throw Error(data.error||'პარამეტრი ვერ შეინახა.');shared={at:Date.now(),mutedIds:data.mutedIds};sharedRequest=null;if(generation.current===version){setMuted(data.mutedIds.includes(conversationId));window.dispatchEvent(new CustomEvent('hmw:chat-preferences',{detail:{conversationId,muted:next}}))}}
  catch(e){if(generation.current===version){setMuted(previous);setError((e as Error).message)}}finally{busyRef.current=false;setBusy(false)}
 }
 return <span className={'hm-chat-mute '+(compact?'is-compact':'')}><button type="button" role="switch" aria-checked={!muted} disabled={!ready} aria-busy={busy} onClick={()=>void toggle()} aria-label="ჩატის შეტყობინებები" title={muted?'ჩატი დამიუთებულია — ხმის ჩართვა':'ჩატის ხმა ჩართულია — დამიუთება'}>{muted?<BellOff size={16}/>:<Bell size={16}/>}<span className="hm-mute-track"><i/></span>{!compact&&<small>{muted?'დამიუთებულია':'ხმა ჩართულია'}</small>}</button>{error&&<small className="hm-chat-mute-error" role="alert">{error}</small>}</span>;
}
