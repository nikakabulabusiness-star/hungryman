import {getSessionUser} from '@/lib/staff-auth';
import {getStaffAccess} from '@/lib/staff-access';
import {getAdminAccess,DEVELOPER_EMAIL} from '@/lib/admin';
export const dynamic='force-dynamic';
export async function GET(){
 const user=await getSessionUser();
 if(!user)return Response.json({error:'ავტორიზაცია საჭიროა.'},{status:401,headers:{'Cache-Control':'no-store'}});
 const permissions=await getAdminAccess(user);
 const profile=await getStaffAccess(user,permissions||undefined);
 return Response.json({user:{userId:user.userId,email:user.email,fullName:profile?.fullName||user.fullName,phone:user.phone,role:profile?.role||user.role,status:profile?.status||user.status,hasAvatar:profile?.hasAvatar||false,profileUpdated:profile?.profileUpdated||0},permissions,developer:{available:user.email===DEVELOPER_EMAIL,previewRole:permissions?.previewRole||null}},{headers:{'Cache-Control':'private, no-store'}});
}
