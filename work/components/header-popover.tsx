'use client';

import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {ArrowUpRight,X} from 'lucide-react';
import './header-popover.css';

/** A non-modal, keyboard-accessible preview anchored beneath its own toolbar icon. */
export default function HeaderPopover({title,icon,count=0,href,active=false,children}:{title:string;icon:ReactNode;count?:number;href:string;active?:boolean;children:ReactNode}){
 const [open,setOpen]=useState(false),[left,setLeft]=useState<number|undefined>(),[height,setHeight]=useState(450);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
 useEffect(()=>{
  if(!open)return;
  const fit=()=>{const rect=root.current?.getBoundingClientRect();if(!rect)return;const width=Math.min(372,window.innerWidth-24);setLeft(Math.max(12-rect.left,Math.min(rect.width-width,window.innerWidth-12-rect.left-width)));setHeight(Math.max(180,window.innerHeight-rect.bottom-24));};
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus();}};
  const another=(event:Event)=>{if((event as CustomEvent<string>).detail!==id)setOpen(false);};
  fit();window.addEventListener('resize',fit);window.addEventListener('scroll',fit,{passive:true});document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);window.addEventListener('hmw:header-popover',another);
  return()=>{window.removeEventListener('resize',fit);window.removeEventListener('scroll',fit);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('hmw:header-popover',another);};
 },[open,id]);
 function toggle(){if(!open)window.dispatchEvent(new CustomEvent('hmw:header-popover',{detail:id}));setOpen(value=>!value);}
 return <div className="header-popover" ref={root} onBlur={event=>{if(event.relatedTarget instanceof Node&&!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
  <button ref={trigger} type="button" className={`staff-round-link notice-bell ${active||open?'active':''}`} title={title} aria-label={title+(count>0?` · ${count} ახალი`:'')} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={toggle}>{icon}{count>0&&<b aria-hidden="true">{count>99?'99+':count}</b>}</button>
  {open&&<section id={id} role="dialog" aria-label={title} className="header-popover-panel" style={{left,maxHeight:height}}>
   <header><strong>{title}</strong><button type="button" className="header-popover-close" aria-label="დახურვა" onClick={()=>{setOpen(false);trigger.current?.focus();}}><X size={16}/></button></header>
   <div className="header-popover-body">{children}</div>
   <a className="header-popover-all" href={href}>სრულ გვერდზე გადასვლა <ArrowUpRight size={15}/></a>
  </section>}
 </div>;
}
