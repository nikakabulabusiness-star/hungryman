export const UPDATE_CHECK_INTERVAL=15*60*1000;
export function shouldCheckUpdate(enabled:boolean,development:boolean,active:boolean,pending:boolean,busy:boolean,last:number,now:number,manual=false){return enabled&&!development&&active&&!pending&&!busy&&(manual||now-last>=UPDATE_CHECK_INTERVAL)}
export function mayReloadUpdate(path:string,audioBusy:boolean,active:boolean){return active&&!audioBusy&&!path.startsWith('/call/')}
export type NativeBuild={version:string;runtimeVersion:string};
/** Runtime IDs are opaque: an explicit replacement list avoids downgrade warnings. */
export function requiredNativeBuild(value:unknown,platform:string,channel:string|null,runtimeVersion:string|null):NativeBuild|null{
 if(!value||typeof value!=='object'||!channel||!runtimeVersion)return null;
 const release=value as Record<string,unknown>;
 if(release.schema!==1||release.platform!==platform||release.channel!==channel||typeof release.version!=='string'||release.version.length>40||typeof release.runtimeVersion!=='string'||release.runtimeVersion===runtimeVersion||!Array.isArray(release.replaces)||!release.replaces.includes(runtimeVersion))return null;
 return {version:release.version,runtimeVersion:release.runtimeVersion};
}
