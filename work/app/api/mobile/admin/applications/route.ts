import {hasPermission} from '@/lib/permissions';
import {getAdminAccess} from '@/lib/admin';
import {storage} from '@/lib/storage';
import {getVacancyStates} from '@/lib/vacancies';
import {getGroups,roles,type Role} from '@/lib/questions';
export const dynamic='force-dynamic';
export async function GET(){
 if(!hasPermission(await getAdminAccess(),'applications.view'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 const rows=await storage().DB.prepare('SELECT id,created,name,email,position,answers,status,rating,form_rating,manual_order,admin_note FROM applications ORDER BY created DESC LIMIT 500').all();
 const questionLabels=Object.fromEntries((Object.keys(roles) as Role[]).map(role=>[role,Object.fromEntries(getGroups(role).flatMap(group=>group.fields.map(field=>[field.id,field.label])))]));
 return Response.json({applications:rows.results,vacancies:Object.values(await getVacancyStates()),roles,questionLabels},{headers:{'Cache-Control':'private, no-store'}});
}
