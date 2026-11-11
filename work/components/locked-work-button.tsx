'use client';
import {LockKeyhole} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';

export default function LockedWorkButton(){
 const [pressed,setPressed]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 function explain(){
  clearTimeout(timer.current);
  setPressed(true);
  timer.current=setTimeout(()=>setPressed(false),1800);
 }
 return <button type="button" aria-disabled="true" aria-label="Work დროებით ჩაკეტილია" className="hm-work-lock" data-pressed={pressed} onClick={explain}><LockKeyhole size={16}/><span aria-live="polite">{pressed?'დროებით ჩაკეტილია':'Work'}</span></button>;
}
