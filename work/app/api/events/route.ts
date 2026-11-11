import {storage} from '@/lib/storage';
import {roles} from '@/lib/questions';
import {sameOrigin,visitorKey} from '@/lib/visitor';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 if(!sameOrigin(req))return Response.json({ok:false},{status:403});
 try{const body=await req.json() as {role?:string;kind?:string};if(!body.role||!Object.hasOwn(roles,body.role)||!['view','started'].includes(body.kind||''))return Response.json({ok:false},{status:400});const visitor=await visitorKey(req);const {DB}=storage();const recent=await DB.prepare('SELECT id FROM recruitment_events WHERE role=? AND kind=? AND visitor=? AND created>? LIMIT 1').bind(body.role,body.kind,visitor,Date.now()-24*60*60*1000).first();if(!recent)await DB.prepare('INSERT INTO recruitment_events (created,role,kind,visitor) VALUES (?,?,?,?)').bind(Date.now(),body.role,body.kind,visitor).run();return Response.json({ok:true});}catch{return Response.json({ok:false},{status:503});}
}
