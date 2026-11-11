'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Archive,Check,Clock3,Download,History,RefreshCw,Save,Send,ShieldCheck} from 'lucide-react';
import {workBoards,workStageLabel,workMoveTargets,type WorkBoard,type WorkVideo,type WorkVideoDetail,type WorkVideoMutation,type WorkSnapshot} from '@/mobile/src/lib/work-model';
import {useWorkFrame} from '@/app/work/tasks/work-frame';
import {WorkDialog,WorkState,WorkFeedback} from '@/app/work/tasks/work-ui';
import {buildWorkArchiveHtml,buildWorkBudgetCsv,workSnapshotExport} from '@/lib/work-export';
import {WorkCallSheetEditor,WorkContentEditor,WorkTechnicalEditor,type WorkDraft,type WorkDraftChange,formatWorkMoney} from './work-callsheet-editor';
import ScriptDocument from './work-script-document';
import './work-callsheet.css';

class VideoRequestError extends Error{constructor(message:string,readonly status:number){super(message)}}
export function videoSavePayload(video:WorkVideo,draft:WorkDraft,board:WorkBoard):WorkVideoMutation{
 const base:WorkVideoMutation={version:video.version,board,action:'save'};
 if(board==='technical')return {...base,technical:draft.technical};
 if(board==='production')return {...base,title:draft.title,callSheet:draft.callSheet};
 if(board==='editing')return {...base,title:draft.title,content:draft.content};
 return {...base,title:draft.title,content:draft.content,callSheet:draft.callSheet};
}
function toDraft(video:WorkVideo):WorkDraft{return structuredClone({title:video.title,content:video.content,callSheet:video.callSheet,technical:video.technical})}
async function requestVideo<T>(path:string,body?:WorkVideoMutation,signal?:AbortSignal):Promise<T>{
 const response=await fetch(path,{method:body?'PATCH':'GET',cache:'no-store',signal,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined}),result=await response.json() as T & {error?:string};
 if(!response.ok)throw new VideoRequestError(result.error||'მოთხოვნა ვერ შესრულდა.',response.status);return result as T;
}
function downloadText(name:string,contents:string,type:string){const url=URL.createObjectURL(new Blob([contents],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function printArchive(detail:WorkVideoDetail,video:WorkVideo){const popup=window.open('','_blank');if(!popup)return false;popup.opener=null;popup.addEventListener('load',()=>popup.print(),{once:true});popup.document.write(buildWorkArchiveHtml(detail,{video}));popup.document.close();return true;}
function stageTone(stage:string|null){return stage==='review'?'pending':['approved','scheduled','done','filmed'].includes(stage||'')?'approved':''}
const actionLabels:Record<string,string>={create:'შექმნა',save:'შენახვა',move:'ეტაპის ცვლილება',approve:'დამტკიცება',return:'დაბრუნება',remove:'წაშლა'};
const time=(value:number)=>new Date(value).toLocaleString('ka-GE',{timeZone:'Asia/Tbilisi',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

export default function WorkVideoClient({id,initialBoard}:{id:string;initialBoard?:WorkBoard}){
 const {setMeta}=useWorkFrame(),[detail,setDetail]=useState<WorkVideoDetail|null>(null),[draft,setDraft]=useState<WorkDraft|null>(null),[board,setBoard]=useState<WorkBoard>(initialBoard||'story'),[section,setSection]=useState(0),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[conflict,setConflict]=useState(false),[historyOpen,setHistoryOpen]=useState(false),[exportOpen,setExportOpen]=useState(false),[returnOpen,setReturnOpen]=useState(false),[reviewComment,setReviewComment]=useState(''),[snapshot,setSnapshot]=useState<WorkSnapshot|null>(null);
 const dirtyRef=useRef(false),busyRef=useRef(false),alive=useRef(true),generation=useRef(0),initialized=useRef(false),snapshotRef=useRef(false),path='/api/work/videos/'+encodeURIComponent(id);
 const load=useCallback(async(force=false)=>{
  if(!force&&(dirtyRef.current||busyRef.current||snapshotRef.current))return;
  const ticket=++generation.current,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const result=await requestVideo<WorkVideoDetail>(path,undefined,controller.signal);if(!alive.current||ticket!==generation.current)return;
   setDetail(result);setDraft(toDraft(result.video));setMeta(result.meta);setError('');setConflict(false);dirtyRef.current=false;setDirty(false);
   if(!initialized.current){setBoard(initialBoard&&result.video.stages[initialBoard]!==null?initialBoard:result.video.entryBoard);initialized.current=true;}
  }catch(reason){if(alive.current&&ticket===generation.current){if(reason instanceof VideoRequestError&&[401,403,404].includes(reason.status)){setDetail(null);setDraft(null);dirtyRef.current=false;setDirty(false);}setError(controller.signal.aborted?'კავშირი შეფერხდა. სცადე ხელახლა.':(reason as Error).message)}}finally{clearTimeout(timer)}
 },[path,initialBoard,setMeta]);
 useEffect(()=>{alive.current=true;const requestGeneration=generation;void Promise.resolve().then(()=>{if(alive.current)void load(true)});const visible=()=>{if(document.visibilityState==='visible')void load()};const timer=setInterval(visible,20000);document.addEventListener('visibilitychange',visible);return()=>{alive.current=false;requestGeneration.current++;clearInterval(timer);document.removeEventListener('visibilitychange',visible)}},[load]);
 useEffect(()=>{const leave=(event:BeforeUnloadEvent)=>{if(dirtyRef.current){event.preventDefault();event.returnValue=''}},ended=()=>{generation.current++;setDetail(null);setDraft(null);dirtyRef.current=false;setDirty(false);setError('სესია დასრულდა. ხელახლა გაიარე ავტორიზაცია.');};window.addEventListener('beforeunload',leave);window.addEventListener('hmw-work-logout',ended);window.addEventListener('hmw:session-ended',ended);return()=>{window.removeEventListener('beforeunload',leave);window.removeEventListener('hmw-work-logout',ended);window.removeEventListener('hmw:session-ended',ended)}},[]);
 const change:WorkDraftChange=update=>{generation.current++;dirtyRef.current=true;setDirty(true);setMessage('');setDraft(old=>old?update(old):old)};
 if(!detail||!draft)return <WorkState loading={!error} error={error} retry={()=>void load(true)}/>;
 const historicalExport=snapshot?workSnapshotExport(detail,snapshot):null,video=historicalExport?.detail.video||detail.video,stage=video.stages[board],canEdit=!snapshot&&video.permissions.editBoards.includes(board)&&stage!=='review',canApprove=!snapshot&&video.permissions.approve&&stage==='review',readonly=!canEdit||busy;
 const stages=workBoards.find(b=>b.id===board)!.stages,index=stages.findIndex(s=>s.id===stage),next=stages[index+1],canMove=canEdit&&!!next&&workMoveTargets(board,stage).includes(next.id);
 function chooseBoard(nextBoard:WorkBoard){if(dirty&&!window.confirm('შეუნახავი ცვლილებები დაიკარგება. გადავიდეთ სხვა დეპარტამენტზე?'))return;dirtyRef.current=false;setDirty(false);setDraft(toDraft(detail!.video));setSnapshot(null);snapshotRef.current=false;setBoard(nextBoard);setSection(0);setMessage('');setError('');history.replaceState(history.state,'','/work/tasks/video/'+encodeURIComponent(id)+'?board='+nextBoard);}
 function chooseSnapshot(nextSnapshot:WorkSnapshot|null){if(dirty&&!window.confirm('შეუნახავი ცვლილებები დაიკარგება. გავხსნათ შენახული ვერსია?'))return;setSnapshot(nextSnapshot);snapshotRef.current=!!nextSnapshot;setDraft(toDraft(nextSnapshot?{...detail!.video,...nextSnapshot.data}:detail!.video));dirtyRef.current=false;setDirty(false);setHistoryOpen(false);setMessage('');if(nextSnapshot)setBoard(nextSnapshot.board);}
 async function perform(action:WorkVideoMutation['action'],targetStage?:string){
  if(busyRef.current||snapshot)return;
  busyRef.current=true;setBusy(true);generation.current++;setError('');setMessage('');setConflict(false);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{
   let current=detail!.video;
   if(action==='save'||dirtyRef.current){const result=await requestVideo<{video:WorkVideo}>(path,videoSavePayload(current,draft!,board),controller.signal);current=result.video;setDetail(old=>old?{...old,video:current}:old);setDraft(toDraft(current));dirtyRef.current=false;setDirty(false);}
   if(action!=='save'){const result=await requestVideo<{video:WorkVideo}>(path,{version:current.version,board,action,stage:targetStage,comment:reviewComment.trim()},controller.signal);current=result.video;setDetail(old=>old?{...old,video:current}:old);setDraft(toDraft(current));}
   setReturnOpen(false);setReviewComment('');setMessage(action==='save'?'ცვლილებები შენახულია.':action==='approve'?'დამტკიცებულია. შესაბამისი გუნდი მიიღებს შეტყობინებას.':action==='return'?'დაბრუნებულია შესასწორებლად.':'ეტაპი განახლებულია.');window.dispatchEvent(new Event('hmw-work-updated'));await load(true);
  }catch(reason){if(reason instanceof VideoRequestError&&[401,403,404].includes(reason.status)){setDetail(null);setDraft(null);dirtyRef.current=false;setDirty(false);}setConflict(reason instanceof VideoRequestError&&reason.status===409);setError(controller.signal.aborted?'კავშირი შეფერხდა. ცვლილებები ჯერ არ არის დადასტურებული — განაახლე მონაცემები ხელახლა ცდამდე.':(reason as Error).message)}
  finally{clearTimeout(timer);busyRef.current=false;setBusy(false);}
 }
 return <div className="hm-call-sheet" onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(canEdit&&dirty)void perform('save')}}}>
  <header className="hm-cs-heading"><div><a href={'/work/tasks?board='+board} className="hm-cs-back"><ArrowLeft size={15}/>სამუშაო დაფაზე</a><p className="hm-cs-eyebrow">HUNGRYMAN WORK · {id.slice(0,8)}</p><h1>{board==='technical'?'ტექნიკური გეგმა':board==='editing'?'ვიდეოს სამუშაო სივრცე':board==='story'?(stage==='idea'?'ვიდეოს იდეა':'სცენარის დოკუმენტი'):video.kind==='short'?'Shorts-ის მომზადება':'ქოლშითი'}</h1><p className="hm-cs-subtitle">{video.title}</p></div><button type="button" className="hm-cs-secondary" onClick={()=>setExportOpen(true)}><Download size={17}/>ჩამოტვირთვა</button></header>
  <div className="hm-cs-status-row"><span className={'hm-cs-chip '+stageTone(stage)}>{workStageLabel(board,stage)||'ეტაპი არ არის აქტიური'}</span><span>v{snapshot?.version||video.version}</span><span>განახლდა {time(snapshot?.created||video.updated)}</span><button className="hm-cs-text-button" type="button" onClick={()=>setHistoryOpen(true)}><History size={15}/>ვერსიები და ისტორია</button>{video.shoots.map(shoot=><a key={shoot.id} href={'/shoots#shoot-'+encodeURIComponent(shoot.id)}>გადაღება · {shoot.date}<ArrowUpRight size={14}/></a>)}</div>
  <nav className="hm-cs-departments" aria-label="ვიდეოს დეპარტამენტები">{workBoards.filter(b=>video.stages[b.id]!==null).map(b=><button type="button" key={b.id} onClick={()=>chooseBoard(b.id)} aria-current={board===b.id?'page':undefined}><strong>{b.label}</strong><small className={stageTone(video.stages[b.id])}>{workStageLabel(b.id,video.stages[b.id])}</small></button>)}</nav>
  {snapshot&&<div className="hm-cs-info"><Archive size={19}/><div><strong>დამტკიცებული ვერსია · v{snapshot.version}</strong><p>{snapshot.actorName} · {time(snapshot.created)}. ეს ვერსია მხოლოდ წასაკითხია.</p></div><button type="button" onClick={()=>chooseSnapshot(null)}>მიმდინარე ვერსია</button></div>}
  {video.reviewNotes[board]&&<div className="hm-cs-review-note"><strong>დამფუძნებლის კომენტარი</strong><p>{video.reviewNotes[board]}</p></div>}
  {stage==='review'&&!snapshot&&<div className="hm-cs-info"><Clock3 size={20}/><div><strong>დასტურის მოლოდინში</strong><p>ამ ეტაპზე შინაარსი დაცულია რედაქტირებისგან. დამფუძნებელს შეუძლია დამტკიცება ან კომენტარით დაბრუნება.</p></div></div>}
  <WorkFeedback error={error} message={message}/>
  {conflict&&<div className="hm-cs-conflict"><p>შენი ტექსტი შენარჩუნებულია. სხვა თანამშრომელმა ეს ვიდეო განაახლა.</p><button type="button" className="hm-cs-secondary" onClick={()=>downloadText('Hungryman-unsaved-'+id+'.json',JSON.stringify(draft,null,2),'application/json')}>ჩემი ცვლილებების შენახვა ფაილად</button><button type="button" className="hm-cs-secondary" onClick={()=>{if(window.confirm('შეუნახავი ტექსტი შეიცვლება სერვერზე შენახული ვერსიით. განვაახლოთ?'))void load(true)}}><RefreshCw size={16}/>ახალი ვერსიის მიღება</button></div>}
  {board==='editing'&&<div className="hm-teamline"><strong>ვიდეოს გუნდი</strong>{(['story','production'] as const).map((dept,i)=>{
   const crew=draft.callSheet.crew.filter(person=>dept==='story'?person.role==='სცენარისტი':['პროდიუსერი','პროდიუსერის ასისტენტი','რეჟისორი','ოპერატორი'].includes(person.role));
   const names=[...new Set([...crew.map(p=>p.name),...detail.history.filter(h=>h.board===dept&&['create','save'].includes(h.action)).map(h=>h.actorName)])];
   return <span key={dept} title={names.join(', ')}>{i?'▣ პროდაქშენი':'✎ სცენარი'} · {names.slice(0,2).join(', ')||'—'}{names.length>2?' +'+(names.length-2):''}</span>
  })}<span>✂ მონტაჟი · {detail.meta.people.find(p=>p.userId===draft.content.editorId)?.name||'დასანიშნია'}</span>
  {detail.meta.canAssignEditor&&!snapshot&&<label>ედითორი <select disabled={readonly} value={draft.content.editorId||''} onChange={e=>{const editorId=e.target.value;change(old=>({...old,content:{...old.content,editorId}}))}}><option value="">აირჩიე</option>{detail.meta.people.filter(p=>['Video Editor','Senior Editor','Shorts Video Editor'].includes(p.role)).map(p=><option key={p.userId} value={p.userId}>{p.name}</option>)}</select></label>}</div>}
  {board==='editing'&&<details className="hm-work-panel"><summary>დამტკიცებული სცენარი</summary><p style={{whiteSpace:'pre-wrap'}}>{draft.content.script||'სცენარი ჯერ არ არის შევსებული.'}</p></details>}
  <fieldset className="hm-cs-edit-area"  disabled={readonly}>
   {board==='technical'?<WorkTechnicalEditor draft={draft} onChange={change} video={video} disabled={readonly}/>:board==='editing'?<WorkContentEditor draft={draft} onChange={change} disabled={readonly} editing titleEditable={video.entryBoard==='editing'}/>:<>
    {board==='story'&&<>{stage==='idea'?<section className="hm-work-panel hm-work-form"><label>ვიდეოს სათაური<input maxLength={180} value={draft.title} onChange={e=>change(old=>({...old,title:e.target.value}))}/></label><label>მოკლე აღწერა<textarea rows={4} maxLength={500} value={draft.content.summary} onChange={e=>change(old=>({...old,content:{...old.content,summary:e.target.value}}))}/></label>{draft.content.idea&&<p>{draft.content.idea}</p>}</section>:<><details><summary>იდეა და მასალები</summary><WorkContentEditor draft={draft} onChange={change} disabled={readonly} hideScript/></details><ScriptDocument content={draft.content} disabled={readonly} update={patch=>change(old=>({...old,content:{...old.content,...patch}}))}/></>}</>}
    {board==='social'&&<WorkContentEditor draft={draft} onChange={change} disabled={readonly}/>}
    
   </>}
  </fieldset>
  {(board==='production'||board==='social')&&<div className="hm-cs-info"><ShieldCheck size={20}/><div><strong>სცენარის გაგრძელება</strong><p>სათაური, იდეა და სცენარი ვიდეოს სამუშაო სივრციდან გადმოდის.</p></div><button type="button" onClick={()=>setSection(1)}>სცენარის ნახვა</button></div>}
  {(board==='production'||board==='social')&&<div className="hm-cs-sheet-fields"><WorkCallSheetEditor draft={draft} onChange={change} video={video} meta={detail.meta} disabled={readonly} section={section} onSection={setSection}/></div>}
  <footer className="hm-cs-savebar"><div><span className={'hm-cs-save-dot'+(dirty?' is-dirty':'')}/><span>{busy?'მოთხოვნა სრულდება…':snapshot?'დამტკიცებული ვერსია':dirty?'შეუნახავი ცვლილებები':'ყველა ცვლილება შენახულია'}<small>{formatWorkMoney(video.totals.grandTotal)} · საერთო ბიუჯეტი</small></span></div><div className="hm-cs-save-actions">
   {canEdit&&<><button className="hm-cs-secondary" type="button" disabled={busy||!dirty} onClick={()=>void perform('save')}><Save size={16}/>შენახვა</button>{canMove&&<button className="hm-cs-primary" type="button" disabled={busy} onClick={()=>void perform('move',next.id)}><Send size={16}/>{next.id==='review'?'დასტურზე გაგზავნა':next.label+' →'}</button>}</>}
   {canApprove&&<><button type="button" className="hm-cs-secondary" disabled={busy} onClick={()=>{setReviewComment('');setReturnOpen(true)}}>შესასწორებლად დაბრუნება</button><button type="button" className="hm-cs-primary" disabled={busy} onClick={()=>{if(window.confirm(board==='production'||board==='social'?'დამტკიცდეს ქოლშითი და ჩაინიშნოს გადაღება მითითებულ დღეებში?':'დამტკიცდეს ეს ვერსია?'))void perform('approve')}}><Check size={17}/>დამტკიცება</button></>}
  </div></footer>
  {returnOpen&&<WorkDialog title="შესასწორებლად დაბრუნება" onClose={()=>{if(!busy)setReturnOpen(false)}}><p>კომენტარი ავტორს დაეხმარება საჭირო ცვლილების შეტანაში.</p><label className="hm-cs-field"><span>რა უნდა გასწორდეს?</span><textarea autoFocus rows={5} maxLength={2000} value={reviewComment} onChange={event=>setReviewComment(event.target.value)}/></label><WorkFeedback error={error}/><button type="button" className="hm-cs-primary" disabled={busy||!reviewComment.trim()} onClick={()=>void perform('return')}>დაბრუნება</button></WorkDialog>}
  {historyOpen&&<WorkDialog title="ვერსიები და ისტორია" onClose={()=>setHistoryOpen(false)} wide><div className="hm-cs-history"><h3>დამტკიცებული ვერსიები</h3>{!detail.snapshots.length&&<p className="hm-cs-muted">დამტკიცებული ვერსია ჯერ არ არის.</p>}{detail.snapshots.map(item=><button type="button" key={item.id} className="hm-cs-history-version" onClick={()=>chooseSnapshot(item)}><Archive size={17}/><span><strong>{workBoards.find(b=>b.id===item.board)?.label} · v{item.version}</strong><small>{item.actorName} · {time(item.created)}</small></span><ArrowUpRight size={17}/></button>)}<h3>ყველა ცვლილება</h3>{detail.history.map(item=><article key={item.id}><i/><div><strong>{actionLabels[item.action]||item.action} · {workBoards.find(b=>b.id===item.board)?.label}</strong><small>{item.actorName} · {time(item.created)} · v{item.version}</small>{item.toStage&&<p>{workStageLabel(item.board,item.fromStage)} → {workStageLabel(item.board,item.toStage)}</p>}{item.comment&&<p>{item.comment}</p>}</div></article>)}</div></WorkDialog>}
  {exportOpen&&<WorkDialog title={snapshot?'დამტკიცებული ვერსიის ჩამოტვირთვა':'გადაღების ჩამოტვირთვა'} onClose={()=>setExportOpen(false)}><div className="hm-cs-info"><Archive size={20}/><span>{snapshot?'მხოლოდ შერჩეული დამტკიცებული ვერსია — v'+snapshot.version:'სრული შენახული ინფორმაცია, დეპარტამენტების ეტაპები და დამტკიცებული ვერსიები.'}</span></div>{dirty&&<p className="hm-cs-warning">ჩამოტვირთვა მოიცავს შენახულ მონაცემებს. ჯერ შეინახე შეუნახავი ცვლილებები.</p>}<ul className="hm-cs-export-list">{['სათაური, იდეა და სცენარი','განრიგი, ლოკაციები და გუნდი','საჭიროებები და ტექნიკური სია','ბიუჯეტი და ქირაობის თანხები','ფოტოები და დამტკიცებული ინფორმაცია'].map(label=><li key={label}><Check size={16}/>{label}</li>)}</ul><div className="hm-cs-export-actions">
   {historicalExport?<>
    <button type="button" className="hm-cs-primary" onClick={()=>{if(!printArchive(historicalExport.detail,historicalExport.detail.video))setError('ბრაუზერმა ახალი ფანჯარა დაბლოკა. დაუშვი ფანჯრის გახსნა ან ჩამოტვირთე HTML.')}}>შერჩეული ვერსია · ბეჭდვა / PDF</button>
    <button type="button" className="hm-cs-secondary" onClick={()=>downloadText('Hungryman-'+id+'-v'+snapshot!.version+'.html',buildWorkArchiveHtml(historicalExport.detail),'text/html;charset=utf-8')}>ვერსიის დოკუმენტი · HTML</button>
    <button type="button" className="hm-cs-secondary" onClick={()=>downloadText('Hungryman-budget-'+id+'-v'+snapshot!.version+'.csv',buildWorkBudgetCsv(historicalExport.detail.video),'text/csv;charset=utf-8')}>ვერსიის ბიუჯეტი · CSV / Excel</button>
    <button type="button" className="hm-cs-secondary" onClick={()=>downloadText('Hungryman-'+id+'-v'+snapshot!.version+'.json',JSON.stringify(historicalExport.payload,null,2),'application/json')}>შერჩეული ვერსია · JSON</button>
   </>:<>
    <a className="hm-cs-primary" href={path+'/export?format=zip'} download><Download size={17}/>სრული არქივი · ZIP</a>
    <a className="hm-cs-secondary" href={path+'/export?format=html'} target="_blank" rel="noopener noreferrer">ბეჭდვის / PDF-ის გვერდი</a>
    <a className="hm-cs-secondary" href={path+'/export?format=html'} download>დოკუმენტი · HTML</a>
    <a className="hm-cs-secondary" href={path+'/export?format=csv'} download>ბიუჯეტი · CSV / Excel</a>
    <a className="hm-cs-secondary" href={path+'/export?format=json'} download>მონაცემები · JSON</a>
   </>}
  </div><p className="hm-cs-muted">{snapshot?'არქივი შეიცავს მხოლოდ შერჩეულ ვერსიასა და ამ გვერდზე ხელმისაწვდომ იმდროინდელ ისტორიას. ':'სრული არქივი სერვერიდან ჩამოიტვირთება. '}PDF-ისთვის გახსნილ დოკუმენტში აირჩიე ბეჭდვა და „Save as PDF“.</p></WorkDialog>}
 </div>;
}
