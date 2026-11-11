import type {DepartmentMembership} from './department-directory';
import {storage} from '@/lib/storage';
import {defaultPermissions,normalizePermissions,validPermissionKeys,type PermissionKey} from '@/lib/permissions';

export type Position={name:string;active:boolean;system:boolean;departmentId:string;rank:number;reportsTo:string|null;permissions:PermissionKey[];deleted:boolean;memberships:DepartmentMembership[]};
/** Only Developer is intrinsically protected. Other roles are guarded by actor hierarchy. */
export const protectedPositions=['Developer'];
export function normalizePosition(value:unknown){return typeof value==='string'?value.trim().replace(/\s+/g,' '):''}
export function validPositionName(name:string){return name.length>=2&&name.length<=80&&!/[\u0000-\u001f<>]/.test(name)&&!['owner','developer','დამფუძნებელი'].includes(name.toLowerCase())}
type PositionRow={name:string;is_active:number;department_id:string;hierarchy_rank:number;reports_to:string|null;permissions_json:string|null;is_deleted:number;memberships_json:string};
export function positionFromRow(row:PositionRow):Position{
 let permissions=defaultPermissions(row.name);
 if(row.permissions_json!==null){try{const parsed:unknown=JSON.parse(row.permissions_json);permissions=validPermissionKeys(parsed)?normalizePermissions(parsed):[]}catch{permissions=[]}}
 let memberships:DepartmentMembership[]=[];try{const value=JSON.parse(row.memberships_json||'[]');if(Array.isArray(value))memberships=value}catch{}
 return {memberships,name:row.name,active:!!row.is_active&&!row.is_deleted,system:row.name==='Owner',departmentId:row.department_id,rank:row.hierarchy_rank,reportsTo:row.reports_to,permissions,deleted:!!row.is_deleted};
}
export async function getPositions({includeDeleted=false}:{includeDeleted?:boolean}={}):Promise<Position[]>{
 const rows=(await storage().DB.prepare('SELECT name,is_active,department_id,hierarchy_rank,reports_to,permissions_json,is_deleted,memberships_json FROM staff_positions WHERE name<>? ORDER BY hierarchy_rank,name').bind('Developer').all<PositionRow>()).results;
 return rows.filter(row=>includeDeleted||!row.is_deleted).map(positionFromRow);
}
export async function getPosition(name:string):Promise<Position|null>{
 if(name==='Developer')return null;
 const row=await storage().DB.prepare('SELECT name,is_active,department_id,hierarchy_rank,reports_to,permissions_json,is_deleted,memberships_json FROM staff_positions WHERE name=? LIMIT 1').bind(name).first<PositionRow>();
 return row?positionFromRow(row):null;
}
export async function getAssignablePositions(){return (await getPositions()).filter(role=>role.active&&role.name!=='Owner').map(role=>role.name)}
