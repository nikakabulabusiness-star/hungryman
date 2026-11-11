import {getStaffAccess} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {absenceExists,canManageAbsences,findAbsence,validAbsenceId} from '@/lib/absences';
export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(req:Request){
 const actor=await getStaffAccess();if(!actor?.isApproved||!canManageAbsences(actor))return new Response(null,{status:403,headers:privateHeaders});
 const id=new URL(req.url).searchParams.get('id')||'';if(!validAbsenceId(id)||id.startsWith('request-'))return new Response(null,{status:404});
 const {DB,BUCKET}=storage(),row=await DB.prepare('SELECT object_key,name,mime,absence_id FROM staff_absence_documents WHERE id=?').bind(id).first<{object_key:string;name:string;mime:string;absence_id:string}>();
 if(!row||!await findAbsence(row.absence_id))return new Response(null,{status:404});const object=await BUCKET.get(row.object_key);
 return object?new Response(object.body,{headers:{...privateHeaders,'Content-Type':row.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(row.name),'Content-Security-Policy':"sandbox; default-src 'none'"}}):new Response(null,{status:404});
}
export async function POST(req:Request){
 const actor=await getStaffAccess();if(!actor?.isApproved||!canManageAbsences(actor)||!sameOrigin(req))return Response.json({error:'დოკუმენტზე წვდომა შეზღუდულია.'},{status:403});
 const url=new URL(req.url),absenceId=url.searchParams.get('absenceId')||'',limit=5*1024*1024;
 if(!validAbsenceId(absenceId))return Response.json({error:'ჩანაწერი ვერ მოიძებნა.'},{status:404});
 const absence=await findAbsence(absenceId);if(!absence||absence.kind!=='sick')return Response.json({error:'საბუთი მხოლოდ ბიულეტენს ემატება.'},{status:400});
 if(Number(req.headers.get('content-length')||0)>limit)return Response.json({error:'ფაილი უნდა იყოს 5 MB-მდე.'},{status:413});
 const bytes=await readBoundedBody(req,limit);if(!bytes?.length)return Response.json({error:'ფაილი უნდა იყოს 5 MB-მდე.'},{status:413});
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=bytes.length>8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10,pdf=bytes.length>5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-';
 if(!jpeg&&!png&&!pdf)return Response.json({error:'აირჩიე PDF, JPG ან PNG ფაილი.'},{status:400});
 const {DB,BUCKET}=storage(),mime=pdf?'application/pdf':jpeg?'image/jpeg':'image/png',id=crypto.randomUUID(),key='private-absence-documents/'+absenceId+'/'+id,name=(url.searchParams.get('name')||'საბუთი').replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,120),now=Date.now();
 await BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
 try{
  const inserted=await DB.prepare(`INSERT INTO staff_absence_documents (id,absence_id,object_key,name,mime,size,created,created_by) SELECT ?,?,?,?,?,?,?,? WHERE ${absenceExists} AND (SELECT COUNT(*) FROM staff_absence_documents WHERE absence_id=?)<10`).bind(id,absenceId,key,name,mime,bytes.length,now,actor.email,absenceId,absenceId,absenceId).run();
  if(!inserted.meta.changes){await BUCKET.delete(key);return Response.json({error:'ჩანაწერი წაიშალა ან 10 საბუთის ლიმიტი ამოიწურა.'},{status:409})}
 }catch{await BUCKET.delete(key).catch(()=>{});return Response.json({error:'ფაილის შენახვა ვერ მოხერხდა.'},{status:503})}
 return Response.json({id},{status:201,headers:privateHeaders});
}

async function readBoundedBody(request:Request,limit:number):Promise<Uint8Array|null>{
 if(!request.body)return null;
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return null}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return bytes;
}
