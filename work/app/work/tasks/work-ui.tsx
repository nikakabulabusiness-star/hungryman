'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {X,RefreshCw,Inbox} from 'lucide-react';
import {preparePhoto} from '@/components/shoot-photo';
import {workDataEpoch} from '@/lib/work-data-cache';

export function WorkDialog({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close()},[]);
 return <dialog ref={ref} className={'hm-work-dialog'+(wide?' is-wide':'')} onCancel={event=>{event.preventDefault();onClose()}} onClick={event=>{if(event.target===event.currentTarget)onClose()}}><section><header><h2>{title}</h2><button type="button" className="hm-work-icon-button" aria-label="დახურვა" onClick={onClose}><X size={20}/></button></header>{children}</section></dialog>;
}
export function WorkState({error,loading,retry,children}:{error?:string;loading?:boolean;retry?:()=>void;children?:ReactNode}){return <div className={'hm-work-state'+(error?' is-error':'')} role={error?'alert':'status'}>{loading?<><span className="hm-work-loading"/>იტვირთება…</>:error?<><p>{error}</p>{retry&&<button type="button" className="hm-work-button secondary" onClick={retry}><RefreshCw size={16}/>ხელახლა ცდა</button>}</>:<><Inbox size={26}/><div>{children||'აქ ჩანაწერები ჯერ არ არის.'}</div></>}</div>}
export function WorkFeedback({error,message}:{error?:string;message?:string}){return error||message?<p className={'hm-work-feedback'+(error?' is-error':'')} role={error?'alert':'status'}>{error||message}</p>:null}
export const workDate=(value:string|number|null|undefined)=>value?new Intl.DateTimeFormat('ka-GE',{timeZone:'Asia/Tbilisi',day:'numeric',month:'short',...(typeof value==='number'?{hour:'2-digit',minute:'2-digit'}:{})}).format(new Date(typeof value==='string'?value+'T12:00:00+04:00':value)):'ვადის გარეშე';
export const workMoney=(tetri:number)=>new Intl.NumberFormat('ka-GE',{style:'currency',currency:'GEL',maximumFractionDigits:2}).format(tetri/100);
export const workRoleLabel=(role:string)=>({'Owner':'დამფუძნებელი','HR':'ადამიანური რესურსები','Senior Editor':'უფროსი მემონტაჟე','Video Editor':'ვიდეო მემონტაჟე','Shorts Video Editor':'მოკლე ვიდეოების მემონტაჟე','Thumbnail Designer':'გარეკანის დიზაინერი','Content Creator':'კონტენტის შემქმნელი','Developer':'თანამშრომელი','Administrator':'თანამშრომელი'} as Record<string,string>)[role]||role;
export async function uploadWorkPhoto(file:File):Promise<string>{
 if(!file.type.startsWith('image/'))throw Error('აირჩიე ფოტო.');
 const blob=await preparePhoto(file),response=await fetch('/api/work/files',{method:'POST',headers:{'Content-Type':blob.type||'image/jpeg'},body:blob}),data=await response.json() as {id?:string;error?:string};
 if(!response.ok||!data.id)throw Error(data.error||'ფოტო ვერ აიტვირთა.');return data.id;
}
/** Work mutations keep the current screen visible, then revalidate mounted readers. */
export async function workApi<T=Record<string,unknown>>(path:string,method='GET',body?:unknown):Promise<T>{
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000),epoch=workDataEpoch();
 try{const response=await fetch(path,{method,cache:'no-store',signal:controller.signal,headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),data=await response.json() as T&{error?:string};if(epoch!==workDataEpoch())throw Error('გვერდის მდგომარეობა შეიცვალა. განაახლე გვერდი.');if(!response.ok)throw Error(data.error||'მოთხოვნა ვერ შესრულდა.');if(method!=='GET')window.dispatchEvent(new Event('hmw-work-updated'));return data}catch(error){if(controller.signal.aborted)throw Error('კავშირი შეფერხდა. სცადე ხელახლა.');throw error}finally{clearTimeout(timeout)}
}
