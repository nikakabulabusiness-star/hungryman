'use client';
import {useEffect,useRef,useState} from 'react';
import {Check} from 'lucide-react';

export default function SaveFeedback(){
 const [notice,setNotice]=useState<{text:string;id:number}|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{const saved=(event:Event)=>{if(timer.current)clearTimeout(timer.current);setNotice({text:String((event as CustomEvent).detail||'შენახულია'),id:Date.now()});timer.current=setTimeout(()=>setNotice(null),2600)};window.addEventListener('hungryman:saved',saved);return()=>{window.removeEventListener('hungryman:saved',saved);if(timer.current)clearTimeout(timer.current)}},[]);
 return notice?<div className="save-feedback" key={notice.id} role="status" aria-live="polite"><span><Check size={17}/></span>{notice.text}</div>:null;
}
