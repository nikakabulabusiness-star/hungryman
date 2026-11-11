'use client';
import {roleLabel} from '@/lib/department-directory';
import {startBrowserCall} from '@/lib/browser-call';


import type {ChatPermissions} from './chat-workspace';
import {useChatData} from './use-chat-data';
import {clearChatMemory,readChatMemory,writeChatMemory} from './chat-memory';
import {VoiceRecorder} from '@/components/voice-recorder';
import {ChatMute} from '@/components/chat-mute';
import {PhotoViewer} from '@/components/photo-viewer';
import {Phone,Video,ArrowLeft,Settings,Plus,CalendarDays,ExternalLink,MapPin,Pin,PinOff,Send,Users,X,Smile,ImagePlus,MoreHorizontal} from 'lucide-react';
import {Fragment,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Avatar,AvatarFallback,AvatarImage} from '@/components/ui/avatar';

type ChatMessage={
 id:string;
 authorUserId:string;
 authorName:string;
 authorRole:string;
 body:string;
 kind:'message'|'shoot'|'image'|'audio';
 attachmentId?:string|null;durationMs?:number|null;
 referenceId:string|null;
 created:number;
 pinned:boolean;
 pinnedAt:number|null;
 delivery?:'sending'|'failed';
 reactions?:{emoji:string;count:number;mine:boolean}[];
};

type StaffPerson={userId:string;name:string;role:string;avatarUrl:string|null;active:boolean};

const MAX_BODY_LENGTH=4000;
const URL_PATTERN=/(https?:\/\/[^\s<>]+)/gi;
const TBILISI_TIME_ZONE='Asia/Tbilisi';
const DAY_MS=24*60*60*1000;

const dateKeyFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:TBILISI_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'});
const messageTimeFormatter=new Intl.DateTimeFormat('ka-GE',{timeZone:TBILISI_TIME_ZONE,hour:'2-digit',minute:'2-digit'});
const messageDateFormatter=new Intl.DateTimeFormat('ka-GE',{timeZone:TBILISI_TIME_ZONE,day:'numeric',month:'long'});
const messageDateYearFormatter=new Intl.DateTimeFormat('ka-GE',{timeZone:TBILISI_TIME_ZONE,day:'numeric',month:'long',year:'numeric'});

function initials(name:string){
 const value=name.trim().split(/\s+/).map(part=>part[0]).join('').slice(0,2);
 return value.toLocaleUpperCase('ka-GE')||'HM';
}

function messageTime(value:number){
 try{return messageTimeFormatter.format(new Date(value));}
 catch{return new Date(value).toLocaleString();}
}

function dateKey(value:number){
 try{
  const parts=dateKeyFormatter.formatToParts(new Date(value));
  const year=parts.find(part=>part.type==='year')?.value,month=parts.find(part=>part.type==='month')?.value,day=parts.find(part=>part.type==='day')?.value;
  if(year&&month&&day)return `${year}-${month}-${day}`;
 }
 catch{return new Date(value).toISOString().slice(0,10);}
 return new Date(value).toISOString().slice(0,10);
}

function messageDayLabel(value:number){
 const today=dateKey(Date.now());
 const todayStart=Date.parse(`${today}T00:00:00+04:00`);
 const target=dateKey(value);
 if(target===today)return 'დღეს';
 if(target===dateKey(todayStart-DAY_MS))return 'გუშინ';
 try{return target.slice(0,4)===today.slice(0,4)?messageDateFormatter.format(new Date(value)):messageDateYearFormatter.format(new Date(value));}
 catch{return target;}
}

function cleanUrlToken(value:string){
 let url=value,trailing='';
 while(/[.,!?;:)\]}]$/.test(url)){trailing=url.slice(-1)+trailing;url=url.slice(0,-1)}
 try{const parsed=new URL(url);if(parsed.protocol!=='http:'&&parsed.protocol!=='https:')return null;return {url:parsed.toString(),label:url,trailing,isMap:/^(maps\.)?google\./i.test(parsed.hostname)||parsed.hostname==='goo.gl'&&parsed.pathname.startsWith('/maps')||parsed.pathname.startsWith('/maps')};}catch{return null}
}

function LinkifiedText({text}:{text:string}){
 return <>{text.split(URL_PATTERN).map((part,index)=>{
  if(index%2===0)return <Fragment key={index}>{part}</Fragment>;
  const parsed=cleanUrlToken(part);
  if(!parsed)return <Fragment key={index}>{part}</Fragment>;
  return <Fragment key={index}><a className="font-semibold text-sky-300 underline decoration-sky-300/50 underline-offset-2 hover:text-sky-200" href={parsed.url} target="_blank" rel="noopener noreferrer">{parsed.isMap?<><MapPin className="mr-1 inline size-3.5"/>Google Maps</>:parsed.label}<ExternalLink className="ml-1 inline size-3"/></a>{parsed.trailing}</Fragment>;
 })}</>;
}

function AvatarView({person,name,small=false}:{person?:StaffPerson;name:string;small?:boolean}){
 return <Avatar className={`${small?'size-8':'size-9'} border border-sky-300/20 bg-[#123b5a]`}>
  {person?.avatarUrl?<AvatarImage src={person.avatarUrl} alt={name}/>:null}
  <AvatarFallback className="bg-[#123b5a] text-xs font-bold text-sky-100">{initials(name)}</AvatarFallback>
 </Avatar>;
}

function ParticipantPanel({people,currentUserId,canDirect,onPerson,onClose}:{people:StaffPerson[];currentUserId:string;canDirect:boolean;onPerson:(userId:string)=>void;onClose:()=>void}){
 const ordered=[...people].sort((a,b)=>Number(b.active)-Number(a.active)||a.name.localeCompare(b.name,'ka'));
 const active=ordered.filter(person=>person.active).length;
 return <><button type="button" className="hm-chat-people-backdrop" aria-label="მონაწილეების დახურვა" onClick={onClose}/><aside className="hm-chat-people-panel" aria-label="ჩატის მონაწილეები"><header><div><strong>გუნდის წევრები</strong><small>{active} აქტიურია</small></div><button type="button" onClick={onClose} aria-label="დახურვა"><X/></button></header><div className="hm-chat-people-list">{ordered.map(person=><button type="button" key={person.userId} className="hm-chat-person" disabled={!canDirect||person.userId===currentUserId} onClick={()=>{onClose();onPerson(person.userId)}}><span className="relative shrink-0"><AvatarView person={person} name={person.name}/><i className={person.active?'online':'offline'}/></span><span className="min-w-0"><b>{person.name}</b><small>{roleLabel(person.role)}</small></span></button>)}</div></aside></>;
}

export default function ChatClient({currentUserId,compact=false,conversationId='team',title='Hungryman გუნდი',photoId,active=true,permissions,onOpenPerson,onShowList,onSettings}:{currentUserId:string;compact?:boolean;conversationId?:string;title?:string;photoId?:string|null;active?:boolean;permissions:ChatPermissions;onOpenPerson:(userId:string)=>void;onShowList?:()=>void;onSettings?:()=>void}){
 const cachePath='messages:'+conversationId;
 const [snapshot]=useState(()=>readChatMemory<{messages:ChatMessage[];pinned:ChatMessage[];revision:string;cursor:{created:number;id:string}|null}>(currentUserId,cachePath));
 const [messages,setMessages]=useState<ChatMessage[]>(snapshot?.messages||[]);
 const [pinned,setPinned]=useState<ChatMessage[]>(snapshot?.pinned||[]);
 const [people,setPeople]=useState<StaffPerson[]>([]);
 const [body,setBody]=useState(''),[emojiOpen,setEmojiOpen]=useState(false),[uploading,setUploading]=useState(false);
 const [photo,setPhoto]=useState<string|null>(null),[toolsOpen,setToolsOpen]=useState(false);
 const [stagedPhotos,setStagedPhotos]=useState<{id:string;file:File;url:string}[]>([]),stagedRef=useRef(stagedPhotos);stagedRef.current=stagedPhotos;
 const holdTimer=useRef<ReturnType<typeof setTimeout>|null>(null),holdPoint=useRef<{x:number;y:number}|null>(null),pollController=useRef<AbortController|null>(null),mountedRef=useRef(true),sendingMedia=useRef(false);
 function cancelHold(){if(holdTimer.current){clearTimeout(holdTimer.current);holdTimer.current=null}holdPoint.current=null}
 function stagePhotos(files:File[]){if(!permissions.canAttach||sendingMedia.current)return;const valid=files.filter(f=>f.type.startsWith('image/'));if(!valid.length)return;if(valid.some(f=>f.size>25*1024*1024)){setError('თითოეული ფოტო უნდა იყოს 25 MB-მდე.');return}const space=Math.max(0,4-stagedRef.current.length);if(valid.length>space)setError('ერთდროულად მაქსიმუმ 4 ფოტო აირჩიე.');setStagedPhotos(old=>[...old,...valid.slice(0,space).map(file=>({id:crypto.randomUUID(),file,url:URL.createObjectURL(file)}))]);setToolsOpen(false);setEmojiOpen(false)}
 function removeStaged(id:string){const photo=stagedRef.current.find(p=>p.id===id);if(photo)URL.revokeObjectURL(photo.url);setStagedPhotos(old=>old.filter(p=>p.id!==id))}
 async function submit(){if(!permissions.canSend||sendingMedia.current)return;if(!stagedRef.current.length){void sendMessage();return}sendingMedia.current=true;setUploading(true);setError('');let caption=body.trim();setBody('');if(window.matchMedia('(pointer:coarse)').matches)inputRef.current?.blur();try{const {uploadChatPhoto}=await import('./chat-workspace');for(const photo of [...stagedRef.current]){const attachmentId=await uploadChatPhoto(photo.file,conversationId);void sendMessage(caption,attachmentId,undefined,'image');caption='';removeStaged(photo.id)}}catch(e){setBody(current=>current||caption);setError((e as Error).message)}finally{sendingMedia.current=false;setUploading(false)}}
 const photoTriggerRef=useRef<HTMLButtonElement|null>(null),activeRef=useRef(active);activeRef.current=active;
 const inputRef=useRef<HTMLTextAreaElement>(null),memberData=useChatData<{members:{userId:string;name:string;role:string;handle:string}[]}>(currentUserId,'/api/chat/conversations?id='+encodeURIComponent(conversationId),30000,active);
 const mentionQuery=body.match(/(?:^|\s)@([^\s]*)$/u)?.[1],mentionOptions=mentionQuery===undefined?[]:[{handle:'everyone',name:'ყველა წევრი'},{handle:'სცენარი',name:'სცენარისტები'},...[...new Set((memberData.data?.members||[]).map(p=>p.role))].map(role=>({handle:role.replace(/\s+/g,'_'),name:role})),...(memberData.data?.members||[]).map(p=>({handle:p.handle,name:p.name}))].filter(p=>(p.handle+' '+p.name).toLowerCase().includes(mentionQuery.toLowerCase())).slice(0,8);
 function insertMention(handle:string){setBody(text=>text.replace(/@[^\s]*$/u,'@'+handle+' '));inputRef.current?.focus()}
 const [loading,setLoading]=useState(!snapshot);
 const [reactionId,setReactionId]=useState<string|null>(null);
 const [pinningId,setPinningId]=useState<string|null>(null);
 const [participantsOpen,setParticipantsOpen]=useState(false);
 const [error,setError]=useState(''),[startingCall,setStartingCall]=useState(false);
 const revisionRef=useRef(snapshot?.revision||''),initialSync=useRef(false),lastRead=useRef(0),accessRevoked=useRef(false),pollFailures=useRef(0);
 const messagesBusy=useRef(false),presenceBusy=useRef(false),endRef=useRef<HTMLDivElement>(null),scrollerRef=useRef<HTMLDivElement>(null),stickToBottom=useRef(true),cursorRef=useRef<{created:number;id:string}|null>(snapshot?.cursor||null);

 const peopleById=useMemo(()=>new Map(people.map(person=>[person.userId,person])),[people]);
 const activePeople=useMemo(()=>people.filter(person=>person.active&&memberData.data?.members.some(m=>m.userId===person.userId)),[people,memberData.data]);
 const latestMessageId=messages[messages.length-1]?.id;

 const loadMessages=useCallback(async(silent=false)=>{
  if(!activeRef.current||document.visibilityState==='hidden'||messagesBusy.current)return;messagesBusy.current=true;let timeout:ReturnType<typeof setTimeout>|undefined;
  try{
   const cursor=cursorRef.current,query=cursor?`&afterCreated=${cursor.created}&afterId=${encodeURIComponent(cursor.id)}${initialSync.current?'&wait=1':''}&revision=${encodeURIComponent(revisionRef.current)}`:'';
   const controller=new AbortController();pollController.current=controller;timeout=setTimeout(()=>controller.abort(),15000);
   const response=await fetch(`/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}${query}`,{cache:'no-store',signal:controller.signal});
   const result=await response.json() as {historyStart?:number;messages?:ChatMessage[];pinned?:ChatMessage[];error?:string;revision?:string;reactionScope?:string[];reactionState?:{message_id:string;emoji:string;count:number;mine:number}[]};
   if(!response.ok){if([401,403,404].includes(response.status)){accessRevoked.current=true;clearChatMemory(currentUserId);setMessages([]);setPinned([]);cursorRef.current=null}throw new Error(result.error||'ჩატი ვერ ჩაიტვირთა.')}
   if(!mountedRef.current||!activeRef.current)return;
   initialSync.current=true;accessRevoked.current=false;pollFailures.current=0;revisionRef.current=result.revision||'';
   const incoming=result.messages||[],nextPinned=result.pinned||[];
   if(incoming.length){const last=incoming[incoming.length-1];cursorRef.current={created:last.created,id:last.id}}
   setMessages(current=>{
    const combined=new Map<string,ChatMessage>();
    for(const message of [...current.filter(m=>m.created>(result.historyStart||0)),...incoming,...nextPinned])combined.set(message.id,message);
    const pinnedIds=new Set(nextPinned.map(message=>message.id));
    const next=[...combined.values()].map(message=>({...message,pinned:pinnedIds.has(message.id),reactions:result.reactionScope?.includes(message.id)?(result.reactionState||[]).filter(r=>r.message_id===message.id).map(r=>({emoji:r.emoji,count:r.count,mine:!!r.mine})):message.reactions})).sort((a,b)=>a.created-b.created||a.id.localeCompare(b.id)).slice(-200);return JSON.stringify(next)===JSON.stringify(current)?current:next;
   });
   if(activeRef.current&&document.visibilityState==='visible'&&stickToBottom.current&&cursorRef.current&&cursorRef.current.created>lastRead.current){lastRead.current=cursorRef.current.created;void fetch('/api/chat/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId,readAt:cursorRef.current.created})}).then(r=>{if(!r.ok){lastRead.current=0;return}if(window.parent!==window)window.parent.postMessage({type:'hmw:chat-read',conversationId},location.origin);else window.dispatchEvent(new Event('hmw:chat-read'))}).catch(()=>{lastRead.current=0});}
   setPinned(old=>JSON.stringify(old)===JSON.stringify(nextPinned)?old:nextPinned);if(!silent)setError('');
  }catch(value){if(!(value instanceof DOMException&&value.name==='AbortError'))pollFailures.current++;if(mountedRef.current&&!silent&&!(value instanceof DOMException&&value.name==='AbortError'))setError(value instanceof Error?value.message:'ჩატი ვერ ჩაიტვირთა.')}finally{clearTimeout(timeout);messagesBusy.current=false;if(mountedRef.current)setLoading(false)}
 },[conversationId,currentUserId]);

 const loadPresence=useCallback(async(silent=false)=>{
  if(!activeRef.current||document.visibilityState==='hidden'||presenceBusy.current)return;presenceBusy.current=true;
  try{
   void fetch('/api/chat/presence',{method:'POST'}).catch(()=>{});
   const response=await fetch('/api/chat/presence',{cache:'no-store'});
   const result=await response.json() as {people?:StaffPerson[];error?:string};
   if(!response.ok)throw new Error(result.error||'აქტიური გუნდი ვერ ჩაიტვირთა.');
   if(mountedRef.current)setPeople(result.people||[]);
  }catch(value){if(!silent)setError(value instanceof Error?value.message:'აქტიური გუნდი ვერ ჩაიტვირთა.')}finally{presenceBusy.current=false}
 },[]);

 useEffect(()=>{
  mountedRef.current=true;activeRef.current=active;let cancelled=false,messagesTimer:ReturnType<typeof setTimeout>;
  const tick=async()=>{if(cancelled)return;await loadMessages(initialSync.current);if(!cancelled)messagesTimer=setTimeout(tick,!activeRef.current||document.visibilityState==='hidden'?2000:pollFailures.current?Math.min(15000,1000*2**Math.min(pollFailures.current,4)):cursorRef.current?100:2000)};
  void tick();void loadPresence(true);
  const presenceTimer=window.setInterval(()=>void loadPresence(true),15000);
  const onVisibility=()=>{if(document.visibilityState==='visible'){void loadMessages(true);void loadPresence(true)}else pollController.current?.abort()};
  document.addEventListener('visibilitychange',onVisibility);
  return()=>{cancelled=true;mountedRef.current=false;activeRef.current=false;pollController.current?.abort();cancelHold();clearTimeout(messagesTimer);window.clearInterval(presenceTimer);document.removeEventListener('visibilitychange',onVisibility)};
 },[loadMessages,loadPresence]);

 useEffect(()=>{if(active){void loadMessages(true);void loadPresence(true);if(stickToBottom.current&&scrollerRef.current)scrollerRef.current.scrollTop=scrollerRef.current.scrollHeight}else{pollController.current?.abort();setReactionId(null);setEmojiOpen(false);setToolsOpen(false);setParticipantsOpen(false)}},[active,loadMessages,loadPresence]);
 useEffect(()=>{if(stickToBottom.current&&scrollerRef.current)scrollerRef.current.scrollTop=scrollerRef.current.scrollHeight},[latestMessageId]);
 useEffect(()=>{if(initialSync.current&&!accessRevoked.current)writeChatMemory(currentUserId,cachePath,{messages:messages.filter(m=>!m.delivery),pinned,revision:revisionRef.current,cursor:cursorRef.current})},[messages,pinned,currentUserId,cachePath,loading]);
 useEffect(()=>()=>{stagedRef.current.forEach(p=>URL.revokeObjectURL(p.url))},[]);
 useEffect(()=>{const dismiss=(e:KeyboardEvent)=>{if(e.key==='Escape'){setReactionId(null);setEmojiOpen(false);setToolsOpen(false);setParticipantsOpen(false)}};window.addEventListener('keydown',dismiss);return()=>window.removeEventListener('keydown',dismiss)},[]);
 useEffect(()=>{const closed=(e:MessageEvent)=>{if(e.origin===location.origin&&e.source===window.parent&&e.data?.type==='hmw:photo-closed')photoTriggerRef.current?.focus({preventScroll:true})};window.addEventListener('message',closed);return()=>window.removeEventListener('message',closed)},[]);
 function openPhoto(id:string,button:HTMLButtonElement){photoTriggerRef.current=button;if(compact&&window.parent!==window)window.parent.postMessage({type:'hmw:chat-photo',attachmentId:id},location.origin);else setPhoto(id)}

 async function deliver(message:ChatMessage){setMessages(old=>[...old.filter(m=>m.id!==message.id),{...message,delivery:'sending' as const}].sort((a,b)=>a.created-b.created));try{const response=await fetch('/api/chat/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:message.id,body:message.body,conversationId,attachmentId:message.attachmentId})}),result=await response.json() as {message?:ChatMessage;error?:string};if(!response.ok||!result.message)throw Error(result.error||'შეტყობინება ვერ გაიგზავნა.');setMessages(old=>old.map(m=>m.id===message.id?result.message!:m))}catch(e){setMessages(old=>old.map(m=>m.id===message.id?{...m,delivery:'failed'}:m));setError((e as Error).message)}}
 async function sendMessage(override?:string,attachmentId?:string,durationMs?:number,attachmentKind:'image'|'audio'='audio'){if(!permissions.canSend)return;const text=override??body.trim();if(!text&&!attachmentId)return;if(override===undefined)setBody('');setError('');setToolsOpen(false);setEmojiOpen(false);if(window.matchMedia('(pointer:coarse)').matches)inputRef.current?.blur();stickToBottom.current=true;const person=peopleById.get(currentUserId);void deliver({id:crypto.randomUUID(),authorUserId:currentUserId,authorName:person?.name||'მე',authorRole:person?.role||'',body:text,kind:attachmentId?attachmentKind:'message',attachmentId,durationMs,referenceId:null,created:Date.now(),pinned:false,pinnedAt:null})}
 async function react(message:ChatMessage,emoji:string){if(!permissions.canSend)return;setReactionId(null);const previous=message.reactions||[];setMessages(old=>old.map(m=>m.id!==message.id?m:{...m,reactions:previous.map(r=>({...r,count:r.count-(r.mine?1:0),mine:false})).filter(r=>r.count>0).reduce<{emoji:string;count:number;mine:boolean}[]>((rows,r)=>[...rows,r],[]).concat(previous.some(r=>r.emoji===emoji&&r.mine)?[]:[{emoji,count:1,mine:true}]).reduce<{emoji:string;count:number;mine:boolean}[]>((rows,r)=>{const found=rows.find(x=>x.emoji===r.emoji);if(found){found.count+=r.count;found.mine||=r.mine}else rows.push({...r});return rows},[])}));try{const r=await fetch(`/api/chat/messages/${message.id}/reaction`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({emoji})});if(!r.ok)throw Error('რეაქცია ვერ შეინახა.')}catch(e){setMessages(old=>old.map(m=>m.id===message.id?{...m,reactions:previous}:m));setError((e as Error).message)}}
 function shareLocation(){if(!permissions.canSend)return;navigator.geolocation.getCurrentPosition(p=>{void sendMessage(`📍 ჩემი მდებარეობა\nhttps://www.google.com/maps/search/?api=1&query=${p.coords.latitude},${p.coords.longitude}`)},()=>setError('ლოკაციის გაზიარებისთვის დაუშვი მდებარეობაზე წვდომა.'),{enableHighAccuracy:true,timeout:15000})}
 async function togglePin(message:ChatMessage){
  if(pinningId||!permissions.canModerate)return;setPinningId(message.id);setError('');
  try{
   const response=await fetch(`/api/chat/messages/${encodeURIComponent(message.id)}/pin`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({pinned:!message.pinned})});
   const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||'პინი ვერ განახლდა.');
   await loadMessages(true);
  }catch(value){setError(value instanceof Error?value.message:'პინი ვერ განახლდა.')}finally{setPinningId(null)}
 }

 async function beginCall(mode:'audio'|'video'){if(startingCall)return;setStartingCall(true);setError('');try{await startBrowserCall({conversationId,mode},compact)}catch(e){setError(e instanceof Error?e.message:'ზარი ვერ მომზადდა.')}finally{setStartingCall(false)}}

 const chat=<section className={`hm-chat-shell staff-chat-ui ${compact?'is-compact':''}`}>
  <header className="hm-chat-head shrink-0 border-b border-sky-300/15 bg-[#082238]">{onShowList&&<button className={"hm-chat-small-button "+(!compact?"hm-chat-mobile-control":"")} type="button" aria-label="ჩატების სია" title="ჩატები" onClick={onShowList}><ArrowLeft/></button>}<button type="button" className="hm-chat-identity" onClick={()=>{setToolsOpen(false);setEmojiOpen(false);setReactionId(null);setParticipantsOpen(true)}} aria-label="გუნდის წევრების ნახვა"><span className="hm-chat-group-avatar">{photoId?<img alt="" src={'/api/chat/attachments?id='+encodeURIComponent(photoId)} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}/>:<Users/>}{activePeople.length>0?<i/>:null}</span><span><strong>{title}</strong><small>{activePeople.length?`${activePeople.length} აქტიურია`:'ამჟამად არავინაა აქტიური'}</small></span></button>{permissions.canCall&&(['audio','video'] as const).map(mode=><button key={mode} className="hm-chat-small-button" type="button" aria-label={mode==='audio'?'აუდიოზარი':'ვიდეოზარი'} disabled={startingCall} onClick={()=>void beginCall(mode)}>{mode==='audio'?<Phone size={18}/>:<Video size={18}/>}</button>)}<ChatMute conversationId={conversationId} compact={compact}/>{!compact&&<button className="hm-chat-small-button hm-chat-mobile-control" type="button" aria-label="ჩატის პარამეტრები" onClick={onSettings}><Settings/></button>}{compact?<button className="hm-chat-small-button" type="button" aria-label="ჩატის პარამეტრები" title="პარამეტრები" onClick={onSettings}><Settings/></button>:<button type="button" className="hm-chat-people-button" onClick={()=>{setToolsOpen(false);setEmojiOpen(false);setReactionId(null);setParticipantsOpen(true)}} aria-label="ჩატის მონაწილეები" aria-expanded={participantsOpen}><Users/><span>{memberData.data?.members.length||0}</span></button>}</header>
  {startingCall&&<p role="status" className="hm-chat-uploading">ზარი მზადდება…</p>}
  {pinned.length?<div className="hm-chat-pinned" aria-label="მიმაგრებული შეტყობინებები">{pinned.map(message=><button key={message.id} type="button" onClick={()=>document.getElementById(`chat-message-${message.id}`)?.scrollIntoView({behavior:'smooth',block:'center'})}><Pin/><span><b>{message.authorName}:</b> {message.body}</span></button>)}</div>:null}
  {participantsOpen?<ParticipantPanel people={people.filter(p=>memberData.data?.members.some(m=>m.userId===p.userId))} currentUserId={currentUserId} canDirect={permissions.canDirect} onPerson={onOpenPerson} onClose={()=>setParticipantsOpen(false)}/>:null}
  <div ref={scrollerRef} onScroll={event=>{const element=event.currentTarget;stickToBottom.current=element.scrollHeight-element.scrollTop-element.clientHeight<100}} className="hm-chat-messages" aria-live="polite">
   {loading?<div className="hm-chat-empty">ჩატი იტვირთება…</div>:messages.length===0?<div className="hm-chat-empty"><div><strong>დაიწყე საუბარი</strong><span>პირველი შეტყობინება აქ გამოჩნდება.</span></div></div>:
   <div className="hm-chat-message-list">{messages.map((message,index)=>{
    const previous=messages[index-1],next=messages[index+1];
    const beginsDay=!previous||dateKey(previous.created)!==dateKey(message.created);
    const beginsGroup=beginsDay||previous?.authorUserId!==message.authorUserId||previous?.kind!==message.kind;
    const endsGroup=!next||dateKey(next.created)!==dateKey(message.created)||next.authorUserId!==message.authorUserId||next.kind!==message.kind;
    const day=beginsDay?<div className="hm-chat-day"><span>{messageDayLabel(message.created)}</span></div>:null;
    if(message.kind==='shoot')return <Fragment key={message.id}>{day}<article id={`chat-message-${message.id}`} className="hm-chat-shoot-notice"><span><CalendarDays/></span><div><small>დაინიშნა გადაღება · {messageTime(message.created)}</small><p><LinkifiedText text={message.body}/></p>{message.referenceId?<a href={`/shoots#shoot-${encodeURIComponent(message.referenceId)}`}>დეტალების ნახვა <ExternalLink/></a>:null}</div>{permissions.canModerate&&<button type="button" onClick={()=>void togglePin(message)} disabled={pinningId===message.id} aria-label={message.pinned?'პინის მოხსნა':'მიმაგრება'}>{message.pinned?<PinOff/>:<Pin/>}</button>}</article></Fragment>;
    const mine=message.authorUserId===currentUserId,person=peopleById.get(message.authorUserId);
    return <Fragment key={message.id}>{day}<article id={`chat-message-${message.id}`} className={`hm-message ${mine?'mine':'received'}`}>{!mine?(endsGroup?<AvatarView person={person} name={message.authorName} small/>:<span className="hm-message-avatar-space"/>):null}<div className="hm-message-content">{!mine&&beginsGroup?<p className="hm-message-author"><b>{message.authorName}</b><span>{message.authorRole}</span></p>:null}{reactionId===message.id&&<div className="hm-message-menu" role="group" aria-label="შეტყობინების მოქმედებები"><div>{permissions.canSend&&['❤️','😂','👍','😮','😢','🙌'].map(emoji=><button key={emoji} aria-label={emoji} onClick={()=>void react(message,emoji)}>{emoji}</button>)}</div><footer><time dateTime={new Date(message.created).toISOString()}>{messageTime(message.created)}</time>{permissions.canModerate&&<button type="button" onClick={()=>{void togglePin(message);setReactionId(null)}} disabled={pinningId===message.id}>{message.pinned?<PinOff size={14}/>:<Pin size={14}/>} {message.pinned?'პინის მოხსნა':'მიმაგრება'}</button>}<button type="button" aria-label="მოქმედებების დახურვა" onClick={()=>setReactionId(null)}><X size={14}/></button></footer></div>}<div className="hm-message-row"><div className="hm-message-bubble" title={messageTime(message.created)} onContextMenu={e=>{e.preventDefault();cancelHold();setReactionId(message.id)}} onPointerDown={e=>{if(e.pointerType!=='mouse'){cancelHold();holdPoint.current={x:e.clientX,y:e.clientY};holdTimer.current=setTimeout(()=>setReactionId(message.id),450)}}} onPointerUp={cancelHold} onPointerLeave={cancelHold} onPointerMove={e=>{const point=holdPoint.current;if(point&&Math.hypot(e.clientX-point.x,e.clientY-point.y)>8)cancelHold()}} onPointerCancel={cancelHold} onDoubleClick={()=>void react(message,'❤️')}>{message.attachmentId&&(message.kind==='audio'?<audio controls preload="none" src={'/api/chat/attachments?id='+message.attachmentId} style={{width:260,maxWidth:'100%'}} onPlay={e=>{document.querySelectorAll('audio').forEach(a=>{if(a!==e.currentTarget)a.pause()})}}/>:<button type="button" className="hm-message-photo" aria-label="ფოტოს გახსნა" onClick={e=>openPhoto(message.attachmentId!,e.currentTarget)}><img alt="გაზიარებული ფოტო" loading="lazy" src={'/api/chat/attachments?id='+message.attachmentId}/></button>)}{!!message.body&&<p><LinkifiedText text={message.body}/></p>}{message.pinned?<Pin className="hm-message-pinned"/>:null}</div><button type="button" className="hm-message-actions" aria-label="რეაქცია და გაგზავნის დრო" aria-expanded={reactionId===message.id} onClick={()=>setReactionId(reactionId===message.id?null:message.id)}><MoreHorizontal size={17}/></button></div>{(message.delivery||!!message.reactions?.length)&&<div className="hm-message-reactions">{message.delivery==='sending'?<small>იგზავნება…</small>:message.delivery==='failed'?<button onClick={()=>void deliver(message)}>ხელახლა გაგზავნა ↻</button>:null}{message.reactions?.filter(r=>r.count>0).map(r=><button key={r.emoji} aria-pressed={r.mine} disabled={!permissions.canSend} onClick={()=>void react(message,r.emoji)}>{r.emoji}{r.count>1?' '+r.count:''}</button>)}</div>}</div></article></Fragment>;
   })}<div ref={endRef}/></div>}
  </div>
  <footer className="hm-chat-composer staff-chat-composer shrink-0">
   {error?<p className="hm-chat-error" role="alert">{error}</p>:null}
   {uploading&&<p className="hm-chat-uploading" role="status">ფოტო იტვირთება…</p>}
   {stagedPhotos.length>0&&<div className="hm-staged-photos" aria-label="გასაგზავნი ფოტოები">{stagedPhotos.map(p=><div key={p.id}><img src={p.url} alt="გასაგზავნი ფოტო"/><button type="button" disabled={uploading} aria-label="ფოტოს მოხსნა" onClick={()=>removeStaged(p.id)}><X size={14}/></button></div>)}<small>ფოტო მზადაა · დააჭირე გაგზავნას</small></div>}
   {!emojiOpen&&!toolsOpen&&mentionOptions.length>0&&<div className="work-mention-menu">{mentionOptions.map((p,i)=><button key={p.handle+i} onClick={()=>insertMention(p.handle)}>＠{p.handle} <small>{p.name}</small></button>)}</div>}
   {emojiOpen&&<div className="work-emoji-picker" aria-label="ემოჯის არჩევა">{['😀','😃','😊','😂','🤣','😍','🥰','😎','🤔','😢','😭','😮','🥳','❤️','💙','🔥','👍','👎','👏','🙌','🙏','💪','✅','🎉','🎂','🎬','📷','💡','👀','🚀','💯','🤝'].map(e=><button key={e} aria-label={e} onClick={()=>{const input=inputRef.current,start=input?.selectionStart??body.length,end=input?.selectionEnd??body.length;setBody(body.slice(0,start)+e+body.slice(end));input?.focus();setEmojiOpen(false)}}>{e}</button>)}</div>}
   <div className="hm-chat-tools" hidden={!toolsOpen||!permissions.canSend}>
    {permissions.canAttach&&<label className="work-photo-upload" title="ფოტოს გაგზავნა"><ImagePlus size={18}/><span>ფოტო</span><input type="file" accept="image/*" aria-label="ფოტოს გაგზავნა" multiple disabled={uploading} onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';stagePhotos(files)}}/></label>}
    <button type="button" aria-label="ლოკაციის გაზიარება" onClick={shareLocation}><MapPin size={18}/><span>ლოკაცია</span></button>
    {permissions.canAttach&&<VoiceRecorder conversationId={conversationId} onSend={(id,duration)=>{void sendMessage('',id,duration);setToolsOpen(false)}}/>}
   </div>
   {!permissions.canSend&&<p className="hm-chat-uploading">ამ ჩატში მხოლოდ ნახვის უფლება გაქვს.</p>}
   <div className="hm-chat-composer-row">
    <button type="button" className="hm-compose-tool" disabled={!permissions.canSend} aria-label={toolsOpen?'დანართების დახურვა':'ფოტო, ხმა ან ლოკაცია'} aria-expanded={toolsOpen} onClick={()=>{if(toolsOpen)window.dispatchEvent(new Event('hmw:chat-pause'));setToolsOpen(!toolsOpen);setEmojiOpen(false)}}>{toolsOpen?<X/>:<Plus/>}</button>
    <textarea ref={inputRef} value={body} disabled={!permissions.canSend} onPaste={event=>{const files=Array.from(event.clipboardData.items).filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter((file):file is File=>!!file);if(files.length){event.preventDefault();stagePhotos(files)}}} onChange={event=>setBody(event.target.value.slice(0,MAX_BODY_LENGTH))} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void submit()}}} rows={1} placeholder="შეტყობინება…" aria-label="შეტყობინება"/>
    <button type="button" className="hm-compose-tool" disabled={!permissions.canSend} aria-label="ემოჯის არჩევა" aria-expanded={emojiOpen} onClick={()=>{setEmojiOpen(!emojiOpen);setToolsOpen(false);window.dispatchEvent(new Event('hmw:chat-pause'))}}><Smile/></button>
    <button type="button" onClick={()=>void submit()} disabled={!permissions.canSend||uploading||!body.trim()&&!stagedPhotos.length} aria-label="გაგზავნა"><Send/></button>
   </div>{body.length>3500?<span className="hm-chat-counter">{body.length}/{MAX_BODY_LENGTH}</span>:null}
  </footer>
  {photo&&<PhotoViewer src={'/api/chat/attachments?id='+encodeURIComponent(photo)} onClose={()=>setPhoto(null)}/>}

 </section>;

 if(compact)return <div className="hm-chat-embed">{chat}</div>;
 return <div className="hm-chat-layout">{chat}</div>;
}
