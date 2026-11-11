import {env} from 'cloudflare:workers';
import {getAdminAccess} from '@/lib/admin';
import {hasPermission} from '@/lib/permissions';
import {sameOrigin} from '@/lib/visitor';
export const dynamic='force-dynamic';
async function handle(req:Request){
 const access=await getAdminAccess();if(!hasPermission(access,req.method==='GET'?'inbox.view':'inbox.manage'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 if(req.method!=='GET'&&!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 const e=env as unknown as {WORK_INBOX_SECRET?:string};if(!e.WORK_INBOX_SECRET)return Response.json({error:'მთავარ საიტთან კავშირი ჯერ არ არის გამართული.'},{status:503});
 const url=new URL(req.url),kind=url.searchParams.get('kind')||'feedback';if(!['feedback','applications','emails'].includes(kind))return Response.json({error:'ტიპი არასწორია.'},{status:400});
 const offset=Number(url.searchParams.get('offset')||0);if(!Number.isInteger(offset)||offset<0||offset>100000)return Response.json({error:'გვერდი არასწორია.'},{status:400});
 let body:string|undefined;if(req.method==='PATCH'){try{const a=await req.json() as {id:string;status:string};if(!/^[\w-]{1,100}$/.test(a.id||'')||!['new','reviewed','archived'].includes(a.status))throw Error();body=JSON.stringify({id:a.id,status:a.status});}catch{return Response.json({error:'მონაცემები არასწორია.'},{status:400})}}
 try{const response=await fetch('https://hungryman-official.hungryman.chatgpt.site/api/work-inbox?'+new URLSearchParams({kind,offset:String(offset)}),{method:req.method,headers:{Authorization:'Bearer '+e.WORK_INBOX_SECRET,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(12000)});return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});}catch{return Response.json({error:'მთავარ საიტთან კავშირი ვერ დამყარდა. სცადე ხელახლა.'},{status:503})}
}
export const GET=handle;export const PATCH=handle;
