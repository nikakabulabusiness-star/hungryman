import {env} from 'cloudflare:workers';

/** Enabled only after an unattended caller has actually been provisioned. */
export function notificationRuntime(){
 const values=env as unknown as {WORK_NOTIFICATION_CRON_SECRET?:string;WORK_NOTIFICATION_SCHEDULER_ENABLED?:string};
 const secret=values.WORK_NOTIFICATION_CRON_SECRET;
 return {secret:typeof secret==='string'&&secret.length>=32?secret:null,serverScheduling:values.WORK_NOTIFICATION_SCHEDULER_ENABLED==='1'};
}

export async function authorizedNotificationJob(req:Request){
 const {secret}=notificationRuntime();if(!secret)return false;
 const value=req.headers.get('authorization')||'';
 if(!value.startsWith('Bearer ')||value.length>1024)return false;
 const digest=async(text:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
 const [expected,actual]=await Promise.all([digest(secret),digest(value.slice(7))]);
 let different=0;for(let index=0;index<expected.length;index++)different|=expected[index]^actual[index];return different===0;
}
