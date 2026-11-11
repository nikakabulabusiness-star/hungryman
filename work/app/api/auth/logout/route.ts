import {clearEmbeddedSessionCookie,clearSessionCookie,hashSessionToken,safeReturnPath,STAFF_EMBEDDED_SESSION_COOKIE,STAFF_SESSION_COOKIE} from '@/lib/staff-auth';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {mobileBearer} from '@/lib/mobile-auth';

export const dynamic='force-dynamic';

function cookieValue(request:Request,name:string){
 const match=request.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
 return match?.[1]||null;
}

export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 const tokens=[mobileBearer(request.headers),cookieValue(request,STAFF_SESSION_COOKIE),cookieValue(request,STAFF_EMBEDDED_SESSION_COOKIE)].filter((token):token is string=>!!token);
 if(tokens.length)try{const hashes=await Promise.all([...new Set(tokens)].map(hashSessionToken));await storage().DB.batch(hashes.map(hash=>storage().DB.prepare('DELETE FROM staff_sessions WHERE token_hash=?').bind(hash)))}catch{}
 let returnTo='/';
 try{const body=await request.json() as {returnTo?:unknown};if(typeof body.returnTo==='string')returnTo=safeReturnPath(body.returnTo)}catch{}
 const response=Response.json({ok:true,returnTo},{headers:{'Cache-Control':'no-store'}});
 response.headers.append('Set-Cookie',clearSessionCookie());
 response.headers.append('Set-Cookie',clearEmbeddedSessionCookie());
 return response;
}
