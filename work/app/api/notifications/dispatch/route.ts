import {authorizedNotificationJob} from '@/lib/notification-runtime';
import {produceScheduledNotices} from '@/lib/notification-reminders';
import {flushNotices} from '@/lib/notifications';
import {flushPush} from '@/lib/push';

export const dynamic='force-dynamic';
/** Server-to-server only. The caller supplies no recipients or event contents. */
export async function POST(req:Request){
 if(!await authorizedNotificationJob(req))return Response.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{const produced=await produceScheduledNotices();const work=await flushNotices(),chat=await flushPush();return Response.json({ok:true,...produced,work,chat},{headers:{'Cache-Control':'no-store'}})}
 catch{console.error('scheduled-notification-dispatch-failed');return Response.json({error:'Notification dispatch pending retry'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
