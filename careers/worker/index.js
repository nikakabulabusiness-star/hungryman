const BACKEND='https://hungryman-applications-test.hungryman.chatgpt.site';
const ORIGINS=new Set(['https://team.hungryman.ge','https://careers.hungryman.ge','https://hungryman-careers.hungryman.chatgpt.site']);
export function routeAllowed(path,method){
 if(method==='POST')return /^\/api\/(applications(?:\/[0-9a-f-]{36}\/rating)?|events|presence)$/.test(path);
 return ['GET','HEAD'].includes(method)&&(path==='/'||path==='/privacy'||/^\/apply\/(writer|director|producer|editor|thumbnail|shorts)\/?$/.test(path)||path.startsWith('/_next/')||path.startsWith('/careers/')||['/favicon.svg','/hungryman.svg','/work/call-client.css','/work/chat-dock.css'].includes(path));
}
export default {async fetch(req,env){
 const url=new URL(req.url),path=url.pathname;
 if(!routeAllowed(path,req.method))return new Response('გვერდი ვერ მოიძებნა',{status:404});
 if(req.method==='POST'&&(!ORIGINS.has(req.headers.get('origin'))||req.headers.get('origin')!==url.origin))return new Response('მოთხოვნა უარყოფილია',{status:403});
 if(Number(req.headers.get('content-length')||0)>6*1024*1024)return new Response('ფაილი ზედმეტად დიდია',{status:413});
 if(!env.CAREERS_BRIDGE_SECRET)return new Response('დროებითი შეფერხებაა',{status:503});
 const target=new URL(path==='/'?'/careers':path,BACKEND);target.search=url.search;
 const headers=new Headers();for(const key of ['accept','content-type','user-agent','rsc','next-router-state-tree','next-url']){const value=req.headers.get(key);if(value)headers.set(key,value)}
 headers.set('x-hm-careers-key',env.CAREERS_BRIDGE_SECRET);headers.set('x-hm-visitor-ip',req.headers.get('cf-connecting-ip')||'unknown');
 try{const result=await fetch(target,{method:req.method,headers,body:req.method==='POST'?req.body:undefined,redirect:'manual'});const out=new Headers(result.headers);out.delete('set-cookie');out.set('X-Content-Type-Options','nosniff');
 if(result.status>=300&&result.status<400){const next=new URL(out.get('location')||'/',BACKEND);if(next.origin!==BACKEND||!routeAllowed(next.pathname,'GET'))return new Response('გვერდი ვერ მოიძებნა',{status:404});out.set('location',next.pathname+next.search)}
 return new Response(result.body,{status:result.status,headers:out});}catch{return new Response('კავშირი ვერ დამყარდა. სცადე ხელახლა.',{status:503})}
}};
