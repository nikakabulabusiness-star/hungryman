import {parseSystemPermissions} from './site-controls';
import type {SiteFeatures} from './site-controls';
import {getChatGPTUser,requireChatGPTUser} from '@/app/chatgpt-auth';
import {getAdminAccess,OWNER_EMAIL,type AdminAccess} from '@/lib/admin';
import {getSessionUser,type SessionUser} from '@/lib/staff-auth';
import {storage} from '@/lib/storage';
import type {PermissionKey} from '@/lib/permissions';
import {redirect} from 'next/navigation';

export type StaffAccess={
 userId:string;
 email:string;
 fullName:string;
 role:string|null;
 status:string|null;
 isOwner:boolean;
 isDeveloper:boolean;
 isSiteAdmin?:boolean;
 features?:SiteFeatures;
 systemPermissions?:string[];
 permissions:PermissionKey[];
 isApproved:boolean;
 canAccessAdmin:boolean;
 canManageCalendar:boolean;
 canCreateShoots:boolean;
 canEditShoots:boolean;
 hasAvatar:boolean;
 profileUpdated:number;
 lastSeen:number;
};

export type StaffDirectoryEntry={
 userId:string|null;
 email:string;
 fullName:string;
 role:string;
 hasAvatar:boolean;
 profileUpdated:number;
 lastSeen:number;
 isOwner:boolean;
 isSiteAdmin?:boolean;
 features?:SiteFeatures;
 systemPermissions?:string[];
};

type ProfileRow={user_id:string;full_name:string;avatar_key:string|null;updated:number;last_seen:number};
type DirectoryRow={system_permissions?:string|null;site_admin?:number;user_id:string|null;email:string;full_name:string|null;employee_name:string|null;role:string;avatar_key:string|null;updated:number|null;last_seen:number|null};

function withIdentity(access:AdminAccess,user:{userId:string;email:string;fullName:string|null;displayName:string},profile:ProfileRow|null,employeeName:string|null):StaffAccess{
 return {
  userId:user.userId,
  email:user.email.toLowerCase(),
  fullName:profile?.full_name||employeeName||user.fullName||user.displayName,
  role:access.role,
  status:access.status,
  isOwner:access.isOwner,
  isDeveloper:access.isDeveloper,
  isSiteAdmin:access.isSiteAdmin,
  features:access.features,
  systemPermissions:access.systemPermissions,
  permissions:access.permissions,
  isApproved:access.isApprovedStaff,
  canAccessAdmin:access.canAccessAdmin,
  canManageCalendar:access.canManageCalendar,
  canCreateShoots:access.canCreateShoots,
  canEditShoots:access.canEditShoots,
  hasAvatar:!!profile?.avatar_key,
  profileUpdated:Number(profile?.updated)||0,
  lastSeen:Number(profile?.last_seen)||0,
 };
}

export async function getStaffAccess(identity?:SessionUser|null,permissions?:AdminAccess):Promise<StaffAccess|null>{
 const user=identity===undefined?await getSessionUser():identity;
 if(!user)return null;
 // Permissions remain freshly checked on every request. Profile presentation data
 // is independent, so fetch it alongside permissions instead of another DB waterfall.
 const [access,[profile,employeeName]]=await Promise.all([
  permissions?Promise.resolve(permissions):getAdminAccess(user),
  (async():Promise<[ProfileRow|null,string|null]>=>{
   try{const {DB}=storage();return await Promise.all([
    DB.prepare('SELECT user_id,full_name,avatar_key,updated,last_seen FROM team_members WHERE email=? OR user_id=? LIMIT 1').bind(user.email.toLowerCase(),user.userId).first<ProfileRow>(),
    DB.prepare('SELECT full_name FROM employees WHERE lower(email)=? LIMIT 1').bind(user.email.toLowerCase()).first<{full_name:string}>().then(row=>row?.full_name||null),
   ])}catch{return [null,null]}
  })(),
 ]);
 if(!access)return null;
 return withIdentity(access,{...user,displayName:user.fullName},profile,employeeName);
}

export async function requireApprovedStaff(returnTo:string):Promise<StaffAccess>{
 await requireChatGPTUser(returnTo);
 const access=await getStaffAccess();
 if(!access?.isApproved)redirect('/team');
 return access;
}

export async function syncStaffProfile(access:StaffAccess,{touch=true}:{touch?:boolean}={}):Promise<StaffAccess>{
 if(!access.isApproved)return access;
 const {DB}=storage(),now=Date.now();
 const existing=await DB.prepare('SELECT user_id,avatar_key,created,last_seen FROM team_members WHERE email=? OR user_id=? LIMIT 1').bind(access.email,access.userId).first<{user_id:string;avatar_key:string|null;created:number;last_seen:number}>();
 if(existing){
  await DB.prepare('UPDATE team_members SET user_id=?,email=?,full_name=?,role=?,status=?,last_seen=? WHERE user_id=?').bind(access.userId,access.email,access.fullName,access.role,'approved',touch?now:existing.last_seen,existing.user_id).run();
 }else{
  await DB.prepare('INSERT INTO team_members (user_id,email,full_name,phone,role,status,avatar_key,last_seen,created,updated,approved_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(access.userId,access.email,access.fullName,'',access.role,'approved',null,touch?now:0,now,now,OWNER_EMAIL).run();
 }
 const profile=await DB.prepare('SELECT avatar_key,updated,last_seen FROM team_members WHERE email=? LIMIT 1').bind(access.email).first<{avatar_key:string|null;updated:number;last_seen:number}>();
 return {...access,hasAvatar:!!profile?.avatar_key,profileUpdated:Number(profile?.updated)||now,lastSeen:Number(profile?.last_seen)||0};
}

export async function listApprovedStaff():Promise<StaffDirectoryEntry[]>{
 const {DB}=storage();
 const [directory,ownerProfile]=await Promise.all([DB.prepare(`SELECT EXISTS(SELECT 1 FROM site_administrators s WHERE s.email=a.email) AS site_admin,(SELECT permissions_json FROM site_administrators s WHERE s.email=a.email) AS system_permissions,a.email,a.role,t.user_id,t.full_name,e.full_name AS employee_name,t.avatar_key,t.updated,t.last_seen
  FROM admin_users a
  LEFT JOIN team_members t ON lower(t.email)=lower(a.email)
  LEFT JOIN employees e ON lower(e.email)=lower(a.email)
  WHERE a.status='approved' AND (a.email='nikolozkabulashvili0@gmail.com' OR EXISTS(SELECT 1 FROM site_administrators s WHERE s.email=a.email) OR EXISTS(SELECT 1 FROM staff_positions p WHERE p.name=a.role AND p.is_active=1 AND p.is_deleted=0))
  ORDER BY COALESCE(e.full_name,t.full_name,a.email)`).all<DirectoryRow>(),DB.prepare('SELECT user_id,email,full_name,avatar_key,updated,last_seen FROM team_members WHERE lower(email)=? LIMIT 1').bind(OWNER_EMAIL).first<{user_id:string;email:string;full_name:string;avatar_key:string|null;updated:number;last_seen:number}>()]);
 const {results}=directory;
 const owner:StaffDirectoryEntry={
  userId:ownerProfile?.user_id||null,
  email:OWNER_EMAIL,
  fullName:ownerProfile?.full_name||'Hungryman',
  role:'Developer',
  hasAvatar:!!ownerProfile?.avatar_key,
  profileUpdated:Number(ownerProfile?.updated)||0,
  lastSeen:Number(ownerProfile?.last_seen)||0,
  isOwner:true,
 };
 return [...(ownerProfile?[owner]:[]),...results.filter(row=>row.email.toLowerCase()!==OWNER_EMAIL).map(row=>({
  userId:row.user_id||null,
  email:row.email.toLowerCase(),
  fullName:row.employee_name||row.full_name||row.email,
  role:row.role,
  hasAvatar:!!row.avatar_key,
  profileUpdated:Number(row.updated)||0,
  lastSeen:Number(row.last_seen)||0,
  isOwner:false,
  isSiteAdmin:!!row.site_admin,
  systemPermissions:row.site_admin?parseSystemPermissions(row.system_permissions):[],
 }))];
}
