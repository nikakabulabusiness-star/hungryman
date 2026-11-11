export type ReminderDay={date:string;planned:string;mode:string;requested?:boolean};
export type LocalReminder={identifier:string;at:number;title:string;body:string;category?:string;data:Record<string,string|boolean>};
export function isLocalReminder(identifier:string){return identifier.startsWith('hm-attendance-')||identifier.startsWith('hm-salary-')}
function atTime(day:string,time:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return NaN;
 const value=Date.parse(`${day}T${time}:00+04:00`);
 if(!Number.isFinite(value))return NaN;
 return new Date(value+4*3600000).toISOString().slice(0,10)===day?value:NaN;
}
export function buildReminderPlan({days,salaries,userId,time='13:00',now=Date.now(),serverScheduling=false,remoteReady=false,personalTeam=false}:{days:ReminderDay[];salaries:string[];userId:string;time?:string;now?:number;serverScheduling?:boolean;remoteReady?:boolean;personalTeam?:boolean}):LocalReminder[]{
 // Never remove the working local fallback merely because an EAS project exists.
 if(!userId||(!personalTeam&&serverScheduling&&remoteReady))return [];
 const reminders=new Map<string,LocalReminder>();
 for(const day of days){const at=atTime(day.date,time);if(day.planned==='work'&&day.mode==='pending'&&!day.requested&&at>now){const identifier='hm-attendance-'+day.date;reminders.set(identifier,{identifier,at,title:'აგვიანებ?',body:'აირჩიე პასუხი — HR მიიღებს შენს მოთხოვნას.',category:'attendanceStatus',data:{attendance:true,target:'attendance',date:day.date,recipientUserId:userId}})}}
 for(const day of salaries){const at=atTime(day,'10:00');if(at>now){const identifier='hm-salary-'+day;reminders.set(identifier,{identifier,at,title:'დღეს ხელფასის დღეა',body:'Hungryman Work · კალენდარი',data:{target:'calendar',targetId:day,recipientUserId:userId}})}}
 // iOS permits at most 64 pending notifications. Leave room for other app notices.
 return [...reminders.values()].sort((a,b)=>a.at-b.at||a.identifier.localeCompare(b.identifier)).slice(0,60);
}
