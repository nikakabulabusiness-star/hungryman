import {featureBlocks,type SiteFeatures} from './site-controls';
import {isSubordinateRole} from './department-directory';
/** Shared permission catalog. All role settings are validated and enforced on the server. */
export const permissionGroups=[
 {id:'workspace',label:'სამუშაო სივრცე და პირადი კაბინეტი',permissions:[
  {key:'workspace.view',label:'სამუშაო სივრცის გახსნა'},
  {key:'cabinet.view',label:'პირადი კაბინეტის ნახვა'},
  {key:'cabinet.notes',label:'საკუთარი პირადი ნოუთების მართვა'},
  {key:'cabinet.leave.request',label:'შვებულების / დეი ოფის / ბიულეტენის მოთხოვნა'},
 ]},
 {id:'chat',label:'ჩატი და კომუნიკაცია',permissions:[
  {key:'chat.view',label:'საკუთარი ჩატების ნახვა'},
  {key:'chat.send',label:'შეტყობინება, პირადი ჩატი და რეაქციები'},
  {key:'chat.attach',label:'ფოტოს, ფაილისა და ვოისის გაგზავნა'},
  {key:'chat.call',label:'აუდიო და ვიდეოზარები'},
  {key:'chat.create_group',label:'ჯგუფური ჩატის შექმნა'},
  {key:'chat.manage_group',label:'საკუთარი ჯგუფის სახელის, ფოტოსა და წევრების მართვა'},
  {key:'chat.department_group',label:'დეპარტამენტის ჯგუფში დამატება'},
  {key:'chat.moderate',label:'ჩატის შეტყობინებების მოდერაცია და აპინვა'},
  {key:'chat.delete_group',label:'ჯგუფის სამუდამოდ წაშლა ყველა მონაწილისთვის'},
 ]},
 {id:'shoots',label:'გადაღებები',permissions:[
  {key:'shoots.view',label:'გადაღებების ნახვა'},
  {key:'shoots.create',label:'გადაღების შექმნა'},
  {key:'shoots.edit',label:'გადაღებისა და დავალებების რედაქტირება'},
  {key:'shoots.delete',label:'გადაღების წაშლა'},
 ]},
 {id:'calendar',label:'კალენდარი, დასწრება და ოფისი',permissions:[
  {key:'calendar.view',label:'კალენდრის ნახვა'},
  {key:'calendar.manage',label:'კალენდრის, შვებულებისა და სამუშაო დღეების მართვა'},
  {key:'attendance.view',label:'გუნდის დასწრების ანალიტიკა'},
  {key:'attendance.manage',label:'დასწრების ჩანაწერების მართვა'},
  {key:'office.manage',label:'ოფისის მდებარეობისა და პარამეტრების მართვა'},
  {key:'map.manage',label:'რუკაზე მნიშვნელოვანი ადგილების, პინებისა და ფოტოების მართვა'},
 ]},
 {id:'admin',label:'ადმინისტრატორის პანელი',permissions:[
  {key:'admin.view',label:'ადმინისტრატორის პანელში შესვლა'},
  {key:'applications.view',label:'კანდიდატებისა და განაცხადების ნახვა'},
  {key:'applications.edit',label:'კანდიდატებისა და ვაკანსიების მართვა'},
  {key:'applications.delete',label:'განაცხადების წაშლა'},
  {key:'inbox.view',label:'მთავარი საიტის შეტყობინებების, კასტინგისა და ფოსტის ნახვა'},
  {key:'inbox.manage',label:'მთავარი საიტის შემოსული ჩანაწერების სტატუსის მართვა'},
  {key:'analytics.view',label:'შიდა ანალიტიკის ნახვა'},
 ]},
 {id:'people',label:'ანგარიშები, თანამშრომლები და სტრუქტურა',permissions:[
  {key:'accounts.view',label:'ანგარიშებისა და მოთხოვნების ნახვა'},
  {key:'accounts.manage',label:'ანგარიშის დამტკიცება, შეჩერება და შტატის მინიჭება'},
  {key:'accounts.delete',label:'ანგარიშის წაშლა — იერარქიის დაცვით'},
  {key:'employees.view',label:'თანამშრომლების ინფორმაციის ნახვა'},
  {key:'employees.manage',label:'თანამშრომლის დამატება და ინფორმაციის მართვა'},
  {key:'positions.view',label:'შტატებისა და უფლებების ნახვა'},
  {key:'positions.manage',label:'დაქვემდებარებული შტატებისა და უფლებების მართვა'},
  {key:'departments.view',label:'დეპარტამენტების ნახვა'},
  {key:'departments.manage',label:'დეპარტამენტების ხელმძღვანელებისა და სტრუქტურის მართვა'},
 ]},
 {id:'social',label:'სოციალური მედია და YouTube',permissions:[
  {key:'social.view',label:'სოციალური ქსელების ანალიტიკის ნახვა'},
  {key:'social.manage',label:'სოციალური ქსელების ბმულებისა და მაჩვენებლების მართვა'},
  {key:'youtube.view',label:'YouTube ანალიტიკის ნახვა და ანგარიშის ჩამოტვირთვა'},
  {key:'youtube.manage',label:'YouTube კავშირის მართვა'},
 ]},
] as const;
export type PermissionKey=typeof permissionGroups[number]['permissions'][number]['key'];
export const permissionKeys:PermissionKey[]=permissionGroups.flatMap(group=>group.permissions.map(item=>item.key));
const knownKeys=new Set<string>(permissionKeys);
export type PermissionActor={role?:string|null;email?:string;isDeveloper?:boolean;isSiteAdmin?:boolean;systemPermissions?:readonly string[];features?:Partial<SiteFeatures>;isOwner?:boolean;isApprovedStaff?:boolean;isApproved?:boolean;permissions?:readonly PermissionKey[]};
const baseline:PermissionKey[]=['workspace.view','cabinet.view','cabinet.notes','cabinet.leave.request','chat.view','chat.send','chat.attach','chat.call','chat.create_group','chat.manage_group','shoots.view','calendar.view','departments.view'];
export function defaultPermissions(role:string|null):PermissionKey[]{
 if(!role)return [];
 if(role==='Owner'||role==='Developer'||role==='HR')return [...permissionKeys];
 const keys=new Set<PermissionKey>(baseline);
 if(['კრეატიული დირექტორი','პროდიუსერი'].includes(role))keys.add('chat.delete_group');
 if(['კრეატიული დირექტორი','პროდიუსერი','რეჟისორი'].includes(role)){keys.add('shoots.create');keys.add('shoots.edit')}
 if(['კრეატიული დირექტორი','ადმინისტრატორი'].includes(role))for(const key of ['admin.view','applications.view','applications.edit','analytics.view'] as const)keys.add(key);
 if(role==='კრეატიული დირექტორი')for(const key of ['applications.delete','positions.view','positions.manage','chat.department_group','chat.moderate'] as const)keys.add(key);
 if(role==='ტექნიკური დირექტორი')keys.add('chat.department_group');
 if(['Content Creator','სოციალური მედია'].includes(role))for(const key of ['social.view','social.manage','youtube.view'] as const)keys.add(key);
 return [...keys];
}
export function validPermissionKeys(value:unknown):value is PermissionKey[]{return Array.isArray(value)&&value.every(key=>typeof key==='string'&&knownKeys.has(key))}
export function normalizePermissions(value:readonly PermissionKey[]):PermissionKey[]{const set=new Set(value);return permissionKeys.filter(key=>set.has(key))}
export const permissionDependencies:Partial<Record<PermissionKey,PermissionKey[]>>={
 'chat.delete_group':['chat.view'],'map.manage':['workspace.view'],
 'cabinet.view':['workspace.view'],'cabinet.notes':['cabinet.view'],'cabinet.leave.request':['cabinet.view'],
 'chat.view':['workspace.view'],'chat.send':['chat.view'],'chat.attach':['chat.view','chat.send'],'chat.call':['chat.view'],'chat.create_group':['chat.view','chat.send'],'chat.manage_group':['chat.view'],'chat.department_group':['chat.create_group'],'chat.moderate':['chat.view'],
 'shoots.view':['workspace.view'],'shoots.create':['shoots.view'],'shoots.edit':['shoots.view'],'shoots.delete':['shoots.view'],
 'calendar.view':['workspace.view'],'calendar.manage':['calendar.view'],
 'inbox.view':['admin.view'],'inbox.manage':['inbox.view'],
 'admin.view':['workspace.view'],'applications.view':['admin.view'],'applications.edit':['applications.view'],'applications.delete':['applications.view'],'analytics.view':['admin.view'],
 'accounts.view':['admin.view'],'accounts.manage':['accounts.view'],'accounts.delete':['accounts.view'],
 'employees.view':['admin.view'],'employees.manage':['employees.view'],
 'positions.view':['admin.view'],'positions.manage':['positions.view'],
 'departments.view':['workspace.view'],'departments.manage':['departments.view','admin.view'],
 'attendance.view':['admin.view'],'attendance.manage':['attendance.view'],'office.manage':['admin.view'],
 'social.view':['workspace.view'],'social.manage':['social.view'],'youtube.view':['workspace.view'],'youtube.manage':['youtube.view'],
};
export function hasPermission(actor:PermissionActor|null|undefined,key:PermissionKey):boolean{
 if(!actor||actor.isApprovedStaff===false||actor.isApproved===false)return false;
 if(featureBlocks(key,actor.features))return false;
 if(actor.isDeveloper!==true&&!actor.permissions?.includes(key))return false;
 return (permissionDependencies[key]||[]).every(required=>hasPermission(actor,required));
}
/** These are required to reach the recovery controls; business actions remain removable. */
export const protectedSystemPermissions:readonly PermissionKey[]=['workspace.view','admin.view'];
export function canManageRole(actor:PermissionActor|null|undefined,targetRole:string):boolean{
 if(!actor||targetRole==='Developer'||!(hasPermission(actor,'positions.manage')||hasPermission(actor,'accounts.manage')))return false;
 if(actor.isDeveloper)return true;
 if(targetRole==='Owner')return false;
 if(actor.isSiteAdmin)return true;
 if(targetRole===actor.role)return false;
 if(actor.role==='Owner')return true;
 if(actor.role==='HR')return targetRole!=='HR';
 return isSubordinateRole(actor.role||'',targetRole);
}
export const canManagePosition=canManageRole;
export function validatePermissionGrant(actor:PermissionActor,targetRole:string,keys:unknown):string|null{
 if(!canManageRole(actor,targetRole))return 'ამ შტატის უფლებების მართვის უფლება არ გაქვს.';
 if(!validPermissionKeys(keys))return 'უფლებების სია არასწორია.';
 const granted={permissions:keys};
 if(keys.some(key=>!hasPermission(granted,key)))return 'მოქმედების უფლებას შესაბამისი გვერდის ნახვის უფლებაც სჭირდება.';
 if(!actor.isDeveloper&&keys.some(key=>!hasPermission(actor,key)))return 'მხოლოდ იმ უფლებების მინიჭება შეგიძლია, რომლებიც თავად გაქვს.';
 return null;
}
export function canDeleteAccount(actor:PermissionActor|null|undefined,targetRole:string|null,targetEmail?:string):boolean{
 if(!hasPermission(actor,'accounts.delete'))return false;
 if(targetRole==='Developer'||targetEmail?.toLowerCase()==='nikolozkabulashvili0@gmail.com')return false;
 if(actor?.isDeveloper)return true;
 if(targetRole==='Owner')return false;
 if(actor?.isSiteAdmin)return true;
 if(actor?.role==='Owner')return true;
 return actor?.role==='HR'&&targetRole!=='Owner';
}
