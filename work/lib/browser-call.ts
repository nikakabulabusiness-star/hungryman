'use client';

type CallRequest={conversationId:string;mode:'audio'|'video'};
type CallWindow=Window&{__hmStartCall?:(requestId:string,mode:'audio'|'video')=>Promise<void>};
let loading:Promise<void>|null=null;
export async function startBrowserCall(detail:CallRequest,compact:boolean){
 if(compact&&window.parent!==window){window.parent.postMessage({type:'hmw:start-call',...detail},location.origin);return}
 const host=window as CallWindow;
 if(!host.__hmStartCall){
  loading??=new Promise<void>((resolve,reject)=>{
   let script=document.getElementById('hm-call-client-script') as HTMLScriptElement|null;
   const timeout=setTimeout(()=>{loading=null;script?.remove();reject(Error('ზარის სერვისი ვერ ჩაიტვირთა. განაახლე გვერდი.'))},10000);
   const done=()=>{clearTimeout(timeout);if(host.__hmStartCall)resolve();else{loading=null;reject(Error('ზარი ვერ მომზადდა. განაახლე გვერდი.'))}};
   const failed=()=>{clearTimeout(timeout);loading=null;script?.remove();reject(Error('ზარი ვერ ჩაიტვირთა. შეამოწმე ინტერნეტი.'))};
   if(!script){script=document.createElement('script');script.id='hm-call-client-script';script.src='/work/call-client.js?v=58';script.async=true;script.addEventListener('load',done,{once:true});script.addEventListener('error',failed,{once:true});document.body.appendChild(script)}
   else{script.addEventListener('load',done,{once:true});script.addEventListener('error',failed,{once:true});if(host.__hmStartCall)done()}
  });
  await loading;
 }
 await host.__hmStartCall?.(detail.conversationId,detail.mode);
}
