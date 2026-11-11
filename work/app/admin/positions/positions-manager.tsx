'use client';
import {useMemo,useState} from 'react';
import {Check,ChevronRight,LockKeyhole,Plus,Search,ShieldCheck,Trash2,X} from 'lucide-react';
import {hierarchyInDepartment,membershipsForPosition,roleLabel,type DepartmentMembership} from '@/lib/department-directory';
import HierarchyBadge from '@/components/hierarchy-badge';
import type {Position} from '@/lib/positions';
import {permissionDependencies,type PermissionKey} from '@/lib/permissions';

type Department={id:string;name:string;order:number};
type PermissionGroup={id:string;label:string;permissions:readonly {key:PermissionKey;label:string;description?:string}[]};
type Props={initialPositions:Position[];departments:Department[];groups:readonly PermissionGroup[];editableNames:string[];grantable:PermissionKey[];canCreate:boolean;isDeveloper:boolean;canEditStructure:boolean};
type Draft={name:string;departmentId:string;rank:number;reportsTo:string;active:boolean;permissions:PermissionKey[];memberships:DepartmentMembership[]};
const draftOf=(position:Position):Draft=>({name:position.name,departmentId:position.departmentId,rank:position.rank,reportsTo:position.reportsTo||'',active:position.active,permissions:[...position.permissions],memberships:membershipsForPosition(position)});

export default function PositionsManager({initialPositions,departments,groups,editableNames:initialEditable,grantable,canCreate,isDeveloper,canEditStructure}:Props){
 const [positions,setPositions]=useState(initialPositions),[editableNames,setEditableNames]=useState(initialEditable),[selected,setSelected]=useState(initialPositions[0]?.name||''),[draft,setDraft]=useState<Draft|null>(initialPositions[0]?draftOf(initialPositions[0]):null),[query,setQuery]=useState(''),[adding,setAdding]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const position=positions.find(p=>p.name===selected),editable=adding||editableNames.includes(selected),structureEditable=editable&&(canEditStructure||!['HR','კრეატიული დირექტორი','ადმინისტრატორი','Owner'].includes(selected));
 const dirty=adding||!!draft&&!!position&&JSON.stringify(draft)!==JSON.stringify(draftOf(position));
 const ordered=useMemo(()=>[{id:'leadership',name:'დამფუძნებელი',order:-1},...[...departments].sort((a,b)=>a.order-b.order),{id:'other',name:'დეპარტამენტის გარეშე',order:99}],[departments]);
 function choose(choice:Position){const next=positions.find(p=>p.name===choice.name)||choice;if(dirty&&!confirm('შეუნახავი ცვლილებები დაიკარგება. გადავიდეთ სხვა შტატზე?'))return;setSelected(next.name);setDraft(draftOf(next));setAdding(false);setError('');setNotice('')}
 function add(){if(dirty&&!confirm('შეუნახავი ცვლილებები დაიკარგება. დავამატოთ ახალი შტატი?'))return;setSelected('');setAdding(true);setDraft({name:'',departmentId:'other',rank:1,reportsTo:'Owner',active:true,permissions:[],memberships:[]});setError('');setNotice('')}
 function toggle(key:PermissionKey){
  if(!draft||!editable||(!grantable.includes(key)&&!draft.permissions.includes(key)))return;
  const next=new Set(draft.permissions);
  if(next.has(key)){
   next.delete(key);let changed=true;while(changed){changed=false;for(const candidate of next){if((permissionDependencies[candidate]||[]).some(dependency=>!next.has(dependency))){next.delete(candidate);changed=true}}}
  }else{
   const add=(candidate:PermissionKey)=>{if(next.has(candidate))return;for(const dependency of permissionDependencies[candidate]||[])add(dependency);next.add(candidate)};add(key);
  }
  setDraft({...draft,permissions:[...next]});
 }
 async function save(remove=false){
  if(busy||!draft)return;
  if(remove&&!confirm(`წაიშალოს შტატი „${selected}“? ამ შტატზე მყოფი ანგარიშების წვდომა გაიყინება სხვა შტატის მინიჭებამდე.`))return;
  if(!remove&&!draft.active&&position?.active&&!confirm('არააქტიური შტატის ყველა ანგარიშს წვდომა გაეყინება. გავაგრძელოთ?'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/admin/positions',{method:remove?'DELETE':adding?'POST':'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(remove?{name:selected}:{...draft,currentName:adding?undefined:selected})});
   const data=await response.json() as {positions?:Position[];editableNames?:string[];error?:string};
   if(!response.ok||!data.positions)throw Error(data.error||'ცვლილება ვერ შეინახა.');
   setPositions(data.positions);if(data.editableNames)setEditableNames(data.editableNames);
   const next=data.positions.find(p=>p.name===draft.name)||data.positions[0];setSelected(next?.name||'');setDraft(next?draftOf(next):null);setAdding(false);setNotice(remove?'შტატი წაშლილია.':'ცვლილებები შენახულია. ამ შტატის ანგარიშების უფლებები განახლდა.');
   window.dispatchEvent(new CustomEvent('hungryman:saved',{detail:remove?'შტატი წაშლილია':'შტატი და უფლებები შენახულია'}));
  }catch(reason){setError(reason instanceof Error?reason.message:'ცვლილება ვერ შეინახა.')}finally{setBusy(false)}
 }
 return <section className="role-management">
  <aside className="role-directory" aria-label="შტატების სია">
   <div className="role-directory-head"><h2>შტატები <span>{positions.length}</span></h2>{canCreate&&<button className="role-icon-button" title="ახალი შტატი" aria-label="ახალი შტატი" onClick={add}><Plus size={19}/></button>}</div>
   <label className="role-search"><Search size={16}/><input type="search" placeholder="შტატის ძიება" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <nav>{ordered.map(department=>{const items=(['leadership','other'].includes(department.id)?positions.filter(p=>department.id==='leadership'?p.name==='Owner':p.name!=='Owner'&&!membershipsForPosition(p).length).map(p=>({...p,displayLevel:p.name==='Owner'?0:1,maxLevel:1})):hierarchyInDepartment(positions,department.id)).filter(p=>roleLabel(p.name).toLocaleLowerCase().includes(query.toLocaleLowerCase()));if(!items.length)return null;return <section key={department.id} className="role-department-group"><h3>{department.name}</h3>{items.map(item=><button key={item.name} className={`role-choice${selected===item.name&&!adding?' selected':''}`} onClick={()=>choose(item)} aria-current={selected===item.name&&!adding?'true':undefined}><HierarchyBadge level={item.displayLevel} maxLevel={item.maxLevel}/><span><strong>{roleLabel(item.name)}</strong><small>{item.active?'აქტიური':'არააქტიური · წვდომა გაყინულია'}</small></span>{editableNames.includes(item.name)?<ChevronRight size={15}/>:<LockKeyhole size={14}/>}</button>)}</section>})}</nav>
   <p className="role-directory-note"><ShieldCheck size={16}/>Developer-ს ყოველთვის სრული წვდომა აქვს და ამ სიით არ იზღუდება.</p>
  </aside>
  <div className="role-editor">
   {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="role-success" role="status"><Check size={17}/>{notice}</p>}
   {draft?<form onSubmit={e=>{e.preventDefault();void save()}}>
    <header className="role-editor-head"><div><p className="eyebrow">{adding?'ახალი შტატი':'შტატი და უფლებები'}</p><h2>{adding?'პოზიციის დამატება':roleLabel(selected)}</h2></div><span className={`role-status ${draft.active?'active':'inactive'}`}>{draft.active?'აქტიური':'არააქტიური'}</span></header>
    {!editable&&<p className="role-readonly"><LockKeyhole size={16}/>ამ შტატის მართვა უფრო მაღალი უფლებების მქონე ანგარიშს შეუძლია.</p>}
    <fieldset disabled={!editable||busy} className="role-settings"><legend>პოზიციის ინფორმაცია</legend>
     <label>დასახელება<input value={draft.name==='Owner'?roleLabel(draft.name):draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} required minLength={2} maxLength={80} disabled={!canEditStructure||(!adding&&(!structureEditable||selected==='Owner'))}/></label>
     {draft.name==='Owner'?<p className="role-shared-note">დამფუძნებელი ყველა დეპარტამენტის ზემდგომია · დონე 0</p>:<div className="role-membership-editor"><p className="role-shared-note">ერთი შტატი შეიძლება რამდენიმე დეპარტამენტში იყოს. უფლებების ცვლილება მის ყველა ანგარიშს ეხება.</p>{departments.map(d=>{
      const member=draft.memberships.find(m=>m.departmentId===d.id);
      const setMember=(change:Partial<DepartmentMembership>)=>setDraft({...draft,memberships:draft.memberships.map(m=>m.departmentId===d.id?{...m,...change}:m)});
      const parents=hierarchyInDepartment(positions,d.id).filter(p=>p.name!==selected&&p.level<(member?.level||1));
      return <div className="role-membership-row" key={d.id}><label><input type="checkbox" disabled={!canEditStructure} checked={!!member} onChange={e=>setDraft({...draft,memberships:e.target.checked?[...draft.memberships,{departmentId:d.id,level:1,reportsTo:'Owner'}]:draft.memberships.filter(m=>m.departmentId!==d.id)})}/>{d.name}</label>{member&&<><label>დონე<input aria-label={`${d.name} · დონე`} disabled={!canEditStructure} type="number" min={1} max={30} value={member.level} onChange={e=>setMember({level:Number(e.target.value),...(Number(e.target.value)===1?{reportsTo:'Owner'}:{})})}/></label><label>ექვემდებარება<select disabled={!canEditStructure||member.level===1} value={member.reportsTo} onChange={e=>setMember({reportsTo:e.target.value})}><option value="Owner">დამფუძნებელი</option>{parents.map(p=><option key={p.name} value={p.name}>{roleLabel(p.name)}</option>)}</select></label></>}</div>;
     })}</div>}
     <label className="role-active-switch"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/><span><strong>აქტიური შტატი</strong><small>გამორთვა ამ შტატის ყველა ანგარიშს წვდომას გაუყინავს.</small></span></label>
    </fieldset>
    <div className="role-permissions-heading"><h3>წვდომა და მოქმედებები</h3><p>უფლებები ავტომატურად ვრცელდება ყველა ანგარიშზე, რომელსაც ეს შტატი აქვს.</p></div>
    <div className="role-permission-groups">{groups.map(group=><section className="role-permission-group" key={group.id}><h3>{group.label}<span>{group.permissions.filter(p=>draft.permissions.includes(p.key)).length}/{group.permissions.length}</span></h3><div>{group.permissions.map(permission=>{const available=grantable.includes(permission.key);return <label key={permission.key} className={!available?'permission-locked':''}><input type="checkbox" checked={draft.permissions.includes(permission.key)} disabled={!editable||busy||(!available&&!draft.permissions.includes(permission.key))} onChange={()=>toggle(permission.key)}/><span><strong>{permission.label}</strong>{permission.description&&<small>{permission.description}</small>}</span>{!available&&<LockKeyhole size={13} aria-label="ამ უფლების მინიჭება არ შეგიძლია"/>}</label>})}</div></section>)}</div>
    {editable&&<footer className="role-editor-actions">{!adding&&structureEditable&&<button type="button" className="role-delete" disabled={busy} onClick={()=>void save(true)}><Trash2 size={16}/>წაშლა</button>}<span/>{adding&&<button type="button" className="role-secondary" disabled={busy} onClick={()=>{setAdding(false);const first=positions[0];setSelected(first?.name||'');setDraft(first?draftOf(first):null)}}><X size={16}/>გაუქმება</button>}<button className="role-save" type="submit" disabled={busy||!dirty}><Check size={17}/>{busy?'ინახება…':'შენახვა'}</button></footer>}
   </form>:<div className="role-empty"><ShieldCheck size={28}/><p>აირჩიე შტატი ან დაამატე ახალი პოზიცია.</p>{canCreate&&<button className="role-save" onClick={add}><Plus size={17}/>ახალი შტატი</button>}</div>}
  </div>
 </section>;
}
