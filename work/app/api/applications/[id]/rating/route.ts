import {storage} from '@/lib/storage';
import {sameOrigin,visitorKey} from '@/lib/visitor';
export const dynamic='force-dynamic';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{const {id}=await params;const body=await req.json() as {rating?:number};const rating=Number(body.rating);if(!Number.isInteger(rating)||rating<1||rating>5)return Response.json({error:'აირჩიე შეფასება 1-დან 5 ვარსკვლავამდე.'},{status:400});const submitter=await visitorKey(req);const {DB}=storage();const row=await DB.prepare('SELECT id FROM applications WHERE id=? AND submitter=?').bind(id,submitter).first();if(!row)return Response.json({error:'განაცხადი ვერ მოიძებნა.'},{status:404});await DB.prepare('UPDATE applications SET form_rating=?,updated=? WHERE id=? AND submitter=?').bind(rating,Date.now(),id,submitter).run();return Response.json({ok:true,rating});}catch{return Response.json({error:'შეფასება ვერ გაიგზავნა.'},{status:503});}
}
