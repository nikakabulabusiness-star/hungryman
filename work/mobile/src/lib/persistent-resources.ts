import {File,Directory,Paths} from 'expo-file-system';
import {AESEncryptionKey,AESSealedData,aesEncryptAsync,aesDecryptAsync,CryptoDigestAlgorithm,digestStringAsync} from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {boundSnapshots,decodeSnapshots,sanitizeSnapshot,SNAPSHOT_LIMIT,type ResourceSnapshot} from './resource-snapshot';

// An encrypted app-private file; the encryption key is device-only Keychain/Keystore data.
// This key is not an auth token and cannot approve an employee or make API requests.
const KEY='hungryman.work.display-cache.key.v1';
let keyPromise:Promise<AESEncryptionKey>|undefined;
let generation=0,scope='',snapshots:ResourceSnapshot[]=[],timer:ReturnType<typeof setTimeout>|undefined,writing=false,dirty=false;
function file(){return new File(new Directory(Paths.document,'hmw-private-cache-v1'),'resources.enc')}
async function encryptionKey(){
 if(!keyPromise)keyPromise=(async()=>{const saved=await SecureStore.getItemAsync(KEY);if(saved)return AESEncryptionKey.import(saved,'hex');const key=await AESEncryptionKey.generate();await SecureStore.setItemAsync(KEY,await key.encoded('hex'),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});return key})().catch(e=>{keyPromise=undefined;throw e});
 return keyPromise;
}
export function cacheScope(identity:string){return digestStringAsync(CryptoDigestAlgorithm.SHA256,identity)}
export function clearPersistentResources(){generation++;scope='';snapshots=[];dirty=false;if(timer)clearTimeout(timer);timer=undefined;try{const target=file();if(target.exists)target.delete()}catch{/* Cache failure must never block logout. */}}
export async function openPersistentResources(nextScope:string):Promise<ResourceSnapshot[]>{
 const version=++generation;scope=nextScope;snapshots=[];if(timer)clearTimeout(timer);timer=undefined;
 try{const target=file();if(!target.exists)return [];if(target.size>SNAPSHOT_LIMIT+1024){target.delete();return []}const key=await encryptionKey(),bytes=await target.bytes();const decoded=await aesDecryptAsync(AESSealedData.fromCombined(bytes),key);if(version!==generation)return [];snapshots=decodeSnapshots(new TextDecoder().decode(decoded),nextScope);if(!snapshots.length&&target.exists)target.delete();return snapshots}
 catch{if(version===generation){try{const target=file();if(target.exists)target.delete()}catch{}}return []}
}
async function flush(){
 timer=undefined;if(writing||!dirty||!scope)return;writing=true;dirty=false;const version=generation,currentScope=scope;
 try{snapshots=boundSnapshots(snapshots);const bytes=new TextEncoder().encode(JSON.stringify({version:1,scope:currentScope,entries:snapshots}));if(bytes.byteLength>SNAPSHOT_LIMIT)return;const sealed=await aesEncryptAsync(bytes,await encryptionKey()),encrypted=await sealed.combined();if(version!==generation||currentScope!==scope)return;const target=file();target.parentDirectory.create({idempotent:true,intermediates:true});target.write(encrypted)}catch{/* Disk full/locked devices fall back to the memory cache. */}finally{writing=false;if(dirty&&scope&&!timer)timer=setTimeout(()=>void flush(),1000)}
}
export function persistResource(snapshot:ResourceSnapshot){
 if(!scope)return;const data=sanitizeSnapshot(snapshot.path,snapshot.data);if(!data)return;const previous=snapshots.find(e=>e.path===snapshot.path);if(previous&&snapshot.updated-previous.updated<60_000&&JSON.stringify(previous.data)===JSON.stringify(data))return;snapshots=boundSnapshots([{...snapshot,data},...snapshots.filter(e=>e.path!==snapshot.path)]);dirty=true;if(!timer)timer=setTimeout(()=>void flush(),1000);
}
