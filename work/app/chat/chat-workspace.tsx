'use client';
import {roleLabel} from '@/lib/department-directory';

import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {MessageCircle,Plus,Users,Settings,X,ArrowLeft,Search,Camera,Check,Pin,Trash2} from 'lucide-react';
import ChatClient from './chat-client';
import {useWorkData,workRequest} from '@/components/cabinet-panel';
import {useChatData} from './use-chat-data';
import {clearChatMemory} from './chat-memory';
import {WORK_MOBILE_QUERY,type WorkChatChrome} from '@/lib/work-mobile';
import './chat-upgrade.css';

type Person={userId:string;name:string;role:string;handle?:string;hasAvatar:boolean;departmentId?:string};
type Conversation={id:string;title:string;type:string;peer:Person|null;unread:number;last:{body:string;kind:string;created:number;author_user_id?:string}|null;settings:{emoji:string;photoId:string|null}};
export type ChatPermissions={canSend:boolean;canAttach:boolean;canCall:boolean;canDirect:boolean;canCreateGroups:boolean;canManageGroups:boolean;canSelectDepartments:boolean;canModerate:boolean};
type Directory={canRestoreTeam?:boolean;people:Person[];conversations:Conversation[];departments:{id:string;name:string}[];permissions:ChatPermissions};
const noPermissions:ChatPermissions={canSend:false,canAttach:false,canCall:false,canDirect:false,canCreateGroups:false,canManageGroups:false,canSelectDepartments:false,canModerate:false};

export async function uploadChatPhoto(file:File,conversationId:string){
 if(!file.type.startsWith('image/'))throw Error('აირჩიე ფოტო');
 if(file.size>25*1024*1024)throw Error('ფოტო ზედმეტად დიდია');
 const bitmap=await createImageBitmap(file),scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 const context=canvas.getContext('2d');if(!context){bitmap.close();throw Error('ფოტო ვერ დამუშავდა')}
 context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('ფოტო ვერ დამუშავდა')),'image/jpeg',0.82));
 const form=new FormData();form.append('file',blob,'photo.jpg');form.append('conversationId',conversationId);
 const r=await fetch('/api/chat/attachments',{method:'POST',body:form}),d=await r.json() as {id:string;error?:string};
 if(!r.ok)throw Error(d.error||'ფოტო ვერ აიტვირთა');return d.id;
}
function PersonAvatar({person}:{person:Person}){return person.hasAvatar?<img alt="" src={'/api/team/avatar?userId='+encodeURIComponent(person.userId)}/>:<span className="work-chat-avatar">{person.name.slice(0,1)}</span>}
function ChatDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close()},[]);
 return <dialog ref={ref} className="hm-chat-dialog" onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section><header><h2>{title}</h2><button type="button" aria-label="დახურვა" onClick={onClose}><X size={20}/></button></header>{children}</section>
 </dialog>;
}
export default function ChatWorkspace({currentUserId,initialId='team',compact=false,startWithList=false}:{currentUserId:string;initialId?:string;compact?:boolean;startWithList?:boolean}){
 const [id,setId]=useState(initialId),[query,setQuery]=useState(''),[modal,setModal]=useState<'new'|'direct'|'group'|'settings'|null>(null),[list,setList]=useState(startWithList),[error,setError]=useState(''),[visible,setVisible]=useState(!compact),[opening,setOpening]=useState<string|null>(null);
 const r=useChatData<Directory>(currentUserId,'/api/chat/conversations',5000,!compact||visible);
 const choseDefault=useRef(!!initialId);
 const c=r.data?.conversations.find(c=>c.id===id),title=c?.title||(id==='team'?'Hungryman · მთავარი ჩატი':'ჩატი'),permissions=r.data?.permissions||noPermissions;
 const open=useCallback((next:string)=>{setId(next);setList(false);setModal(null);if(!compact)history.replaceState(null,'','/chat?conversationId='+encodeURIComponent(next))},[compact]);
 useEffect(()=>{if(compact)return;setId(initialId);setList(startWithList&&window.matchMedia(WORK_MOBILE_QUERY).matches)},[compact,initialId,startWithList]);
 useEffect(()=>{
  if(compact)return;
  const detail:WorkChatChrome={ready:true,conversation:!!id&&!list,canDirect:permissions.canDirect,canCreateGroups:permissions.canCreateGroups};
  const publish=()=>window.dispatchEvent(new CustomEvent('hmw:chat-chrome',{detail}));
  const compose=(event:Event)=>{const kind=(event as CustomEvent<{kind?:string}>).detail?.kind;if(kind==='direct'&&permissions.canDirect){setError('');setModal('direct')}else if(kind==='group'&&permissions.canCreateGroups){setError('');setModal('group')}};
  window.addEventListener('hmw:chat-chrome-request',publish);window.addEventListener('hmw:chat-compose',compose);publish();
  return()=>{window.removeEventListener('hmw:chat-chrome-request',publish);window.removeEventListener('hmw:chat-compose',compose);window.dispatchEvent(new CustomEvent('hmw:chat-chrome',{detail:{ready:false,conversation:false,canDirect:false,canCreateGroups:false}}))};
 },[compact,id,list,permissions.canDirect,permissions.canCreateGroups]);
 // Select an authorized fallback only at entry. A newly created conversation may
 // not be present in the previous directory snapshot yet; never replace it.
 useEffect(()=>{if(id||!r.data||choseDefault.current)return;choseDefault.current=true;const next=r.data.conversations[0]?.id||'';setId(next);if(!next)setList(true)},[r.data,id]);
 useEffect(()=>{const back=()=>{const next=new URLSearchParams(location.search).get('conversationId');setId(next||initialId);if(!compact)setList(!next&&window.matchMedia(WORK_MOBILE_QUERY).matches)};window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back)},[compact,initialId]);
 useEffect(()=>{
  if(!compact){const select=(e:Event)=>{const next=(e as CustomEvent<{conversationId?:string}>).detail?.conversationId;if(next)open(next);else{setList(window.matchMedia(WORK_MOBILE_QUERY).matches);document.querySelector<HTMLInputElement>('.work-chat-sidebar input')?.focus()}};window.addEventListener('hmw:chat-select',select);return()=>window.removeEventListener('hmw:chat-select',select)}
  if(window.parent===window){setVisible(true);return}
  const origin=location.origin;
  const message=(e:MessageEvent)=>{if(e.origin!==origin||e.source!==window.parent||!e.data)return;
   if(e.data.type==='hmw:chat-open'&&typeof e.data.conversationId==='string'&&/^[a-zA-Z0-9_-]{1,180}$/.test(e.data.conversationId)){
    open(e.data.conversationId);if(e.data.focus)requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.hm-chat-composer textarea')?.focus({preventScroll:true}));
   }else if(e.data.type==='hmw:chat-visibility'){
    setVisible(e.data.visible===true);if(!e.data.visible){document.querySelectorAll('audio,video').forEach(a=>(a as HTMLMediaElement).pause());window.dispatchEvent(new Event('hmw:chat-pause'))}
   }
  };
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!document.querySelector('[role="dialog"],dialog[open]'))window.parent.postMessage({type:'hmw:chat-close'},origin)};
  const interaction=()=>window.parent.postMessage({type:'hmw:chat-interaction'},origin);
  window.addEventListener('message',message);window.addEventListener('keydown',key);window.addEventListener('pointerdown',interaction);
  window.parent.postMessage({type:'hmw:chat-ready'},origin);
  return()=>{window.removeEventListener('message',message);window.removeEventListener('keydown',key);window.removeEventListener('pointerdown',interaction)};
 },[compact,open]);
 useEffect(()=>{if(compact&&window.parent!==window)window.parent.postMessage({type:'hmw:chat-thread',conversationId:id,title,reading:visible&&!list&&!modal},location.origin)},[compact,id,title,visible,list,modal]);
 useEffect(()=>{if(compact)return;document.documentElement.dataset.hmChatThread=list||modal?'':id;return()=>{delete document.documentElement.dataset.hmChatThread}},[compact,id,list,modal]);
 useEffect(()=>{if(!compact)return;document.documentElement.classList.add('hm-chat-embed-document');return()=>document.documentElement.classList.remove('hm-chat-embed-document')},[compact]);
 async function deleted(){clearChatMemory(currentUserId,'messages:'+id);setModal(null);setId('');setList(true);await r.refresh();window.dispatchEvent(new Event('hmw:chat-read'))}
 async function restoreTeam(){try{await workRequest('/api/chat/conversations','POST',{restoreTeam:true});await r.refresh();open('team')}catch(e){setError((e as Error).message)}}
 async function person(userId:string){if(opening||!permissions.canDirect)return;setOpening(userId);setError('');try{const d=await workRequest<{id:string}>('/api/chat/conversations','POST',{userId});open(d.id);void r.refresh()}catch(e){setError((e as Error).message)}finally{setOpening(null)}}
 const conversations=[...(r.data?.conversations||[])].sort((a,b)=>a.id==='team'?-1:b.id==='team'?1:(b.last?.created||0)-(a.last?.created||0));
 return <div className={'work-chat-workspace hm-chat-upgrade '+(compact?'compact ':'')+(list?'show-list':'show-conversation')}>
  <aside className="work-chat-sidebar"><header><strong>ჩატები</strong><div className="work-chat-list-actions">{(permissions.canDirect||permissions.canCreateGroups)&&<button aria-label="ახალი საუბარი" title="ახალი საუბარი" onClick={()=>setModal('new')}><Plus size={19}/></button>}{compact&&<button aria-label="საუბარზე დაბრუნება" onClick={()=>setList(false)}><X size={18}/></button>}</div></header>
   <div className="hm-chat-search"><Search size={16}/><input aria-label="ჩატის ძებნა" placeholder="მოძებნე ადამიანი ან საუბარი" value={query} onChange={e=>setQuery(e.target.value)}/></div>
   {r.data&&!r.data.conversations.length&&<p className="hm-chat-list-help">საუბრები ჯერ არ არის.{permissions.canDirect?' ახალი საუბრისთვის დააჭირე +.':''}</p>}
   {r.data?.canRestoreTeam&&<button className="hm-chat-restore" onClick={()=>void restoreTeam()}><Plus size={16}/> მთავარი ჩატის ხელახლა შექმნა</button>}<div className="work-chat-list">{conversations.filter(c=>c.id==='team'||c.title.toLowerCase().includes(query.toLowerCase())).map(c=><button key={c.id} onClick={()=>open(c.id)} className={(id===c.id?'active ':'')+(c.id==='team'?'hm-main-conversation':'')} aria-current={id===c.id?'true':undefined}>{c.settings.photoId?<img alt="" src={'/api/chat/attachments?id='+c.settings.photoId}/>:c.peer?<PersonAvatar person={c.peer}/>:<span className="work-chat-avatar"><Users size={19}/></span>}<span><b>{c.id==='team'?'Hungryman · მთავარი':c.title}</b>{c.last&&<time className="hm-chat-preview-time" dateTime={new Date(c.last.created).toISOString()}>{new Date(c.last.created).toLocaleTimeString('ka-GE',{hour:'2-digit',minute:'2-digit'})}</time>}<small>{c.last?.author_user_id===currentUserId&&'შენ: '}{c.last?.body||(c.last?(c.last.kind==='audio'?'🎤 ხმოვანი შეტყობინება':'📷 ფოტო'):'დაიწყე საუბარი')}</small></span>{c.unread>0?<em>{c.unread>99?'99+':c.unread}</em>:c.id==='team'?<Pin size={13}/>:null}</button>)}{query.trim()&&permissions.canDirect&&<><p className="hm-chat-list-help">გუნდის წევრები</p>{(r.data?.people||[]).filter(p=>(p.name+' '+p.role).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0,40).map(p=><button key={'person:'+p.userId} disabled={!!opening} onClick={()=>void person(p.userId)}><PersonAvatar person={p}/><span><b>{p.name}</b><small>{opening===p.userId?'იხსნება…':roleLabel(p.role)}</small></span><MessageCircle size={19}/></button>)}</>}</div>{(error||r.error)&&<p className="hm-chat-inline-error" role="alert">{error||r.error}</p>}
  </aside>
  <div className="work-chat-content">
   {!compact&&<div className="work-chat-toolbar"><button onClick={()=>setList(!list)} aria-label="ჩატების სია"><ArrowLeft size={18}/>ჩატები</button><button aria-label="ჩატის პარამეტრები" disabled={!c} onClick={()=>setModal('settings')}><Settings size={18}/></button></div>}
   {id?<ChatClient key={currentUserId+':'+id} currentUserId={currentUserId} conversationId={id} title={title} photoId={c?.settings.photoId} compact={compact} active={(!compact||visible)&&!list&&!modal} permissions={permissions} onOpenPerson={userId=>void person(userId)} onShowList={()=>setList(true)} onSettings={()=>setModal('settings')}/>:<p className="hm-chat-list-help">აირჩიე საუბარი სიიდან</p>}
  </div>
  {(modal==='new'||modal==='direct')&&<NewConversation directOnly={modal==='direct'} people={r.data?.people||[]} permissions={permissions} opening={opening} onPerson={userId=>void person(userId)} onGroup={()=>setModal('group')} onClose={()=>setModal(null)} error={error}/>}
  {(modal==='group'||modal==='settings')&&<GroupDialog key={modal==='settings'?id:'new'} id={modal==='settings'?id:undefined} conversation={modal==='settings'?c:undefined} people={r.data?.people||[]} departments={r.data?.departments||[]} permissions={permissions} onClose={()=>setModal(null)} onDeleted={deleted} onSaved={async next=>{open(next);await r.refresh()}}/>}
 </div>;
}
function NewConversation({people,permissions,opening,onPerson,onGroup,onClose,error,directOnly=false}:{people:Person[];permissions:ChatPermissions;opening:string|null;onPerson:(id:string)=>void;onGroup:()=>void;onClose:()=>void;error:string;directOnly?:boolean}){
 const [query,setQuery]=useState('');const results=query.trim()?people.filter(p=>(p.name+' '+p.role+' '+(p.handle||'')).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())):[];
 return <ChatDialog title={directOnly?'ახალი პირადი ჩატი':'ახალი საუბარი'} onClose={onClose}>{!directOnly&&permissions.canCreateGroups&&<button className="hm-new-group" onClick={onGroup}><Users size={18}/> ახალი ჯგუფი <Plus size={16}/></button>}{permissions.canDirect&&<><label className="hm-chat-field">თანამშრომლის მოძებნა<input autoFocus type="search" placeholder="სახელი ან პოზიცია" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="hm-person-results">{results.map(p=><button key={p.userId} onClick={()=>onPerson(p.userId)} disabled={!!opening}><PersonAvatar person={p}/><span><b>{p.name}</b><small>{roleLabel(p.role)}</small></span>{opening===p.userId?'…':<MessageCircle size={17}/>}</button>)}<p>{query.trim()&&!results.length?'თანამშრომელი ვერ მოიძებნა.':!query.trim()?'ჩაწერე სახელი და აირჩიე თანამშრომელი.':''}</p></div></>}{error&&<p role="alert" className="hm-chat-inline-error">{error}</p>}</ChatDialog>;
}
function GroupDialog({id,conversation,people,departments,permissions,onClose,onSaved,onDeleted}:{id?:string;conversation?:Conversation;people:Person[];departments:{id:string;name:string}[];permissions:ChatPermissions;onClose:()=>void;onSaved:(id:string)=>Promise<void>;onDeleted:()=>Promise<void>}){
 const [createdId,setCreatedId]=useState(id),[title,setTitle]=useState(conversation?.title||''),[ids,setIds]=useState<string[]>([]),[departmentIds,setDepartmentIds]=useState<string[]>([]),[query,setQuery]=useState(''),[photo,setPhoto]=useState<File|null>(null),[emoji,setEmoji]=useState(conversation?.settings.emoji||'❤️'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const members=useWorkData<{members:Person[];permissions:{canDelete:boolean}}>('/api/chat/conversations?id='+encodeURIComponent(id||'team'));
 const groupEditable=(!id&&permissions.canCreateGroups)||(!!id?.startsWith('grp_')&&permissions.canManageGroups),settingsEditable=permissions.canManageGroups,photoEditable=settingsEditable&&permissions.canAttach;
 const selectable=people.filter(p=>!ids.includes(p.userId)&&(!id||!members.data?.members.some(m=>m.userId===p.userId))),results=query.trim()?selectable.filter(p=>(p.name+' '+p.role).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0,12):[];
 async function remove(){if(!id||busy||!members.data?.permissions.canDelete)return;const description=id.startsWith('dm_')?'წარსული შეტყობინებები მხოლოდ შენთან წაიშლება. მეორე მონაწილეს დარჩება. ახალი შეტყობინება საუბარს ხელახლა გამოაჩენს.':'ეს ჩატი, მისი შეტყობინებები და ფაილები ყველა მონაწილესთან წაიშლება.';if(!window.confirm(description))return;setBusy(true);setError('');try{await workRequest('/api/chat/conversations','DELETE',{id});await onDeleted()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function save(){if(busy)return;setBusy(true);setError('');try{let next=createdId;if(!next){next=(await workRequest<{id:string}>('/api/chat/conversations','POST',{title,memberIds:ids,departmentIds})).id;setCreatedId(next)}else if(next.startsWith('grp_')&&groupEditable)await workRequest('/api/chat/conversations','PATCH',{id:next,title,memberIds:ids,departmentIds});if(settingsEditable){let photoId:string|undefined;if(photo&&photoEditable)photoId=await uploadChatPhoto(photo,next);await workRequest('/api/chat/settings','PATCH',{conversationId:next,emoji,...(photoId?{photoId}: {})})}await onSaved(next)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <ChatDialog title={id?'ჩატის პარამეტრები':'ახალი ჯგუფი'} onClose={()=>{if(!busy)onClose()}}>
  <div className="hm-group-summary"><label className={'hm-group-photo '+(!photoEditable?'is-disabled':'')} title="ჩატის ფოტოს შეცვლა">{conversation?.settings.photoId?<img alt="" src={'/api/chat/attachments?id='+conversation.settings.photoId}/>:<Camera size={22}/>}<input type="file" accept="image/*" aria-label="ჩატის ფოტოს შეცვლა" disabled={!photoEditable} onChange={e=>setPhoto(e.target.files?.[0]||null)}/></label><span><b>{photo?photo.name:conversation?.title||'ახალი ჯგუფი'}</b><small>{photo?'ფოტო მზადაა ასატვირთად':photoEditable?'ფოტოს შესაცვლელად დააჭირე კამერას':'ჩატის ფოტო'}</small></span>{photo&&<button aria-label="ფოტოს მოხსნა" onClick={()=>setPhoto(null)}><X size={16}/></button>}</div>
  {groupEditable&&<label className="hm-chat-field">ჯგუფის სახელი<input autoFocus maxLength={80} value={title} onChange={e=>setTitle(e.target.value)}/></label>}
  {settingsEditable&&<div className="hm-group-emoji"><span>მთავარი ემოჯი</span><div>{['❤️','😂','👍','😮','😢','🙌','🔥','👏','😍','🎉','💪','✅'].map(e=><button key={e} aria-label={e} aria-pressed={emoji===e} onClick={()=>setEmoji(e)}>{e}</button>)}</div></div>}
  {id&&<details className="hm-group-members"><summary>{members.data?.members.length||0} მონაწილე</summary><div>{members.data?.members.map(p=><span key={p.userId}>{p.name}<small>{roleLabel(p.role)}</small></span>)}</div></details>}
  {groupEditable&&<><label className="hm-chat-field">მონაწილეების დამატება<input type="search" placeholder="მოძებნე თანამშრომელი" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <div className="hm-selected-members">{ids.map(userId=>{const p=people.find(p=>p.userId===userId);return <button key={userId} onClick={()=>setIds(ids.filter(i=>i!==userId))} aria-label={(p?.name||'მონაწილის')+' მოხსნა'}>{p?.name}<X size={13}/></button>})}{departmentIds.map(departmentId=><button key={departmentId} onClick={()=>setDepartmentIds(departmentIds.filter(d=>d!==departmentId))}><Users size={13}/>{departments.find(d=>d.id===departmentId)?.name}<X size={13}/></button>)}</div>
   {!!query.trim()&&<div className="hm-person-results">{results.map(p=><button key={p.userId} onClick={()=>{setIds([...ids,p.userId]);setQuery('')}}><PersonAvatar person={p}/><span><b>{p.name}</b><small>{roleLabel(p.role)}</small></span><Plus size={17}/></button>)}{!results.length&&<p>თანამშრომელი ვერ მოიძებნა.</p>}</div>}
   {permissions.canSelectDepartments&&departments.length>0&&<details className="hm-group-departments"><summary><Users size={16}/> მთელი დეპარტამენტი</summary><p>დაემატება დეპარტამენტის ყველა ამჟამად აქტიური თანამშრომელი.</p><div>{departments.map(d=><button key={d.id} aria-pressed={departmentIds.includes(d.id)} onClick={()=>setDepartmentIds(departmentIds.includes(d.id)?departmentIds.filter(x=>x!==d.id):[...departmentIds,d.id])}>{d.name}{departmentIds.includes(d.id)?<Check size={15}/>:<Plus size={15}/>}</button>)}</div></details>}
  </>}
  {error&&<p role="alert" className="hm-chat-inline-error">{error}</p>}
  {(groupEditable||settingsEditable)&&<button className="hm-chat-save" disabled={busy||!id&&(!title.trim()||!ids.length&&!departmentIds.length)} onClick={()=>void save()}>{busy?'ინახება…':id?'შენახვა':'ჯგუფის შექმნა'}</button>}
  {id&&members.data?.permissions.canDelete&&<button className="hm-chat-delete" disabled={busy} onClick={()=>void remove()}><Trash2 size={16}/>{id.startsWith('dm_')?'ჩატის წაშლა მხოლოდ ჩემთან':'ჩატის წაშლა ყველასთვის'}</button>}
 </ChatDialog>;
}
