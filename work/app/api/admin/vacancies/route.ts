import {hasPermission} from '@/lib/permissions';
import {getAdminAccess} from '@/lib/admin';
import {storage} from '@/lib/storage';
import {roles} from '@/lib/questions';
import {sameOrigin} from '@/lib/visitor';
export const dynamic='force-dynamic';
export async function PATCH(req:Request){
 if(!hasPermission(await getAdminAccess(),'applications.edit'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{const body=await req.json() as {role?:string;isOpen?:boolean;deadline?:string};if(!body.role||!Object.hasOwn(roles,body.role))return Response.json({error:'ვაკანსია ვერ მოიძებნა.'},{status:400});const deadline=body.deadline?.trim()||null;if(deadline&&!/^\d{4}-\d{2}-\d{2}$/.test(deadline))return Response.json({error:'მიუთითე სწორი თარიღი.'},{status:400});await storage().DB.prepare('INSERT INTO vacancies (role,is_open,deadline,updated) VALUES (?,?,?,?) ON CONFLICT(role) DO UPDATE SET is_open=excluded.is_open,deadline=excluded.deadline,updated=excluded.updated').bind(body.role,body.isOpen?1:0,deadline,Date.now()).run();return Response.json({ok:true});}catch{return Response.json({error:'ვაკანსიის პარამეტრები ვერ შეინახა.'},{status:503});}
}
