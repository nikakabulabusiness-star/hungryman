/** Shared organization model for the website and Expo app. Owner remains the internal authorization key. */
export const founderLabel='დამფუძნებელი';
export function roleLabel(role:string|null|undefined){return role==='Developer'||role==='Administrator'?'თანამშრომელი':role==='Owner'?founderLabel:role||''}
export const departmentDefinitions=[
 {id:'production',name:'პოსტ ფროდაქშენი',order:0,headName:founderLabel,directorName:'პროდიუსერი',description:'მონტაჟი და ვიდეოს საბოლოო დამუშავება.'},
 {id:'story',name:'სცენარი და ორგანიზება',order:1,headName:founderLabel,directorName:'პროდიუსერი',description:'სცენარი, რეჟისურა და გადაღების ორგანიზება.'},
 {id:'technical',name:'ტექნიკური მართვა',order:2,headName:founderLabel,directorName:'ტექნიკური დირექტორი',description:'ტექნიკური მართვა და მხარდაჭერა.'},
 {id:'preproduction',name:'პრე ფროდაქშენი',order:3,headName:founderLabel,directorName:'პროდიუსერი',description:'გადაღებისთვის მომზადება და დაგეგმვა.'},
 {id:'hr',name:'ადამიანური რესურსები',order:4,headName:founderLabel,directorName:'HR',description:'თანამშრომლები და ადამიანური რესურსების მართვა.'},
 {id:'social',name:'სოც მედია და კონტენტი',order:5,headName:founderLabel,directorName:'',description:'სოციალური ქსელები და კონტენტის შექმნა.'},
] as const;
/** List headings for accounts outside departments; these are not additional departments. */
export const staffGroupingDefinitions=[{id:'leadership',name:founderLabel,order:-1},...departmentDefinitions,{id:'other',name:'დეპარტამენტის გარეშე',order:99}];
export type DepartmentId=typeof departmentDefinitions[number]['id'];
export type Department={id:string;name:string;order:number;headName:string;directorName:string;description:string;headUserId:string|null;directorUserId:string|null};
export type DepartmentMembership={departmentId:string;level:number;reportsTo:string};
const chains:Record<DepartmentId,readonly (readonly string[])[]>={
 production:[['პროდიუსერი'],['Senior Editor'],['Video Editor','Shorts Video Editor']],
 story:[['პროდიუსერი'],['რეჟისორი'],['კრეატიული დირექტორი'],['პროდიუსერის ასისტენტი'],['სცენარისტი','ორგანიზატორი']],
 technical:[['ტექნიკური დირექტორი']],
 preproduction:[['პროდიუსერი'],['კრეატიული დირექტორი'],['პროდიუსერის ასისტენტი'],['ორგანიზატორი','ოპერატორი']],
 hr:[['HR']],social:[['სოციალური მედია','Content Creator']],
};
export function defaultMemberships(role:string|null|undefined):DepartmentMembership[]{
 return departmentDefinitions.flatMap(d=>{const level=chains[d.id].findIndex(tier=>tier.includes(role||''));return level<0?[]:[{departmentId:d.id,level:level+1,reportsTo:level===0?'Owner':chains[d.id][level-1][0]}]});
}
export function departmentForRole(role:string|null|undefined):string{return role==='Owner'||role==='Developer'?'leadership':defaultMemberships(role)[0]?.departmentId||'other'}
export function hierarchyForRole(role:string):number{return role==='Owner'||role==='Developer'?0:defaultMemberships(role)[0]?.level||1}
export function reportsToForRole(role:string,departmentId?:string):string|null{return defaultMemberships(role).find(m=>!departmentId||m.departmentId===departmentId)?.reportsTo||null}
export type HierarchyPosition={name:string;active:boolean;departmentId:string;rank:number;reportsTo:string|null;memberships?:DepartmentMembership[]};
export function membershipsForPosition(position:HierarchyPosition):DepartmentMembership[]{
 if(position.name==='Owner'||position.name==='Developer')return [];
 if(position.memberships)return position.memberships;
 const defaults=defaultMemberships(position.name);
 return defaults.length?defaults:departmentDefinitions.some(d=>d.id===position.departmentId)?[{departmentId:position.departmentId,level:position.rank||1,reportsTo:position.reportsTo||'Owner'}]:[];
}
function roleOrder(name:string,departmentId:string){const index=chains[departmentId as DepartmentId]?.flat().indexOf(name)??-1;return index<0?999:index}
export function hierarchyInDepartment<T extends HierarchyPosition>(positions:readonly T[],departmentId:string){
 const rows=positions.flatMap(position=>{const membership=membershipsForPosition(position).find(m=>m.departmentId===departmentId);return membership?[{...position,...membership}]:[]}).sort((a,b)=>a.level-b.level||roleOrder(a.name,departmentId)-roleOrder(b.name,departmentId)||a.name.localeCompare(b.name,'ka'));
 const tiers=[...new Set(rows.map(row=>row.level))];
 return rows.map(row=>({...row,displayLevel:tiers.indexOf(row.level)+1,maxLevel:tiers.length}));
}
/** Hue moves from red to green; the visible number also communicates hierarchy without color. */
export function levelColor(level:number,maxLevel:number){return `hsl(${Math.round(Math.max(0,Math.min(1,level/Math.max(1,maxLevel)))*145)}, 72%, 62%)`}
export function isSubordinateRole(actorRole:string,targetRole:string){
 const actor=defaultMemberships(actorRole),target=defaultMemberships(targetRole);
 const shared=target.flatMap(t=>actor.filter(a=>a.departmentId===t.departmentId).map(a=>({a,t})));
 return shared.length>0&&shared.every(({a,t})=>t.level>a.level);
}
// Planned names never grant access. Existing employee identities remain in their account records.
export const plannedDepartmentMembers=[] as {name:string;role:string;departmentId:string;capabilities:string[];reportsTo:string;verified:boolean}[];
