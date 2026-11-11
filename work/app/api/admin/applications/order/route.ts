import {hasPermission} from '@/lib/permissions';
import {storage} from '@/lib/storage';
import {getAdminAccess} from '@/lib/admin';
import {sameOrigin} from '@/lib/visitor';
export const dynamic='force-dynamic';
export async function PATCH(req:Request){
 if(!hasPermission(await getAdminAccess(),'applications.edit'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{const body=await req.json() as {orderedIds?:string[]};const ids=body.orderedIds;if(!Array.isArray(ids)||ids.length>500||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id)))return Response.json({error:'განაცხადების რიგი არასწორია.'},{status:400});const {DB}=storage();if(ids.length)await DB.batch(ids.map((id,index)=>DB.prepare('UPDATE applications SET manual_order=? WHERE id=?').bind(ids.length-index,id)));return Response.json({ok:true});}catch{return Response.json({error:'განაცხადების რიგი ვერ შეინახა.'},{status:503});}
}
