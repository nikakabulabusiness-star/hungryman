import {hasPermission} from '@/lib/permissions';
import {getAdminAccess} from '@/lib/admin';
import {storage} from '@/lib/storage';
export const dynamic='force-dynamic';
export async function GET(){
 const access=await getAdminAccess();if(!access||!hasPermission(access,'analytics.view'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 try{
  const {DB}=storage(),now=Date.now();
  const [visitors,applications,statuses,funnel,positions]=await Promise.all([
   DB.prepare('SELECT COUNT(*) AS total,SUM(CASE WHEN last_seen>? THEN 1 ELSE 0 END) AS active FROM site_visitors').bind(now-90_000).first<{total:number;active:number}>(),
   DB.prepare('SELECT COUNT(*) AS total,AVG(CASE WHEN form_rating>0 THEN form_rating END) AS rating,SUM(CASE WHEN form_rating>0 THEN 1 ELSE 0 END) AS reviews FROM applications').first<{total:number;rating:number|null;reviews:number}>(),
   DB.prepare('SELECT status,COUNT(*) AS count FROM applications GROUP BY status').all<{status:string;count:number}>(),
   DB.prepare('SELECT kind,COUNT(*) AS count FROM recruitment_events WHERE created>? GROUP BY kind').bind(now-30*86400000).all<{kind:string;count:number}>(),
   DB.prepare('SELECT position,COUNT(*) AS count FROM applications GROUP BY position ORDER BY count DESC').all<{position:string;count:number}>(),
  ]);
  let team=null;
  if(hasPermission(access,'employees.view')){
   const [employees,accounts,roles]=await Promise.all([
    DB.prepare('SELECT COUNT(*) AS total FROM employees').first<{total:number}>(),
    DB.prepare('SELECT status,COUNT(*) AS count FROM team_members WHERE password_hash IS NOT NULL GROUP BY status').all<{status:string;count:number}>(),
    DB.prepare("SELECT role,COUNT(*) AS count FROM team_members WHERE status='approved' AND role IS NOT NULL GROUP BY role ORDER BY count DESC").all<{role:string;count:number}>(),
   ]);team={employees:employees?.total||0,accounts:accounts.results,roles:roles.results};
  }
  return Response.json({visitors:{total:visitors?.total||0,active:visitors?.active||0},applications:{total:applications?.total||0,rating:applications?.rating??null,reviews:applications?.reviews||0},statuses:statuses.results,funnel:funnel.results,positions:positions.results,team,updatedAt:now});
 }catch{return Response.json({error:'ანალიტიკა დროებით მიუწვდომელია.'},{status:503})}
}
