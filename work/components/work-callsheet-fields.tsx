'use client';

import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowDown,ArrowUp,GripVertical,ImagePlus,Plus,Trash2} from 'lucide-react';
import {uploadWorkPhoto} from '@/app/work/tasks/work-ui';

export const newWorkId=()=>crypto.randomUUID();
export function reorderWorkRows<T>(rows:T[],from:number,to:number):T[]{if(from<0||to<0||from>=rows.length||to>=rows.length||from===to)return rows;const next=[...rows],item=next.splice(from,1)[0];next.splice(to,0,item);return next;}
export function WorkField({label,value,onChange,type='text',wide=false,placeholder,maxLength=2000,required=false,readOnly=false}:{label:string;value:string|number|null|undefined;onChange:(value:string)=>void;type?:string;wide?:boolean;placeholder?:string;maxLength?:number;required?:boolean;readOnly?:boolean}){
 return <label className={'hm-cs-field'+(wide?' is-wide':'')}><span>{label}{required&&<i> *</i>}</span>{type==='textarea'?<textarea readOnly={readOnly} value={value??''} rows={5} maxLength={maxLength} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/>:<input readOnly={readOnly} type={type} value={value??''} step={type==='number'?'any':undefined} maxLength={maxLength} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/>}</label>;
}
export function WorkSelect({label,value,onChange,children,wide=false}:{label:string;value:string;onChange:(value:string)=>void;children:ReactNode;wide?:boolean}){return <label className={'hm-cs-field'+(wide?' is-wide':'')}><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{children}</select></label>}
export function WorkCheck({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}){return <label className="hm-cs-check"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span>{label}</span></label>}
export function WorkPanel({title,help,children,actions}:{title:string;help?:string;children:ReactNode;actions?:ReactNode}){return <section className="hm-cs-panel"><header><div><h2>{title}</h2>{help&&<p>{help}</p>}</div>{actions}</header>{children}</section>}
export function WorkRows<T extends {id:string}>({title,help,items,onChange,create,render,label,disabled=false}:{title:string;help?:string;items:T[];onChange:(items:T[])=>void;create:()=>T;render:(item:T,change:(patch:Partial<T>)=>void,index:number)=>ReactNode;label:(item:T,index:number)=>string;disabled?:boolean}){
 const dragging=useRef(-1);
 return <WorkPanel title={title} help={help} actions={!disabled&&<button type="button" className="hm-cs-secondary" onClick={()=>onChange([...items,create()])}><Plus size={16}/>დამატება</button>}>
  {!items.length&&<p className="hm-cs-empty">ჩანაწერები ჯერ არ არის.</p>}
  <div className="hm-cs-rows">{items.map((item,index)=><details key={item.id} className="hm-cs-row" open onDragOver={event=>{if(!disabled&&dragging.current>=0)event.preventDefault()}} onDrop={event=>{event.preventDefault();if(!disabled)onChange(reorderWorkRows(items,dragging.current,index));dragging.current=-1}}>
   <summary><span className="hm-cs-drag" draggable={!disabled} title="ხელის მოკიდებით გადაადგილება" onDragStart={event=>{if(disabled){event.preventDefault();return}dragging.current=index;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',item.id)}} onDragEnd={()=>{dragging.current=-1}}><GripVertical size={16}/></span><strong>{label(item,index)}</strong><span className="hm-cs-row-actions">{!disabled&&<><button type="button" aria-label={label(item,index)+' ზემოთ'} disabled={index===0} onClick={event=>{event.preventDefault();onChange(reorderWorkRows(items,index,index-1))}}><ArrowUp size={15}/></button><button type="button" aria-label={label(item,index)+' ქვემოთ'} disabled={index===items.length-1} onClick={event=>{event.preventDefault();onChange(reorderWorkRows(items,index,index+1))}}><ArrowDown size={15}/></button><button type="button" aria-label={label(item,index)+' წაშლა'} onClick={event=>{event.preventDefault();onChange(items.filter(x=>x.id!==item.id))}}><Trash2 size={15}/></button></>}</span></summary>
   <div className="hm-cs-form-grid">{render(item,patch=>onChange(items.map(x=>x.id===item.id?{...x,...patch}:x)),index)}</div>
  </details>)}</div>
 </WorkPanel>;
}
export function WorkPhotos({ids,onChange,disabled=false,title='ფოტოები'}:{ids:string[];onChange:(ids:string[])=>void;disabled?:boolean;title?:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function add(files:FileList|null){if(!files?.length||busy)return;setBusy(true);setError('');const added:string[]=[];try{if(ids.length+files.length>24)throw Error('ერთ სექციაში მაქსიმუმ 24 ფოტოა შესაძლებელი.');for(const file of Array.from(files))added.push(await uploadWorkPhoto(file));onChange([...ids,...added]);}catch(reason){if(added.length)onChange([...ids,...added]);setError((reason as Error).message)}finally{setBusy(false)}}
 return <div className="hm-cs-photos"><header><strong>{title}</strong>{!disabled&&<label className="hm-cs-upload"><ImagePlus size={16}/>{busy?'იტვირთება…':'ფოტოს დამატება'}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple disabled={busy} onChange={event=>{void add(event.target.files);event.target.value=''}}/></label>}</header>
  <div className="hm-cs-photo-grid">{ids.map(id=><figure key={id}><a href={'/api/work/files?id='+encodeURIComponent(id)} target="_blank" rel="noopener noreferrer"><img src={'/api/work/files?id='+encodeURIComponent(id)} alt="გადაღების რეფერენსი" loading="lazy"/></a>{!disabled&&<button type="button" aria-label="ფოტოს ამოღება" onClick={()=>onChange(ids.filter(x=>x!==id))}><Trash2 size={15}/></button>}</figure>)}</div>{!ids.length&&<p className="hm-cs-empty">ატვირთული ფოტოები აქ გამოჩნდება.</p>}{error&&<p className="hm-cs-error" role="alert">{error}</p>}
 </div>;
}
export function WorkLocationMap({latitude,longitude,title,disabled,onChange}:{latitude:number|null;longitude:number|null;title:string;disabled:boolean;onChange:(point:{latitude:number;longitude:number;mapUrl:string})=>void}){
 const frame=useRef<HTMLIFrameElement>(null),latest=useRef({disabled,onChange});
 useEffect(()=>{latest.current={disabled,onChange}},[disabled,onChange]);
 const send=useCallback(()=>frame.current?.contentWindow?.postMessage({mapInput:{select:!disabled,pins:latitude!==null&&longitude!==null?[{latitude,longitude,title:title||'გადაღების ლოკაცია'}]:[]}},location.origin),[disabled,latitude,longitude,title]);
 useEffect(()=>{const receive=(event:MessageEvent)=>{const lat=event.data?.latitude,lon=event.data?.longitude;if(latest.current.disabled||event.origin!==location.origin||event.source!==frame.current?.contentWindow||typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return;latest.current.onChange({latitude:lat,longitude:lon,mapUrl:'https://www.google.com/maps/search/?api=1&query='+lat+','+lon});};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)},[]);
 useEffect(()=>{send()},[send]);
 return <div className="hm-cs-location-map is-wide"><p>{disabled?'გადაღების ლოკაცია რუკაზე':'მონიშნე ადგილი რუკაზე — კოორდინატები და ბმული ავტომატურად შეივსება.'}</p><iframe ref={frame} title="გადაღების ლოკაცია" loading="lazy" src={'/work/map.html#'+encodeURIComponent(JSON.stringify({select:!disabled}))} onLoad={send}/></div>;
}
