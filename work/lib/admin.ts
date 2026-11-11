import {parseSystemPermissions,systemGrants,type SiteFeatures,systemPermissionKeys} from './site-controls';
import {getSiteFeatures} from './site-controls-store';
import {cookies,headers} from 'next/headers';
import {getSessionUser,OWNER_EMAIL,STAFF_SESSION_COOKIE,STAFF_EMBEDDED_SESSION_COOKIE,hashSessionToken,type SessionUser} from '@/lib/staff-auth';
import {storage} from '@/lib/storage';
import {getPosition} from '@/lib/positions';
import {defaultPermissions,permissionKeys,hasPermission,type PermissionKey} from '@/lib/permissions';
import type {TeamRole,TeamStatus} from '@/lib/team-roles';
export {OWNER_EMAIL};
export const DEVELOPER_EMAIL=OWNER_EMAIL;
export const PREVIEW_COOKIE='hm_role_preview';
export type AdminAccess={email:string;role:TeamRole|'Owner'|'Developer'|null;status:TeamStatus|null;isOwner:boolean;isDeveloper:boolean;isSiteAdmin?:boolean;systemPermissions?:string[];features?:SiteFeatures;systemRole?:'Developer'|'Administrator'|null;canGrantOwner:boolean;previewRole:string|null;isApprovedStaff:boolean;permissions:PermissionKey[];canAccessAdmin:boolean;canManageAccess:boolean;canManageEmployees:boolean;canDeleteApplications:boolean;canManageCalendar:boolean;canManageShootPermissions:boolean;canManagePositions:boolean;canViewDepartments:boolean;canCreateShoots:boolean;canEditShoots:boolean};
/** Pure construction is also used by tests. Legacy individual shoot flags are intentionally ignored. */
export function rolePermissions(email:string,role:string|null,approved:boolean,_create=false,_edit=false,granted?:PermissionKey[],siteAdministrator=false,systemPermissions:string[]=systemPermissionKeys):AdminAccess{
 const developer=approved&&role==='Developer'&&email.toLowerCase()===DEVELOPER_EMAIL;
 approved=approved&&(role!=='Developer'||developer);
 const isSiteAdmin=approved&&siteAdministrator&&!developer;
 const permissions=approved?(developer?[...permissionKeys]:[...new Set([...(granted??defaultPermissions(role)),...(isSiteAdmin?systemGrants(systemPermissions):[])])]):[];
 if(approved&&role==='Owner')for(const key of ['inbox.view','inbox.manage'] as const)if(!permissions.includes(key))permissions.push(key);
 const actor={permissions,isSiteAdmin,isDeveloper:developer,isApprovedStaff:approved};
 return {email,role,isSiteAdmin,systemPermissions:developer?[...systemPermissionKeys]:isSiteAdmin?systemPermissions:[],systemRole:developer?'Developer':isSiteAdmin?'Administrator':null,status:approved?'approved':'pending',isOwner:approved&&(role==='Owner'||developer),isDeveloper:developer,canGrantOwner:developer,previewRole:null,isApprovedStaff:approved,permissions,
 canAccessAdmin:hasPermission(actor,'admin.view'),canManageAccess:hasPermission(actor,'accounts.manage'),canManageEmployees:hasPermission(actor,'employees.manage'),canDeleteApplications:hasPermission(actor,'applications.delete'),canManageCalendar:hasPermission(actor,'calendar.manage'),canManageShootPermissions:hasPermission(actor,'positions.manage'),canManagePositions:hasPermission(actor,'positions.manage'),canViewDepartments:hasPermission(actor,'departments.view'),canCreateShoots:hasPermission(actor,'shoots.create'),canEditShoots:hasPermission(actor,'shoots.edit')};
}
export async function developerSessionTag(){
 const jar=await cookies();
 const token=jar.get(STAFF_SESSION_COOKIE)?.value||jar.get(STAFF_EMBEDDED_SESSION_COOKIE)?.value;
 return token?hashSessionToken('developer-mode:'+token):null;
}
export async function getPreviewRole(user:SessionUser){
 if(user.email.toLowerCase()!==DEVELOPER_EMAIL)return null;
 const h=await headers();
 if(h.has('authorization')){
  const raw=h.get('X-HMW-Preview-Role');
  if(!raw)return null;
  try{const role=decodeURIComponent(raw);return role!=='Developer'&&await getPosition(role)?role:null}catch{return null}
 }
 const tag=await developerSessionTag();
 const value=(await cookies()).get(PREVIEW_COOKIE)?.value;
 return tag&&value===tag?null:'Senior Editor';
}
export async function getAdminAccess(identity?:SessionUser|null):Promise<AdminAccess|null>{
 const user=identity===undefined?await getSessionUser():identity;if(!user)return null;
 const email=user.email.toLowerCase();
 if(email===DEVELOPER_EMAIL){
  // Developer must always be able to leave preview even if a previewed role was disabled.
  const preview=await getPreviewRole(user);
  if(preview){const [position,features]=await Promise.all([getPosition(preview),getSiteFeatures()]);const approved=!!position?.active;const access=rolePermissions(email,preview,approved,false,false,position?.permissions||[]);return {...access,features,canCreateShoots:features.shoots&&access.canCreateShoots,canEditShoots:features.shoots&&access.canEditShoots,status:approved?'approved':'suspended',previewRole:preview}}
  const features=await getSiteFeatures();return {...rolePermissions(email,'Developer',true),features,canCreateShoots:features.shoots,canEditShoots:features.shoots};
 }
 try{
  const row=await storage().DB.prepare('SELECT a.role,a.status,EXISTS(SELECT 1 FROM site_administrators s WHERE s.email=a.email) AS site_admin,(SELECT permissions_json FROM site_administrators s WHERE s.email=a.email) AS system_permissions FROM admin_users a WHERE a.email=? LIMIT 1').bind(email).first<{role:string;status:TeamStatus;site_admin:number;system_permissions:string|null}>();
  const position=row?.role?await getPosition(row.role):null;
  const features=await getSiteFeatures();
  const approved=row?.status==='approved'&&(!!row.site_admin||!!position?.active);
  return {...rolePermissions(email,row?.role||null,approved,false,false,position?.permissions||[],!!row?.site_admin,parseSystemPermissions(row?.system_permissions)),features,canCreateShoots:approved&&features.shoots&&hasPermission(rolePermissions(email,row?.role||null,approved,false,false,position?.permissions||[],!!row?.site_admin,parseSystemPermissions(row?.system_permissions)),'shoots.create'),canEditShoots:approved&&features.shoots&&hasPermission(rolePermissions(email,row?.role||null,approved,false,false,position?.permissions||[],!!row?.site_admin,parseSystemPermissions(row?.system_permissions)),'shoots.edit'),status:row?.status==='approved'&&!approved?'suspended':row?.status||null};
 }catch{return rolePermissions(email,null,false)}
}
export async function isOwner(){return !!(await getAdminAccess())?.isOwner}
export async function isAdmin(){return !!(await getAdminAccess())?.canAccessAdmin}
export async function canManageAccess(){return !!(await getAdminAccess())?.canManageAccess}
export async function canManageEmployees(){return !!(await getAdminAccess())?.canManageEmployees}
export async function canDeleteApplications(){return !!(await getAdminAccess())?.canDeleteApplications}
