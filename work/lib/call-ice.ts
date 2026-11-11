// Coturn TURN REST credentials: only invoked after call membership/permission checks.
// The shared secret stays in server runtime settings, never in an app bundle.
export async function callIce(env:Record<string,unknown>,sessionId:string,now=Date.now()){
 const urls=String(env.WORK_TURN_URLS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const secret=String(env.WORK_TURN_SECRET||'');
 const stun={urls:'stun:stun.cloudflare.com:3478'};
 if(!urls.length&&!secret)return {iceServers:[stun],relayAvailable:false};
 if(!urls.length||urls.length>4||secret.length<32||urls.some(url=>!/^turns?:([a-z\d.-]+|\[[a-f\d:]+\])(:\d{1,5})?(\?transport=(udp|tcp))?$/i.test(url)))throw Error('TURN configuration is incomplete');
 // The call is capped at four hours by the session API.
 const expiresAt=Math.floor(now/1000)+4*60*60+300;
 const username=expiresAt+':'+sessionId;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(username)));
 const credential=btoa(String.fromCharCode(...signature));
 return {iceServers:[stun,{urls,username,credential}],relayAvailable:true};
}
