/** Disk data is a bounded display snapshot. It never supplies authentication or permissions. */
export const SNAPSHOT_TTL = 7 * 24 * 60 * 60 * 1000;
export const SNAPSHOT_LIMIT = 2 * 1024 * 1024;
export type ResourceSnapshot = {path:string;data:unknown;updated:number};
const record = (value:unknown):Record<string,unknown> => value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
const list = (value:unknown):unknown[] => Array.isArray(value) ? value : [];
function fields(value:unknown, keys:string[]) {const source=record(value),out:Record<string,unknown>={};for(const key of keys){const v=source[key];if(v===null||typeof v==='boolean'||typeof v==='number'||typeof v==='string')out[key]=typeof v==='string'?v.slice(0,12000):v}return out}
export function snapshotKind(path:string):'messages'|'conversations'|'shoots'|'shoot'|null {
 if(path==='/api/shoots')return 'shoots';
 if(/^\/api\/shoots\/[A-Za-z0-9_%-]{1,120}$/.test(path))return 'shoot';
 if(path==='/api/chat/conversations')return 'conversations';
 if(path==='/api/chat/messages'||/^\/api\/chat\/messages\?conversationId=[A-Za-z0-9_%.-]{1,220}$/.test(path))return 'messages';
 return null;
}
function message(value:unknown) {const source=record(value);if(source.delivery||typeof source.id!=='string')return null;return {...fields(source,['id','authorUserId','authorName','authorRole','body','kind','referenceId','created','pinned','conversationId','replyTo','attachmentId','durationMs']),reply:source.reply?fields(source.reply,['id','body','authorName','kind']):null,reactions:list(source.reactions).slice(0,20).map(r=>fields(r,['emoji','count','mine']))}}
function person(value:unknown) {return {...fields(value,['userId','name','role','handle','departmentId','hasAvatar']),active:false}}
export function sanitizeSnapshot(path:string,value:unknown):unknown|null {
 const source=record(value),kind=snapshotKind(path);if(!kind||!value)return null;
 if(kind==='shoot'){const data=sanitizeSnapshot('/api/shoots',{shoots:[source.shoot]}) as {shoots:unknown[]};return {shoot:data.shoots[0]}}
 if(kind==='messages')return {historyStart:Number(source.historyStart)||0,hasMore:!!source.hasMore||list(source.messages).length>160,messages:list(source.messages).map(message).filter(Boolean).slice(-160),pinned:list(source.pinned).map(message).filter(Boolean).slice(-30)};
 if(kind==='conversations')return {conversations:list(source.conversations).slice(0,150).map(v=>{const c=record(v);return {...fields(c,['id','title','type','unread']),peer:c.peer?person(c.peer):null,last:c.last?fields(c.last,['body','created','author_user_id','kind']):null,settings:fields(c.settings,['emoji','photoId','updated'])}}),people:list(source.people).slice(0,300).map(person),departments:list(source.departments).slice(0,80).map(d=>fields(d,['id','name']))};
 return {shoots:list(source.shoots).slice(0,150).map(v=>{const s=record(v);return {...fields(s,['id','title','shoot_date','start_time','end_time','location_name','photo_id','details','status']),location_url:null,tasks:list(s.tasks).slice(0,100).map(t=>fields(t,['id','assignee_email','assignee_name','assignee_role','task','status']))}}),people:list(source.people).slice(0,300).map(p=>fields(p,['userId','email','fullName','role','hasAvatar','profileUpdated']))};
}
export function boundSnapshots(values:ResourceSnapshot[],now=Date.now()):ResourceSnapshot[] {
 let size=0;return values.filter(e=>snapshotKind(e.path)&&Number.isFinite(e.updated)&&e.updated<=now+60_000&&now-e.updated<SNAPSHOT_TTL).sort((a,b)=>b.updated-a.updated).slice(0,30).flatMap(e=>{const data=sanitizeSnapshot(e.path,e.data);if(!data)return [];const item={...e,data},bytes=JSON.stringify(item).length*3;if(bytes>512*1024||size+bytes>SNAPSHOT_LIMIT)return [];size+=bytes;return [item]});
}
export function decodeSnapshots(raw:string,scope:string,now=Date.now()):ResourceSnapshot[] {
 if(raw.length>SNAPSHOT_LIMIT)return [];const envelope=record(JSON.parse(raw));if(envelope.version!==1||envelope.scope!==scope)return [];
 return boundSnapshots(list(envelope.entries).filter(v=>{const e=record(v);return typeof e.path==='string'&&typeof e.updated==='number'}) as ResourceSnapshot[],now);
}
