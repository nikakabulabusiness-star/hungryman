import {hasPermission,type PermissionActor} from '@/lib/permissions';

export function employeeRole(position:string){
 const roles=position.split(/\s*(?:,|\+)\s*/).filter(Boolean);
 return ['Developer','Owner','HR'].find(role=>roles.includes(role))||position;
}
/** Editing employment data never grants an account role and cannot target a protected identity. */
export function canEditEmployee(actor:PermissionActor|null|undefined,targetRole:string|null,email:string){
 if(!hasPermission(actor,'employees.manage'))return false;
 if(actor?.isDeveloper)return true;
 if(targetRole==='Developer'||email.toLowerCase()==='nikolozkabulashvili0@gmail.com')return false;
 if(actor?.role==='Owner')return true;
 if(targetRole==='Owner')return false;
 if(actor?.isSiteAdmin||actor?.role==='HR')return true;
 return targetRole!=='HR';
}
