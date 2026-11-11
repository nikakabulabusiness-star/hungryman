import {getStaffAccess} from '@/lib/staff-access';
import {hasPermission} from '@/lib/permissions';
import {getSessionUser} from '@/lib/staff-auth';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';

export const dynamic='force-dynamic';

function cleanName(value:unknown){
 const name=String(value||'').trim().replace(/\s+/g,' ');
 return name.length>=2&&name.length<=100&&!/[\u0000-\u001f\u007f]/.test(name)?name:null;
}

export async function PATCH(request:Request){
 if(!sameOrigin(request))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 const user=await getSessionUser();
 if(!user||!hasPermission(await getStaffAccess(user),'cabinet.view'))return Response.json({error:'პროფილის შეცვლა მხოლოდ დადასტურებულ თანამშრომელს შეუძლია.'},{status:403});
 try{
  const fullName=cleanName((await request.json() as {fullName?:unknown}).fullName);
  if(!fullName)return Response.json({error:'სახელი და გვარი უნდა შეიცავდეს 2–100 სიმბოლოს.'},{status:400});
  const updated=Date.now(),result=await storage().DB.prepare('UPDATE team_members SET full_name=?,updated=? WHERE user_id=?').bind(fullName,updated,user.userId).run();
  if(!result.meta.changes)return Response.json({error:'პროფილი ვერ მოიძებნა.'},{status:404});
  return Response.json({ok:true,fullName,updated},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  console.error('Staff profile update failed',error);
  return Response.json({error:'სახელი დროებით ვერ განახლდა.'},{status:503});
 }
}
