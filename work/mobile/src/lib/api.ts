import * as SecureStore from "expo-secure-store";

// Public endpoint only. Never put service credentials or signing keys in an app.
export const API_ORIGIN =
  "https://hungryman-applications-test.hungryman.chatgpt.site";
const TOKEN_KEY = "hungryman.work.session.v1";
let token: string | null = null;
let tokenEpoch=0,tokenWrite:Promise<void>=Promise.resolve();
let previewRole: string | null = null;
export function setPreviewRole(role:string|null){previewRole=role==='Developer'?null:role}
let expired: () => void = () => {};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function onExpired(listener: () => void) {
  expired = listener;
  return () => {
    expired = () => {};
  };
}
export async function restoreToken() {
  const version=tokenEpoch;
  await tokenWrite.catch(()=>{});
  const saved=await SecureStore.getItemAsync(TOKEN_KEY);
  if(version===tokenEpoch)token=saved;
  return token;
}
export async function setToken(value: string | null) {
  tokenEpoch++;
  token=value;
  if(!value)previewRole=null;
  // Serialize writes so a late login write cannot outlive the following logout.
  tokenWrite=tokenWrite.catch(()=>{}).then(()=>value
    ? SecureStore.setItemAsync(TOKEN_KEY,value,{keychainAccessible:SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY})
    : SecureStore.deleteItemAsync(TOKEN_KEY));
  await tokenWrite;
}
async function expireToken(currentToken:string|null){
  if(currentToken!==token)return;
  const version=tokenEpoch+1;
  await setToken(null);
  if(version===tokenEpoch&&token===null)expired();
}
export function chatImageSource(id:string){return {uri:API_ORIGIN+'/api/chat/attachments?id='+encodeURIComponent(id),headers:token?{Authorization:`Bearer ${token}`}:undefined}}
export function avatarSource(userId: string, version = 0) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return {
    uri: `${API_ORIGIN}/api/team/avatar?userId=${encodeURIComponent(userId)}&v=${version}`,
    headers,
    cache: "force-cache" as const,
  };
}

type RequestOptions={method?:string;body?:unknown;public?:boolean;signal?:AbortSignal};
export function api<T>(path:string,options:RequestOptions={}):Promise<T>{return request<T>(path,options,token,previewRole)}
/** Capture only for logout cleanup: late cleanup must never target the next account. */
export function sessionRequest(){const captured=token,role=previewRole;return <T>(path:string,options:RequestOptions={})=>request<T>(path,options,captured,role)}
async function request<T>(path:string,options:RequestOptions,currentToken:string|null,currentRole:string|null):Promise<T>{
  if (!path.startsWith("/api/") || path.startsWith("//"))
    throw new Error("არასწორი მოთხოვნა.");
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 20_000);
  const cancel=()=>controller.abort();
  options.signal?.addEventListener('abort',cancel);
  if(options.signal?.aborted)controller.abort();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (currentToken && !options.public)
    headers.Authorization = `Bearer ${currentToken}`;
  if(currentRole)headers["X-HMW-Preview-Role"]=encodeURIComponent(currentRole);
  const multipart = options.body instanceof FormData;
  if (!multipart && options.body !== undefined)
    headers["Content-Type"] = "application/json";
  try {
    const response = await fetch(API_ORIGIN + path, {
      method: options.method || "GET",
      headers,
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
      body:
        options.body === undefined
          ? undefined
          : multipart
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    });
    const payload = await response
      .json()
      .catch(() => ({ error: "სერვერის პასუხი ვერ დამუშავდა." }));
    if (!response.ok) {
      if (
        response.status === 401 &&
        !options.public &&
        currentToken === token
      ) {
        await expireToken(currentToken);
      }
      throw new ApiError(
        payload.error || "მოთხოვნა ვერ შესრულდა.",
        response.status,
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(
      "კავშირი ვერ დამყარდა. შეამოწმე ინტერნეტი და სცადე ხელახლა.",
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort',cancel);
  }
}

// File-backed binary uploads avoid multipart URI serialization and base64 copies.
export function shootPhotoSource(id:string){return {...chatImageSource(id),uri:API_ORIGIN+'/api/shoots/photo?id='+encodeURIComponent(id)}}
export function workPhotoSource(id:string){return {...chatImageSource(id),uri:API_ORIGIN+'/api/work/files?id='+encodeURIComponent(id)}}
export const uploadWorkPhoto=(uri:string)=>uploadBinary(uri,'/api/work/files','image/jpeg');
export const uploadChatPhoto=(uri:string,conversationId:string,id:string)=>uploadBinary(uri,'/api/chat/attachments?conversationId='+encodeURIComponent(conversationId)+'&id='+id,'image/jpeg');
export const uploadChatVoice=(uri:string,conversationId:string,id:string,durationMs:number)=>uploadBinary(uri,'/api/chat/attachments?conversationId='+encodeURIComponent(conversationId)+'&id='+id+'&durationMs='+Math.round(durationMs),'audio/mp4');
export const uploadShootPhoto=(uri:string,id:string)=>uploadBinary(uri,'/api/shoots/photo?id='+id,'image/jpeg');
export const uploadPlacePhoto=(uri:string)=>uploadBinary(uri,'/api/workspace/places/photo','image/jpeg');
async function uploadBinary(uri:string,path:string,mime:string){
 const uploadToken=token,version=tokenEpoch;
 const [{fetch:send},{File}]=await Promise.all([import('expo/fetch'),import('expo-file-system')]);
 if(version!==tokenEpoch)throw new Error('სესია შეიცვალა. სცადე ხელახლა.');
 const file=new File(uri);if(!file.exists||file.size>(mime.startsWith('audio/')?10:5)*1024*1024)throw new Error('ფაილი ვერ იკითხება ან ზედმეტად დიდია.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000),headers:Record<string,string>={'Content-Type':mime,Accept:'application/json'};
 if(uploadToken)headers.Authorization=`Bearer ${uploadToken}`;if(previewRole)headers['X-HMW-Preview-Role']=encodeURIComponent(previewRole);
 try{const response=await send(API_ORIGIN+path,{method:'POST',headers,body:file,signal:controller.signal});const result=await response.json() as {id:string;error?:string};if(!response.ok){if(response.status===401)await expireToken(uploadToken);throw new ApiError(result.error||'ფაილი ვერ აიტვირთა.',response.status);}return result.id}catch(e){if(e instanceof ApiError)throw e;throw new Error('ატვირთვა შეფერხდა. სცადე ხელახლა — ფაილი არ დაიკარგება.')}finally{clearTimeout(timer)}
}
