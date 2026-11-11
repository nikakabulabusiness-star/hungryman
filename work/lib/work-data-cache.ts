/** Short-lived display snapshots in this tab only. Never persists personal data or auth. */
export function cacheableWorkPath(path:string){
 if(path==='/api/shoots'||path==='/api/chat/messages'||path==='/api/notifications?counts=1')return true;
 return /^\/api\/calendar\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/.test(path);
}
export class WorkRequestError extends Error{constructor(message:string,readonly status=0){super(message)}}
export function createWorkDataCache(fetcher:typeof fetch,now=Date.now){
 let account:string|null=null,epoch=0,identity=0;
 const listeners=new Set<()=>void>(),entries=new Map<string,{data:unknown;expires:number;bytes:number}>(),pending=new Map<string,Promise<unknown>>(),controllers=new Map<AbortController,string>();
 const reset=(readsOnly=false)=>{epoch++;entries.clear();pending.clear();for(const [c,method] of controllers)if(!readsOnly||method==='GET'){c.abort();controllers.delete(c)}for(const listener of listeners)listener()};
 const setAccount=(next:string|null)=>{if(account===next)return;account=next;identity++;reset()};
 const read=<T>(path:string):T|null=>{const item=entries.get(path);if(!account||!cacheableWorkPath(path)||!item)return null;if(item.expires<=now()){entries.delete(path);return null}return item.data as T};
 function request<T>(path:string,method='GET',body?:unknown):Promise<T>{
  const ticket=epoch,identityTicket=identity,owner=account,eligible=method==='GET'&&!!owner&&cacheableWorkPath(path);
  if(eligible&&pending.has(path))return pending.get(path) as Promise<T>;
  const controller=new AbortController();controllers.set(controller,method);const timeout=setTimeout(()=>controller.abort(),12000);
  let operation!:Promise<T>;operation=Promise.resolve().then(async()=>{try{
   const response=await fetcher(path,{method,cache:'no-store',signal:controller.signal,headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
   const data=await response.json() as Record<string,unknown>;
   if((method==='GET'&&ticket!==epoch)||identityTicket!==identity||owner!==account)throw new WorkRequestError('ანგარიში შეიცვალა.');
   if(!response.ok){if([401,403,404].includes(response.status)){entries.delete(path);if(response.status===401&&account!==null){account=null;identity++;reset()}}throw new WorkRequestError(String(data.error||'მოთხოვნა ვერ შესრულდა'),response.status)}
   if(controller.signal.aborted)throw new WorkRequestError('კავშირი შეფერხდა. სცადე ხელახლა.');
   if(eligible){const bytes=JSON.stringify(data).length*2;if(bytes<=512000){entries.delete(path);entries.set(path,{data,expires:now()+60000,bytes});let total=Array.from(entries.values()).reduce((sum,item)=>sum+item.bytes,0);while(entries.size>24||total>1024000){const first=entries.keys().next().value!;total-=entries.get(first)!.bytes;entries.delete(first)}}}
   if(method!=='GET')reset(true);
   return data as T;
  }catch(error){if(controller.signal.aborted)throw new WorkRequestError('კავშირი შეფერხდა. სცადე ხელახლა.');throw error}
  finally{clearTimeout(timeout);controllers.delete(controller);if(pending.get(path)===operation)pending.delete(path)}});
  if(eligible)pending.set(path,operation);return operation;
 }
 return {request,read,setAccount,clear:()=>reset(),epoch:()=>epoch,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}}};
}
const cache=createWorkDataCache((...args)=>fetch(...args));
export const setWorkDataAccount=cache.setAccount,readWorkData=cache.read,fetchWorkData=cache.request,workDataEpoch=cache.epoch,subscribeWorkData=cache.subscribe;
if(typeof window!=='undefined'){
 const logout=()=>{cache.setAccount(null);cache.clear()};
 window.addEventListener('hmw-work-logout',logout);window.addEventListener('hmw:session-ended',logout);window.addEventListener('pagehide',cache.clear);
}
