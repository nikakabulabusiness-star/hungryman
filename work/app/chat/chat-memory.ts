// Tab-memory only. Never persist staff chat contents in browser storage.
const entries=new Map<string,{value:unknown;expires:number}>();
const MAX_ENTRIES=24,TTL=60000;
const key=(user:string,path:string)=>JSON.stringify([user,path]);
export function readChatMemory<T>(user:string,path:string):T|undefined{
 const item=entries.get(key(user,path));
 return user&&item&&item.expires>Date.now()?item.value as T:undefined;
}
export function writeChatMemory<T>(user:string,path:string,value:T){
 if(!user||typeof window==='undefined')return;
 const id=key(user,path);entries.delete(id);entries.set(id,{value,expires:Date.now()+TTL});
 while(entries.size>MAX_ENTRIES)entries.delete(entries.keys().next().value!);
}
export function clearChatMemory(user?:string,path?:string){
 if(!user){entries.clear();return}
 if(path){entries.delete(key(user,path));return}
 for(const id of entries.keys())if(JSON.parse(id)[0]===user)entries.delete(id);
}
if(typeof window!=='undefined'){
 window.addEventListener('pagehide',()=>clearChatMemory());
 window.addEventListener('hmw:session-ended',()=>clearChatMemory());
}
