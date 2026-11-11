'use client';
/* eslint-disable @next/next/no-img-element -- authenticated private map thumbnails */
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {MapPin,Plus,Pencil,Trash2,LocateFixed,Maximize2,Minimize2,Sun,Moon,X,ImagePlus} from 'lucide-react';
import {useWorkData,workRequest} from './cabinet-panel';
import type {MapPlace} from '@/lib/map-places';
import {mapsLink,validCoordinates,type Coordinates} from '@/lib/map-coordinates';
import './work-map.css';
type Pin=Coordinates&{title:string;office?:boolean;radius?:number;place?:boolean;photo?:string;date?:string;time?:string;past?:boolean;description?:string};
type Shoot={id:string;title:string;latitude:number|null;longitude:number|null;location_name:string;shoot_date:string;start_time:string};
type MapData={places:MapPlace[];canManagePlaces:boolean;office:(Coordinates&{name:string;radius:number})|null;shoots:Shoot[];history:Shoot[];historyCursor:{date:string;id:string}|null};
type Form={id?:string;name:string;url:string;point:Coordinates|null;photoId:string|null};
const photoUrl=(id:string)=>'/api/workspace/places/photo?id='+encodeURIComponent(id);
function MapFrame({pins,select=false,theme,userLocation,recenter,onSelect}:{pins:Pin[];select?:boolean;theme:'dark'|'light';userLocation?:Coordinates|null;recenter?:number;onSelect?:(p:Coordinates)=>void}){
 const frame=useRef<HTMLIFrameElement>(null),[error,setError]=useState('');
 const input=useMemo(()=>({pins,select,selectionKind:'place',theme,userLocation,recenter}),[pins,select,theme,userLocation,recenter]);
 const send=useCallback(()=>frame.current?.contentWindow?.postMessage({mapInput:input},location.origin),[input]);
 useEffect(()=>{send()},[send]);
 useEffect(()=>{function message(e:MessageEvent){if(e.origin!==location.origin||e.source!==frame.current?.contentWindow)return;const data=e.data;if(data?.initialized)send();if(data?.ready)setError('');if(data?.error)setError('რუკა ვერ ჩაიტვირთა. გადაამოწმე ინტერნეტი.');if(select&&validCoordinates(data))onSelect?.(data);if(Number.isInteger(data?.open)&&pins[data.open])window.open(mapsLink(pins[data.open]),'_blank','noopener,noreferrer')}
 window.addEventListener('message',message);return()=>window.removeEventListener('message',message)},[send,select,onSelect,pins]);
 return <div className={'workplace-map '+(select?'selecting':'')}><iframe ref={frame} title={select?'ადგილის მონიშვნა რუკაზე':'გუნდის რუკა'} src={'/work/map.html#'+encodeURIComponent(JSON.stringify({select,selectionKind:'place',theme}))} onLoad={send}/>{error&&<p role="status" className="workplace-map-error">{error}</p>}</div>
}
async function uploadThumbnail(file:File){
 if(!file.type.startsWith('image/'))throw Error('აირჩიე ფოტო.');
 if(file.size>20*1024*1024)throw Error('ფოტო ძალიან დიდია. აირჩიე 20 MB-მდე.');
 const bitmap=await createImageBitmap(file);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();throw Error('ფოტო ვერ დამუშავდა.')}
 const side=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);bitmap.close();
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('ფოტო ვერ დამუშავდა.')),'image/jpeg',0.75));
 const res=await fetch('/api/workspace/places/photo',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:blob}),body=await res.json() as {id:string;error?:string};if(!res.ok)throw Error(body.error||'ფოტო ვერ აიტვირთა.');return body.id;
}
export function TeamMap(){
 const r=useWorkData<MapData>('/api/workspace/map',30000),[theme,setTheme]=useState<'dark'|'light'>('dark'),[expanded,setExpanded]=useState(false),[locationPoint,setLocationPoint]=useState<Coordinates|null>(null),[recenter,setRecenter]=useState(0),[showPast,setShowPast]=useState(true),[more,setMore]=useState<Shoot[]>([]),[cursor,setCursor]=useState<MapData['historyCursor']|undefined>(),[form,setForm]=useState<Form|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const editor=useRef<HTMLElement>(null),editorOpen=!!form;
 const history=useMemo(()=>[...new Map([...(r.data?.history||[]),...more].map(p=>[p.id,p])).values()],[r.data?.history,more]);
 const pins=useMemo<Pin[]>(()=>[
  ...(r.data?.office?[{...r.data.office,title:r.data.office.name,office:true}]:[]),
  ...(r.data?.places||[]).map(p=>({...p,title:p.name,place:true,photo:p.photo_id?photoUrl(p.photo_id):undefined})),
  ...[...(r.data?.shoots||[]).map(p=>({...p,past:false})),...(showPast?history.map(p=>({...p,past:true})):[])].filter((p):p is Shoot&Coordinates&{past:boolean}=>validCoordinates(p)).map(p=>({latitude:p.latitude,longitude:p.longitude,title:p.title,date:p.shoot_date,time:p.start_time,past:p.past,description:p.location_name}))
 ],[r.data,history,showPast]);
 useEffect(()=>{function key(e:KeyboardEvent){if(e.key==='Escape')setExpanded(false)}document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[]);
 useEffect(()=>{if(editorOpen)editor.current?.scrollIntoView({behavior:'smooth',block:'start'})},[editorOpen]);
 function edit(place?:MapPlace){setError('');setForm(place?{id:place.id,name:place.name,url:place.url||'',point:{latitude:place.latitude,longitude:place.longitude},photoId:place.photo_id}:{name:'',url:'',point:null,photoId:null})}
 async function resolve(){if(!form)return;setBusy(true);setError('');try{const point=await workRequest<Coordinates>('/api/workspace/places','POST',{action:'resolve',url:form.url});setForm(old=>old?{...old,point}:null)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function save(e:React.FormEvent){e.preventDefault();if(!form||!form.point)return;setBusy(true);setError('');try{await workRequest('/api/workspace/places','POST',{id:form.id,name:form.name,...form.point,photoId:form.photoId});await r.refresh();setForm(null)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function remove(p:MapPlace){if(!window.confirm(`წაიშალოს „${p.name}“ რუკიდან?`))return;setBusy(true);setError('');try{await workRequest('/api/workspace/places','DELETE',{id:p.id});if(form?.id===p.id)setForm(null);await r.refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function photo(file:File){setBusy(true);setError('');try{const id=await uploadThumbnail(file);setForm(old=>old?{...old,photoId:id}:null)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 function locate(){setError('');if(!navigator.geolocation){setError('ამ ბრაუზერში მდებარეობა მიუწვდომელია.');return}navigator.geolocation.getCurrentPosition(p=>{setLocationPoint({latitude:p.coords.latitude,longitude:p.coords.longitude});setRecenter(n=>n+1)},()=>setError('მდებარეობა ვერ მოიძებნა. ბრაუზერის პარამეტრებში დაუშვი ლოკაცია.'),{enableHighAccuracy:true,timeout:15000,maximumAge:10000})}
 const next=cursor===undefined?r.data?.historyCursor:cursor;
 async function loadMore(){if(!next)return;setBusy(true);try{const page=await workRequest<MapData>('/api/workspace/map?beforeDate='+encodeURIComponent(next.date)+'&beforeId='+encodeURIComponent(next.id));setMore(old=>[...old,...page.history]);setCursor(page.historyCursor)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="team-map-page"><div className="workplace-heading"><div><p className="eyebrow">HUNGRYMAN WORK</p><h1>გუნდის რუკა</h1><p>ოფისი, გადაღებები და მნიშვნელოვანი ადგილები</p></div>{r.data?.canManagePlaces&&<button className="action" onClick={()=>edit()}><Plus size={18}/>ადგილის დამატება</button>}</div>
  {(error||r.error)&&<p role="alert" className="workplace-error">{error||r.error}</p>}
  <div className={'workplace-map-shell '+(expanded?'expanded':'')}><div className="workplace-toolbar"><button aria-label={theme==='dark'?'ღია თემა':'მუქი თემა'} onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={20}/>:<Moon size={20}/>}</button><button aria-label="ჩემი მდებარეობა" onClick={locate}><LocateFixed size={20}/></button><label><input type="checkbox" checked={showPast} onChange={e=>setShowPast(e.target.checked)}/>წინა გადაღებები</label><button aria-label={expanded?'რუკის შემცირება':'რუკის გადიდება'} onClick={()=>setExpanded(v=>!v)}>{expanded?<Minimize2 size={20}/>:<Maximize2 size={20}/>}</button></div><MapFrame pins={pins} theme={theme} userLocation={locationPoint} recenter={recenter}/></div>
  {r.data?.canManagePlaces&&form&&<section ref={editor} className="workplace-editor"><div className="workplace-heading"><h2>{form.id?'ადგილის შეცვლა':'ახალი ადგილი'}</h2><button className="workplace-icon" disabled={busy} aria-label="რედაქტორის დახურვა" onClick={()=>setForm(null)}><X/></button></div><form onSubmit={save}><label>სახელი<input value={form.name} maxLength={80} required onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Google Maps / Apple Maps ბმული<input type="url" placeholder="https://maps.app.goo.gl/…" value={form.url} onChange={e=>setForm({...form,url:e.target.value,point:null})}/></label><button type="button" className="work-secondary" disabled={busy||!form.url.trim()} onClick={()=>void resolve()}>ბმულიდან მონიშვნა</button><p>ან მონიშნე ზუსტი ადგილი რუკაზე.</p><MapFrame select theme={theme} pins={form.point?[{...form.point,title:form.name||'ახალი ადგილი',place:true}]:[]} onSelect={point=>setForm(old=>old?{...old,point,url:''}:null)}/><small>{form.point?`მონიშნულია · ${form.point.latitude.toFixed(5)}, ${form.point.longitude.toFixed(5)}`:'წერტილი ჯერ არ მონიშნულა'}</small><div className="workplace-photo-control">{form.photoId?<img src={photoUrl(form.photoId)} alt="ადგილის ფოტო"/>:<MapPin/>}<label className="work-secondary"><ImagePlus size={18}/>{form.photoId?'ფოტოს შეცვლა':'ფოტოს დამატება'}<input type="file" accept="image/*" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void photo(file);e.target.value=''}}/></label>{form.photoId&&<button type="button" className="workplace-danger" disabled={busy} onClick={()=>setForm({...form,photoId:null})}>ფოტოს მოცილება</button>}</div>{error&&<p role="alert" className="workplace-error">{error}</p>}<button className="action" disabled={busy||!form.point||!form.name.trim()}>{busy?'ინახება…':'ადგილის შენახვა'}</button></form></section>}
  <div className="workplace-heading"><h2>მნიშვნელოვანი ადგილები</h2><span>{r.data?.places.length||0} ადგილი</span></div><div className="workplace-grid">{r.data?.places.map(p=><article className="workplace-card" key={p.id}><div className="workplace-card-top">{p.photo_id?<img src={photoUrl(p.photo_id)} alt=""/>:<span className="workplace-icon"><MapPin/></span>}<h3>{p.name}</h3>{r.data?.canManagePlaces&&<button className="workplace-icon" aria-label={p.name+' · შეცვლა'} disabled={busy} onClick={()=>edit(p)}><Pencil size={18}/></button>}</div><div className="workplace-card-actions"><a href={mapsLink(p)} target="_blank" rel="noopener noreferrer">მარშრუტი ↗</a>{r.data?.canManagePlaces&&<button className="workplace-danger" aria-label={p.name+' · წაშლა'} disabled={busy} onClick={()=>void remove(p)}><Trash2 size={16}/>წაშლა</button>}</div></article>)}</div>{r.data&&!r.data.places.length&&<p>მნიშვნელოვანი ადგილი ჯერ არ დამატებულა.</p>}{!r.data&&!r.error&&<p role="status">რუკის მონაცემები იტვირთება…</p>}
  {!!r.data?.shoots.length&&<details className="workplace-history"><summary>დაგეგმილი გადაღებები · {r.data.shoots.length}</summary>{r.data.shoots.map(s=><p key={s.id}>{s.title} · {s.shoot_date} · {s.location_name}</p>)}</details>}
  <details className="workplace-history"><summary>წინა გადაღებები · {history.length}</summary>{history.map(s=><p key={s.id}>{s.title} · {s.shoot_date} · {s.location_name}</p>)}{!history.length&&<p>გადაღებების ისტორია ჯერ ცარიელია.</p>}{next&&<button className="action" disabled={busy} onClick={()=>void loadMore()}>მეტი ისტორია</button>}</details>
 </section>
}
