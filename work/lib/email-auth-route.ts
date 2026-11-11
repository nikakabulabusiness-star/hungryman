import {sameOrigin} from '@/lib/visitor';
import {nativeAuthRequest} from '@/lib/mobile-auth';
import {authBody,AuthFlowError} from '@/lib/email-verification';
export async function emailAuthRoute(request:Request,handler:(request:Request,body:Record<string,unknown>)=>Promise<unknown>){
 const headers={'Cache-Control':'no-store','Pragma':'no-cache','Referrer-Policy':'no-referrer'};
 if(!nativeAuthRequest(request)&&!sameOrigin(request))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403,headers});
 try{return Response.json(await handler(request,await authBody(request)),{headers})}
 catch(error){const known=error instanceof AuthFlowError;if(!known)console.error('email-auth-operation-failed');return Response.json({error:known?error.message:'მოქმედება დროებით ვერ შესრულდა. სცადე მოგვიანებით.'},{status:known?error.status:503,headers:{...headers,...(known&&error.status===429?{'Retry-After':'60'}:{})}})}
}
