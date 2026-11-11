import type {PermissionKey} from './permissions';
export const featureCatalog=[
 {key:'work',label:'Work · დავალებები და ქოლშითები',description:'დეპარტამენტების დაფები, დამტკიცებები, პირადი დავალებები და კონტაქტები',group:'სამუშაო სივრცე'},
 {key:'notifications',label:'შეტყობინებები',description:'ზარი, ბანერი და Push შეტყობინებები',group:'კომუნიკაცია'},
 {key:'teamChat',label:'მთავარი ჩატი',description:'საერთო ჩატის ნახვა და გაგზავნა',group:'კომუნიკაცია'},
 {key:'privateChats',label:'პირადი ჩატები',description:'პირადი მიმოწერა',group:'კომუნიკაცია'},
 {key:'groups',label:'ჯგუფური ჩატები',description:'ჯგუფების ნახვა და შექმნა',group:'კომუნიკაცია'},
 {key:'calls',label:'აუდიო და ვიდეოზარები',description:'ახალი ზარები და მიმდინარე ზარების დასრულება',group:'კომუნიკაცია'},
 {key:'uploads',label:'ჩატის ფაილები',description:'ფოტოებისა და ხმოვანი შეტყობინებების ატვირთვა',group:'სამუშაო სივრცე'},
 {key:'shoots',label:'გადაღებების მოდული',description:'გადაღებები და მათი მართვა',group:'სამუშაო სივრცე'},
 {key:'map',label:'გუნდის რუკა',description:'რუკა, ადგილები და პინები',group:'სამუშაო სივრცე'},
 {key:'attendance',label:'დასწრების აღრიცხვა',description:'ოფისში მოსვლა, სამუშაო საათები და დასწრების მოთხოვნები',group:'სამუშაო სივრცე'},
 {key:'youtubeShortcut',label:'YouTube არხის ღილაკი',description:'არხზე სწრაფი გადასვლა მთავარი გვერდიდან',group:'საიტი'},
 {key:'registration',label:'ახალი რეგისტრაცია',description:'ახალი ანგარიშების შექმნა',group:'საიტი'},
 {key:'mascot',label:'კაცუნა',description:'ინტერაქტიური პერსონაჟის ჩართვის შესაძლებლობა',group:'საიტი'},
] as const;
export type FeatureKey=typeof featureCatalog[number]['key'];
export type SiteFeatures=Record<FeatureKey,boolean>&{removedPermissions?:string[]};
export type FunctionState={features:SiteFeatures;removedFeatures:FeatureKey[];removedPermissions:string[];revision:number;history:{action:string;target:string;created:number}[]};
export const defaultFeatures=Object.fromEntries(featureCatalog.map(f=>[f.key,true])) as Record<FeatureKey,boolean>;
export const systemPermissionCatalog=[
 {key:'accounts.manage',label:'ანგარიშის დამტკიცება და დეაქტივაცია',group:'ანგარიშები',grants:['accounts.view','accounts.manage']},
 {key:'accounts.delete',label:'არადაცული ანგარიშის წაშლა',group:'ანგარიშები',grants:['accounts.view','accounts.delete']},
 {key:'workforce.manage',label:'თანამშრომლები, შტატები და დეპარტამენტები',group:'მონაცემების მართვა',grants:['employees.view','employees.manage','positions.view','positions.manage','departments.view','departments.manage']},
 {key:'production.manage',label:'გადაღებები და დავალებები',group:'მონაცემების მართვა',grants:['shoots.view','shoots.create','shoots.edit','shoots.delete']},
 {key:'calendar.manage',label:'კალენდარი, შვებულებები და დასწრება',group:'მონაცემების მართვა',grants:['calendar.view','calendar.manage','attendance.view','attendance.manage','office.manage','map.manage']},
 {key:'recruitment.manage',label:'ვაკანსიები და განაცხადები',group:'მონაცემების მართვა',grants:['applications.view','applications.edit','applications.delete']},
 {key:'inbox.manage',label:'მთავარი საიტის შემოსულები',group:'მონაცემების მართვა',grants:['inbox.view','inbox.manage']},
 {key:'analytics.view',label:'საიტისა და სოციალური მედიის ანალიტიკა',group:'მონაცემების მართვა',grants:['analytics.view','social.view','youtube.view']},
 {key:'social.manage',label:'სოციალური ქსელების პარამეტრები',group:'მონაცემების მართვა',grants:['social.view','social.manage','youtube.view','youtube.manage']},
 ...featureCatalog.map(f=>({key:`features.${f.key}`,label:`${f.label} — ჩართვა / გამორთვა`,group:'ფუნქციების მართვა',grants:[] as string[]})),
];
export type SystemPermission=string;
export const systemPermissionKeys=systemPermissionCatalog.map(p=>p.key);
export function validSystemPermissions(v:unknown):v is string[]{return Array.isArray(v)&&v.every(k=>typeof k==='string'&&systemPermissionKeys.includes(k))}
export function parseSystemPermissions(value:string|null|undefined):string[]{if(value==null)return [...systemPermissionKeys];try{const v=JSON.parse(value);return validSystemPermissions(v)?[...new Set(v)]:[]}catch{return []}}
export function systemGrants(keys:readonly string[]):PermissionKey[]{return [...new Set(['workspace.view','admin.view',...systemPermissionCatalog.filter(p=>keys.includes(p.key)).flatMap(p=>p.grants)])] as PermissionKey[]}
export function parseFeatureState(raw:string|null|undefined){
 let v:Record<string,unknown>={};try{const parsed=JSON.parse(raw||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))v=parsed}catch{}
 const removed=(key:string)=>{const value=v[key];return value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value).filter(k=>(value as Record<string,unknown>)[k]!=null):[]};
 const removedFeatures=removed('_removedFeatures').filter(k=>featureCatalog.some(f=>f.key===k)) as FeatureKey[],removedPermissions=removed('_removedPermissions');
 const features:SiteFeatures=Object.fromEntries(featureCatalog.map(f=>[f.key,v[f.key]!==false&&!removedFeatures.includes(f.key)])) as Record<FeatureKey,boolean>;
 if(removedPermissions.length)features.removedPermissions=removedPermissions;
 return {features,removedFeatures,removedPermissions};
}
export function parseFeatures(raw:string|null|undefined):SiteFeatures{return parseFeatureState(raw).features}
export type SystemActor={isDeveloper?:boolean;isSiteAdmin?:boolean;isApprovedStaff?:boolean;isApproved?:boolean;systemPermissions?:readonly string[];features?:Partial<SiteFeatures>};
export function canControl(actor:SystemActor|null|undefined,key:string){return !!actor&&actor.isApproved!==false&&actor.isApprovedStaff!==false&&(actor.isDeveloper||!!actor.isSiteAdmin&&!!actor.systemPermissions?.includes(key))}
export function threadEnabled(id:string,features?:Partial<SiteFeatures>){return id==='team'?features?.teamChat!==false:id.startsWith('dm_')?features?.privateChats!==false:id.startsWith('grp_')?features?.groups!==false:true}
export function featureBlocks(key:string,f?:Partial<SiteFeatures>){return !!f&&(f.removedPermissions?.includes(key)||(key==='map.manage'&&f.map===false)||((key.startsWith('attendance.')||key==='office.manage')&&f.attendance===false)||(key==='chat.call'&&f.calls===false)||(key==='chat.attach'&&f.uploads===false)||(key==='chat.create_group'&&f.groups===false)||(key.startsWith('shoots.')&&f.shoots===false)||(key.startsWith('chat.')&&f.teamChat===false&&f.privateChats===false&&f.groups===false))}
export function publicRole(role:string|null|undefined){return ['Developer','Administrator'].includes(role||'')?'თანამშრომელი':role||'თანამშრომელი'}
