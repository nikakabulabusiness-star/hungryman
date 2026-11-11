'use client';

import {useEffect,useRef,useState} from 'react';
import {Minus,Plus,X} from 'lucide-react';

export function PhotoViewer({src,alt='გაზიარებული ფოტო',onClose}:{src:string;alt?:string;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[zoomed,setZoomed]=useState(false);
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close()},[]);
 return <dialog ref={dialog} className={'hm-photo-viewer'+(zoomed?' is-zoomed':'')} aria-label={alt} onClose={onClose} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}}>
  <div className="hm-photo-surface"><header><span>{alt}</span><button type="button" aria-label={zoomed?'ფოტოს დაპატარავება':'ფოტოს გადიდება'} title={zoomed?'დაპატარავება':'გადიდება'} onClick={()=>setZoomed(!zoomed)}>{zoomed?<Minus size={18}/>:<Plus size={18}/>}</button><button autoFocus type="button" aria-label="ფოტოს დახურვა" title="დახურვა · Esc" onClick={()=>dialog.current?.close()}><X size={18}/></button></header>
   <button type="button" className="hm-photo-canvas" aria-label={zoomed?'ფოტოს დაპატარავება':'ფოტოს გადიდება'} onClick={()=>setZoomed(!zoomed)}><img src={src} alt={alt}/></button>
   <small>ფოტოზე დაჭერა — ზომის შეცვლა · Esc — დახურვა</small>
  </div>
 </dialog>;
}
