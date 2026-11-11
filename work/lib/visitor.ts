import {isCareersBridge,isPublicCareersPath} from '@/lib/careers-bridge';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {mobileBearer} from '@/lib/mobile-auth';

export async function visitorKey(req:Request){
 const user=await getChatGPTUser();if(user)return 'user:'+user.userId;
 const ip=(isCareersBridge(req.headers)?req.headers.get('x-hm-visitor-ip'):null)||req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
 const source=ip+'|'+(req.headers.get('user-agent')||'unknown');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));
 return 'anonymous:'+Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function sameOrigin(req:Request){
 if(isPublicCareersPath(new URL(req.url).pathname)&&isCareersBridge(req.headers))return true;
 const origin=req.headers.get('origin'),fetchSite=req.headers.get('sec-fetch-site');
 if(origin)return fetchSite!=='cross-site'&&origin===new URL(req.url).origin;
 // Native apps do not send browser Origin/Fetch Metadata headers. A caller
 // must present a bearer; routes still verify its stored hash and permissions.
 if(!fetchSite&&mobileBearer(req.headers))return true;
 return fetchSite==='same-origin';
}
