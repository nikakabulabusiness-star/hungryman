import {storage} from './storage';

/** Expo acceptance is not device delivery; inspect provider receipts after 15 min. */
export async function checkPushReceipts(){
 const db=storage().DB,now=Date.now();
 const rows=(await db.prepare(`SELECT 'work' AS kind,d.notification_id AS id,d.token,n.user_id,d.ticket FROM work_notification_deliveries d JOIN work_notifications n ON n.id=d.notification_id WHERE d.ticket IS NOT NULL AND d.receipt_checked IS NULL AND d.sent<? AND d.sent>?
 UNION ALL SELECT 'chat',message_id,token,user_id,ticket FROM push_deliveries WHERE ticket IS NOT NULL AND receipt_checked IS NULL AND sent<? AND sent>? LIMIT 100`).bind(now-15*60000,now-24*3600000,now-15*60000,now-24*3600000).all<{kind:string;id:string;token:string;user_id:string;ticket:string}>()).results;
 if(!rows.length)return {checked:0};
 try{
  const response=await fetch('https://exp.host/--/api/v2/push/getReceipts',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({ids:[...new Set(rows.map(row=>row.ticket))]}),signal:AbortSignal.timeout(10000)});if(!response.ok)return {checked:0};
  const payload=await response.json() as {data?:Record<string,{status?:string;details?:{error?:string}}>};let checked=0;
  for(const row of rows){const receipt=payload.data?.[row.ticket];if(!receipt||!['ok','error'].includes(receipt.status||''))continue;const table=row.kind==='work'?'work_notification_deliveries':'push_deliveries',column=row.kind==='work'?'notification_id':'message_id',error=receipt.status==='error'?(receipt.details?.error||'ProviderError').slice(0,100):null;
   await db.prepare(`UPDATE ${table} SET receipt_checked=?,receipt_error=? WHERE ${column}=? AND token=? AND ticket=?`).bind(now,error,row.id,row.token,row.ticket).run();
   if(error==='DeviceNotRegistered')await db.prepare('DELETE FROM push_devices WHERE token=? AND user_id=?').bind(row.token,row.user_id).run();checked++;
  }
  return {checked};
 }catch{return {checked:0}}
}
