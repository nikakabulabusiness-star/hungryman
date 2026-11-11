import {threadEnabled} from '../../../lib/site-controls';
import {api,ApiError} from './api';
import {cacheScope,clearPersistentResources,openPersistentResources,persistResource} from './persistent-resources';
import {snapshotKind} from './resource-snapshot';
import {hasPermission} from './permissions';
import type {Session} from './types';
type Entry<T=unknown>={data:T|null;error:string;loading:boolean;updated:number;cached:boolean;flight?:Promise<void>};
let epoch=0,identity='';
export function resourceEpoch(){return epoch}
const entries=new Map<string,Entry>(),listeners=new Map<string,Set<()=>void>>();
const empty=():Entry=>({data:null,error:'',loading:true,updated:0,cached:false});
export function resourceEntry<T>(path:string):Entry<T>{if(!entries.has(path))entries.set(path,empty());return entries.get(path) as Entry<T>}
function emit(path:string){listeners.get(path)?.forEach(fn=>fn())}
export function subscribeResource(path:string,fn:()=>void){const set=listeners.get(path)||new Set();set.add(fn);listeners.set(path,set);return()=>{set.delete(fn)}}
function save(path:string,entry:Entry){if(entry.data&&snapshotKind(path))persistResource({path,data:entry.data,updated:entry.updated})}
export function setResource<T>(path:string,value:T|null|((old:T|null)=>T|null),options:{verified?:boolean}={}){
 const current=resourceEntry<T>(path),data=typeof value==='function'?(value as (old:T|null)=>T|null)(current.data):value;
 if(data===current.data&&!current.loading&&!options.verified)return;
 const next={...current,data,loading:false,error:options.verified?'':current.error,cached:options.verified?false:current.cached,updated:options.verified||!current.updated?Date.now():current.updated};entries.set(path,next);emit(path);if(options.verified&&(data!==current.data||current.cached))save(path,next);
}
export function clearResources(){epoch++;identity='';clearPersistentResources();for(const path of entries.keys()){entries.set(path,empty());emit(path)}}
/** Only call after /mobile/me has verified this session online. No auth state is read from disk. */
export async function activateResourceCache(session:Session){
 if(!session.permissions?.isApprovedStaff){clearResources();return}
 const next=JSON.stringify([session.user.userId,session.user.role,session.user.status,session.permissions]);if(next===identity)return;
 if(identity)clearResources();identity=next;const version=epoch,scope=await cacheScope(next);if(version!==epoch||identity!==next)return;
 const values=await openPersistentResources(scope);if(version!==epoch||identity!==next)return;
 const can=(key:Parameters<typeof hasPermission>[1])=>hasPermission(session.permissions,key);
 for(const e of values){const kind=snapshotKind(e.path);if(((kind==='shoots'||kind==='shoot')&&!can('shoots.view'))||((kind==='messages'||kind==='conversations')&&!can('chat.view')))continue;
  const data=e.data as Record<string,unknown>;
  // Permissions are reconstructed from the newly verified session, never the snapshot.
  if(kind==='conversations'&&Array.isArray(data.conversations))data.conversations=data.conversations.filter((c: {id:string})=>threadEnabled(c.id,session.permissions?.features));
  if(kind==='conversations')data.permissions={canSend:can('chat.send'),canAttach:can('chat.attach'),canCall:can('chat.call'),canDirect:session.permissions?.features?.privateChats!==false&&can('chat.send'),canCreateGroups:can('chat.create_group'),canManageGroups:can('chat.manage_group'),canSelectDepartments:can('chat.department_group'),canModerate:can('chat.moderate')};
  if(kind==='shoots')data.permissions={canCreate:can('shoots.create'),canEdit:can('shoots.edit'),canDelete:can('shoots.delete')};
  if(kind==='messages'&&!threadEnabled(new URL(e.path,'https://local.test').searchParams.get('conversationId')||'team',session.permissions?.features))continue;
  if(!resourceEntry(e.path).data){entries.set(e.path,{data,error:'',loading:false,updated:e.updated,cached:true});emit(e.path)}
 }
}
export async function refreshResource(path:string){const current=resourceEntry(path);if(current.flight)return current.flight;const version=epoch;const task=(async()=>{try{const data=await api(path);if(epoch!==version)return;const next={data,error:'',loading:false,updated:Date.now(),cached:false};entries.set(path,next);emit(path);save(path,next)}catch(e){if(epoch!==version)return;if(e instanceof ApiError&&(e.status===401||e.status===403||(e.status===404&&!!snapshotKind(path)))){clearResources();entries.set(path,{...empty(),loading:false,error:e.message});emit(path);return}entries.set(path,{...current,error:(e as Error).message,loading:false,flight:undefined});emit(path)}})();current.flight=task;return task}
export function prefetchResource(path:string,maxAge=15_000){const e=resourceEntry(path);if(e.cached||Date.now()-e.updated>maxAge)return refreshResource(path);return Promise.resolve()}
