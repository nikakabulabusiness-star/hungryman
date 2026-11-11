import {hasPermission} from '@/lib/permissions';
import {getAdminAccess,isAdmin} from '@/lib/admin';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {applicationStatuses} from '@/lib/workflow';
export const dynamic='force-dynamic';
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!hasPermission(await getAdminAccess(),'applications.edit'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{const {id}=await params;const body=await req.json() as {status?:string;rating?:number;note?:string};if(!body.status||!Object.hasOwn(applicationStatuses,body.status))return Response.json({error:'აირჩიე სწორი სტატუსი.'},{status:400});const rating=Number(body.rating)||0;if(rating<0||rating>5)return Response.json({error:'შეფასება უნდა იყოს 0-დან 5-მდე.'},{status:400});const note=String(body.note||'').trim().slice(0,3000);await storage().DB.prepare('UPDATE applications SET status=?,rating=?,admin_note=?,updated=? WHERE id=?').bind(body.status,rating,note,Date.now(),id).run();return Response.json({ok:true});}catch{return Response.json({error:'ცვლილება ვერ შეინახა.'},{status:503});}
}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 const access=await getAdminAccess();if(!access?.canDeleteApplications)return Response.json({error:'განაცხადის წაშლის უფლება არ გაქვს.'},{status:403});
 if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{const {id}=await params;if(!/^[0-9a-f-]{36}$/.test(id))return Response.json({error:'განაცხადი ვერ მოიძებნა.'},{status:404});const {DB,BUCKET}=storage();const row=await DB.prepare('SELECT file_key FROM applications WHERE id=?').bind(id).first<{file_key:string|null}>();if(!row)return Response.json({error:'განაცხადი ვერ მოიძებნა.'},{status:404});const result=await DB.prepare('DELETE FROM applications WHERE id=?').bind(id).run();if(!result.meta.changes)return Response.json({error:'განაცხადი ვერ მოიძებნა.'},{status:404});if(row.file_key)try{await BUCKET.delete(row.file_key)}catch(e){console.error('Deleted application file cleanup failed',e)}return Response.json({ok:true,id});}catch{return Response.json({error:'განაცხადი ვერ წაიშალა.'},{status:503});}
}
