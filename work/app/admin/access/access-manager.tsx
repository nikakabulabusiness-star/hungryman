'use client';
import {roleLabel} from '@/lib/department-directory';

import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronDown,ShieldCheck,Trash2,Users} from 'lucide-react';
import {finishSave} from '@/lib/save-feedback';
import type {TeamRole,TeamStatus} from '@/lib/team-roles';
import AdminHeader from '../admin-header';
import styles from './access-manager.module.css';

type Account={email:string;fullName:string;role:TeamRole|null;status:TeamStatus;created:number;department:string;canManage:boolean;canDelete:boolean;isSelf:boolean};
type AccountResult={error?:string;account?:Pick<Account,'email'|'fullName'|'role'|'status'|'created'>;self?:boolean};
const statusLabels:Record<TeamStatus,string>={pending:'მოლოდინში',approved:'აქტიური',suspended:'შეჩერებული'};
const date=(value:number)=>new Date(value).toLocaleString('ka-GE',{timeZone:'Asia/Tbilisi'});

export default function AccessManager({viewerIsOwner,viewerEmail,initialAccounts,availableRoles,roleDepartments}:{viewerIsOwner:boolean;viewerEmail:string;initialAccounts:Account[];availableRoles:string[];roleDepartments:Record<string,string>}){
 const [accounts,setAccounts]=useState(initialAccounts),[notice,setNotice]=useState(''),[highlightedEmail,setHighlightedEmail]=useState<string|null>(null),[deleteTarget,setDeleteTarget]=useState<Account|null>(null),[deleteText,setDeleteText]=useState(''),[deleting,setDeleting]=useState(false);
 const listRef=useRef<HTMLDetailsElement>(null),highlightTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const pending=accounts.filter(account=>account.status==='pending'),sections=useMemo(()=>{
  const grouped=new Map<string,Account[]>();
  for(const account of accounts.filter(item=>item.status!=='pending'))grouped.set(account.department,[...(grouped.get(account.department)||[]),account]);
  return [...grouped.entries()];
 },[accounts]);
 useEffect(()=>()=>{if(highlightTimer.current)clearTimeout(highlightTimer.current)},[]);
 useEffect(()=>{
  if(!deleteTarget)return;
  const close=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!deleting){setDeleteTarget(null);setDeleteText('')}};
  document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);
 },[deleteTarget,deleting]);

 async function update(target:string,nextRole:TeamRole|null,nextStatus:Exclude<TeamStatus,'pending'>){
  setNotice('ცვლილება ინახება...');
  try{
   const response=await fetch('/api/admin/users',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:target,role:nextRole,status:nextStatus})});
   const result=await response.json() as AccountResult;
   if(!response.ok||!result.account)throw new Error(result.error||'ცვლილება ვერ შეინახა.');
   setAccounts(old=>old.map(account=>account.email===target?{...account,...result.account!,department:result.account!.role?roleDepartments[result.account!.role]||account.department:account.department}:account));
   setNotice(nextStatus==='approved'?'ანგარიში გააქტიურდა და როლის უფლებები ავტომატურად მიენიჭა.':'ანგარიში შეჩერებულია და აქტიური სესიები გაუქმდა.');
   return true;
  }catch(error){setNotice(error instanceof Error?error.message:'ცვლილება ვერ შეინახა.');return false}
 }

 function focusFirstPending(){
  const account=pending[0];if(!account)return;
  if(listRef.current)listRef.current.open=true;
  setHighlightedEmail(account.email);
  window.setTimeout(()=>document.getElementById(accountId(account.email))?.scrollIntoView({behavior:'smooth',block:'center'}),40);
  if(highlightTimer.current)clearTimeout(highlightTimer.current);
  highlightTimer.current=setTimeout(()=>setHighlightedEmail(null),2200);
 }

 function askDelete(account:Account){setDeleteTarget(account);setDeleteText('');setNotice('')}
 async function confirmDelete(){
  if(!deleteTarget)return;
  setDeleting(true);
  try{
   const response=await fetch('/api/admin/users',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:deleteTarget.email,confirmation:deleteTarget.email})}),result=await response.json() as AccountResult;
   if(!response.ok)throw new Error(result.error||'ანგარიში ვერ წაიშალა.');
   if(result.self||deleteTarget.email.toLowerCase()===viewerEmail.toLowerCase()){window.location.assign('/team/auth?account_deleted=1');return}
   setAccounts(old=>old.filter(account=>account.email!==deleteTarget.email));
   setNotice('ანგარიში და მისი პირადი წვდომა წაიშალა. საერთო სამუშაო ისტორია ანონიმურად შენარჩუნდა.');
   setDeleteTarget(null);setDeleteText('');
  }catch(error){setNotice(error instanceof Error?error.message:'ანგარიში ვერ წაიშალა.')}finally{setDeleting(false)}
 }

 return <main className="admin-shell">
  <AdminHeader active="access" isOwner={viewerIsOwner} canManagePeople/>
  <div className="admin-heading"><div><p className="eyebrow">წვდომის მართვა</p><h1>რეგისტრირებული ანგარიშები</h1><p className="lead">როლის მინიჭების შემდეგ თანამშრომელი ავტომატურად იღებს ამ როლისთვის განსაზღვრულ უფლებებს.</p></div><div className="access-summary"><span><Users size={16} aria-hidden="true"/><b>{accounts.length}</b> ანგარიში</span><button type="button" onClick={focusFirstPending} disabled={!pending.length} aria-label={pending.length?'პირველი მოლოდინის მოთხოვნის გახსნა':'მოლოდინის მოთხოვნები არ არის'}><b>{pending.length}</b> მოთხოვნა</button></div></div>
  {notice&&<p className="admin-notice" role="status">{notice}</p>}
  <details ref={listRef} className="panel access-list admin-disclosure"><summary className="admin-disclosure-summary"><span><strong>ანგარიშების მართვა</strong><small>{accounts.length} ანგარიში · {pending.length} მოთხოვნა</small></span><ChevronDown className="disclosure-chevron" size={22} aria-hidden="true"/></summary><div className="admin-disclosure-body">
   {pending.length>0&&<AccountSection title="რეგისტრაციის მოთხოვნები" hint="ახალი მოთხოვნები" accounts={pending} highlightedEmail={highlightedEmail} availableRoles={availableRoles} onUpdate={update} onDelete={askDelete}/>}
   {sections.map(([department,members])=><AccountSection key={department} title={department} hint={`${members.length} ანგარიში`} accounts={members} highlightedEmail={highlightedEmail} availableRoles={availableRoles} onUpdate={update} onDelete={askDelete}/>)}
   {!accounts.length&&<div className="empty-team"><h2>რეგისტრაციის მოთხოვნები ჯერ არ არის</h2><p className="muted">ახალი ანგარიში რეგისტრაციის დასრულებისთანავე ავტომატურად გამოჩნდება აქ.</p></div>}
  </div></details>
  {deleteTarget&&<div className={styles.modalBackdrop} onMouseDown={event=>{if(event.target===event.currentTarget&&!deleting){setDeleteTarget(null);setDeleteText('')}}}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="delete-account-title"><span className={styles.dangerIcon}><Trash2 size={22}/></span><h2 id="delete-account-title">ანგარიშის წაშლა</h2><p><strong>{deleteTarget.fullName||deleteTarget.email}</strong>-ის ანგარიში, ავტორიზაცია და პირადი მონაცემები წაიშლება. საერთო ჩატის და სამუშაო ისტორია დარჩება ანონიმური ავტორით.</p>{deleteTarget.isSelf&&<p className={styles.selfWarning}>ეს შენი ანგარიშია — წაშლის შემდეგ ყველა მოწყობილობიდან გამოხვალ.</p>}<p>დარწმუნებული ხარ, რომ ანგარიშის სრულად წაშლა გინდა?</p><div className={styles.modalActions}><button className="outline small" type="button" disabled={deleting} onClick={()=>{setDeleteTarget(null);setDeleteText('')}}>გაუქმება</button><button className={styles.deleteConfirm} type="button" disabled={deleting} onClick={confirmDelete}>{deleting?'იშლება...':'ანგარიშის წაშლა'}</button></div></section></div>}
 </main>;
}

function AccountSection({title,hint,accounts,highlightedEmail,availableRoles,onUpdate,onDelete}:{title:string;hint:string;accounts:Account[];highlightedEmail:string|null;availableRoles:readonly TeamRole[];onUpdate:(email:string,role:TeamRole|null,status:Exclude<TeamStatus,'pending'>)=>Promise<boolean>;onDelete:(account:Account)=>void}){
 return <section className={styles.group}><header className={styles.groupHeader}><h2>{title}</h2><span>{hint}</span></header>{accounts.map(account=><AccountRow key={account.email} account={account} highlighted={highlightedEmail===account.email} availableRoles={availableRoles} onUpdate={onUpdate} onDelete={onDelete}/>)}</section>;
}

function accountId(email:string){return `account-${email.replace(/[^a-z0-9_-]/gi,'-')}`}

function AccountRow({account,highlighted,availableRoles,onUpdate,onDelete}:{account:Account;highlighted:boolean;availableRoles:readonly TeamRole[];onUpdate:(email:string,role:TeamRole|null,status:Exclude<TeamStatus,'pending'>)=>Promise<boolean>;onDelete:(account:Account)=>void}){
 const initialStatus:Exclude<TeamStatus,'pending'>=account.status==='suspended'?'suspended':'approved';
 const [role,setRole]=useState<TeamRole|null>(account.role),[status,setStatus]=useState<Exclude<TeamStatus,'pending'>>(initialStatus),[saving,setSaving]=useState(false);
 const cardRef=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{if(highlighted&&cardRef.current){cardRef.current.open=true;cardRef.current.focus({preventScroll:true})}},[highlighted]);
 async function save(nextStatus=status){
  if(!role)return;
  setSaving(true);const ok=await onUpdate(account.email,role,nextStatus);
  if(!ok){setRole(account.role);setStatus(initialStatus)}else await finishSave(cardRef.current,nextStatus==='approved'?'ანგარიში აქტიურია':'ანგარიში შეჩერებულია');
  setSaving(false);
 }
 return <details id={accountId(account.email)} ref={cardRef} className={`access-row access-member account-disclosure ${highlighted?styles.highlight:''}`} tabIndex={-1}><summary className="account-summary"><span className="access-member-info"><strong>{account.fullName||'სახელი მითითებული არ არის'}</strong><span>{account.email}</span><small>{roleLabel(account.role)||'პოზიცია ჯერ არ არის მინიჭებული'}</small></span><span className={'status-chip '+account.status}>{statusLabels[account.status]}</span><ChevronDown className="disclosure-chevron" size={22} aria-hidden="true"/></summary><div className="account-details"><p className="muted account-registered">რეგისტრაცია: {date(account.created)}</p>{account.canManage?<div className="access-member-controls"><label>პოზიცია<select value={role||''} onChange={event=>setRole((event.target.value||null) as TeamRole|null)}><option value="">აირჩიე პოზიცია</option>{account.role&&!availableRoles.includes(account.role)&&<option value={account.role}>{roleLabel(account.role)} · არსებული</option>}{availableRoles.map(value=><option value={value} key={value}>{roleLabel(value)}</option>)}</select></label><label>ანგარიშის სტატუსი<select value={status} onChange={event=>setStatus(event.target.value as Exclude<TeamStatus,'pending'>)}><option value="approved">აქტიური</option><option value="suspended">შეჩერებული</option></select></label><button className={account.status==='pending'?'action small':'outline small'} type="button" disabled={saving||!role} onClick={()=>save(status)}>{saving?'ინახება...':account.status==='pending'?(status==='approved'?'მოთხოვნის დამტკიცება':'მოთხოვნის შეჩერება'):'შენახვა'}</button></div>:<p className="muted"><ShieldCheck size={15} aria-hidden="true"/> ამ ანგარიშის როლისა და სტატუსის შეცვლა შენს უფლებებში არ შედის.</p>}{account.canDelete&&<div className={styles.deleteArea}><button className={styles.deleteButton} type="button" onClick={()=>onDelete(account)}><Trash2 size={16} aria-hidden="true"/> ანგარიშის წაშლა</button></div>}</div></details>;
}
