import {roles,type Role} from './questions';
import {storage} from './storage';

export type VacancyState={role:Role;isOpen:boolean;deadline:string|null;accepting:boolean};
export const todayInTbilisi=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tbilisi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export async function getVacancyStates():Promise<Record<Role,VacancyState>>{
 const defaults=Object.fromEntries(Object.keys(roles).map(role=>[role,{role:role as Role,isOpen:true,deadline:null,accepting:true}])) as Record<Role,VacancyState>;
 try{const rows=(await storage().DB.prepare('SELECT role,is_open,deadline FROM vacancies').all<{role:string;is_open:number;deadline:string|null}>()).results;const today=todayInTbilisi();for(const row of rows){if(!Object.hasOwn(roles,row.role))continue;const role=row.role as Role;defaults[role]={role,isOpen:!!row.is_open,deadline:row.deadline,accepting:!!row.is_open&&(!row.deadline||row.deadline>=today)};}}catch{}
 return defaults;
}
