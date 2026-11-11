import {hasPermission} from '@/lib/permissions';
import {getStaffAccess} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||!hasPermission(a,'shoots.view'))return new Response(null,{status:403});
 const id=new URL(req.url).searchParams.get('id')||'',{DB,BUCKET}=storage();
 const photo=await DB.prepare('SELECT object_key,mime FROM shoot_photos WHERE id=? AND (user_id=? OR id IN (SELECT photo_id FROM shoots WHERE photo_id IS NOT NULL)) UNION ALL SELECT object_key,mime FROM work_files WHERE id=? AND EXISTS(SELECT 1 FROM shoots WHERE photo_id=work_files.id) LIMIT 1').bind(id,a.userId,id).first<{object_key:string;mime:string}>();
 if(!photo)return new Response(null,{status:404});const obj=await BUCKET.get(photo.object_key);
 return obj?new Response(obj.body,{headers:{'Content-Type':photo.mime,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}}):new Response(null,{status:404});
}
export async function POST(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||!(a.canCreateShoots||a.canEditShoots)||!sameOrigin(req))return Response.json({error:'ფოტოს ატვირთვის უფლება არ გაქვს.'},{status:403});
 try{
  const limit=5*1024*1024,id=new URL(req.url).searchParams.get('id')||crypto.randomUUID();
  if(!/^[a-f\d-]{36}$/i.test(id))return Response.json({error:'არასწორი ფაილი.'},{status:400});
  if(Number(req.headers.get('content-length')||0)>limit)return Response.json({error:'ფოტო უნდა იყოს 5 MB-მდე.'},{status:413});
  const bytes=new Uint8Array(await req.arrayBuffer()),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
  if(!bytes.length||bytes.length>limit||(!jpeg&&!png))return Response.json({error:'აირჩიე JPG ან PNG ფოტო, 5 MB-მდე.'},{status:400});
  const {DB,BUCKET}=storage(),existing=await DB.prepare('SELECT user_id FROM shoot_photos WHERE id=?').bind(id).first<{user_id:string}>();
  if(existing)return existing.user_id===a.userId?Response.json({id}):Response.json({error:'ფაილის ID უკვე გამოიყენება.'},{status:409});
  const count=await DB.prepare('SELECT COUNT(*) AS n FROM shoot_photos WHERE user_id=? AND created>?').bind(a.userId,Date.now()-3600000).first<{n:number}>();
  if((count?.n||0)>=40)return Response.json({error:'ატვირთვების ლიმიტი ამოიწურა. მოგვიანებით სცადე.'},{status:429});
  const key='shoot-photos/'+id,mime=jpeg?'image/jpeg':'image/png';await BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
  await DB.prepare('INSERT INTO shoot_photos (id,user_id,object_key,mime,created) VALUES (?,?,?,?,?)').bind(id,a.userId,key,mime,Date.now()).run();
  return Response.json({id},{status:201});
 }catch{return Response.json({error:'ფოტო ვერ აიტვირთა. სცადე ხელახლა.'},{status:503})}
}
