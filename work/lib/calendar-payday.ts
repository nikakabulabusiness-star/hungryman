import {storage} from '@/lib/storage';
import {validIsoDate,virtualSalaryEvents} from '@/lib/staff-calendar';

export async function salaryOverrides(from:string,to:string){
 const rows=await storage().DB.prepare('SELECT key,value FROM workspace_settings WHERE key>=? AND key<=?').bind('salary-date:'+from.slice(0,7),'salary-date:'+to.slice(0,7)).all<{key:string;value:string}>();
 return Object.fromEntries(rows.results.filter(row=>/^salary-date:\d{4}-\d{2}$/.test(row.key)&&validIsoDate(row.value)&&row.value.slice(0,7)===row.key.slice(12)).map(row=>[row.key.slice(12),row.value]));
}
export async function salaryEvents(from:string,to:string){return virtualSalaryEvents(from,to,await salaryOverrides(from,to))}
