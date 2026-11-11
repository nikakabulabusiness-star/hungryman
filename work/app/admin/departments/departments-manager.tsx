'use client';
// Native anchor like the rest of the workspace: vinext's Link prefetch crashed here ("ee is not a function").
import {ArrowUpRight,Layers3} from 'lucide-react';
import {hierarchyInDepartment,roleLabel,type Department} from '@/lib/department-directory';
import type {Position} from '@/lib/positions';
import HierarchyBadge from '@/components/hierarchy-badge';
type Person={userId:string|null;name:string;role:string};
export default function DepartmentsManager({initialDepartments,positions,people,canManage}:{initialDepartments:Department[];positions:Position[];people:Person[];planned?:unknown[];canManage:boolean}){
 return <><div className="department-overview"><div><Layers3 size={19}/><span>6 დეპარტამენტი · ერთიანი გუნდი</span></div><p>ყველა დეპარტამენტის უმაღლესი თანამდებობა ექვემდებარება დამფუძნებელს. ერთ დონეზე მდგომი შტატები თანაბარ საფეხურზეა.</p>{canManage&&<a href="/admin/positions">შტატებისა და უფლებების მართვა <ArrowUpRight size={16}/></a>}</div><div className="department-grid">{initialDepartments.map(department=>{
  const roles=hierarchyInDepartment(positions,department.id),maxLevel=Math.max(1,...roles.map(r=>r.displayLevel)),levels=[...new Set(roles.map(r=>r.displayLevel))];
  const memberCount=people.filter(p=>roles.some(r=>r.active&&r.name===p.role)).length;
  return <article className="department-card" key={department.id}><div className="department-title-row"><h2>{department.name}</h2><span>{roles.length} შტატი</span></div><p>{department.description}</p>
   <div className="hierarchy-tree"><div className="hierarchy-tier founder"><HierarchyBadge level={0} maxLevel={maxLevel}/><div className="hierarchy-tier-roles"><strong>{roleLabel('Owner')}</strong><small>ყველა დეპარტამენტის ზემდგომი</small></div></div>
    {levels.map(level=><div className="hierarchy-tier" key={level}><HierarchyBadge level={level} maxLevel={maxLevel}/><div className="hierarchy-tier-roles">{roles.filter(r=>r.displayLevel===level).map(role=><div className="hierarchy-role" key={role.name}><strong>{roleLabel(role.name)}</strong><small>ექვემდებარება: {roleLabel(role.reportsTo)}</small>{!role.active&&<em>არააქტიური</em>}</div>)}</div></div>)}
   </div>
   <details className="department-members"><summary>რეგისტრირებული გუნდი · {memberCount}</summary>{roles.filter(r=>r.active).flatMap(role=>people.filter(p=>p.role===role.name).map(person=><div className="department-person" key={role.name+(person.userId||person.name)}><strong>{person.name}</strong><small>{roleLabel(person.role)}</small></div>))}{!memberCount&&<p>ამ დეპარტამენტში ჯერ აქტიური თანამშრომელი არ არის.</p>}</details>
  </article>;
 })}</div></>;
}
