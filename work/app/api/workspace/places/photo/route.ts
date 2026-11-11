import {getStaffAccess} from '@/lib/staff-access';
import {hasPermission} from '@/lib/permissions';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {placeId} from '@/lib/map-coordinates';
export const dynamic='force-dynamic';
const limit=256*1024;
export async function GET(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||a.features?.map===false||!hasPermission(a,'workspace.view'))return new Response(null,{status:403});
 const params=new URL(req.url).searchParams,id=params.get('id');if(!placeId(id))return new Response(null,{status:404});
 const {DB,BUCKET}=storage(),photo=await DB.prepare('SELECT object_key,mime FROM place_photos WHERE id=? AND (user_id=? OR id IN(SELECT photo_id FROM workspace_places))').bind(id,a.userId).first<{object_key:string;mime:string}>();
 if(!photo)return new Response(null,{status:404});
 const object=await BUCKET.get(photo.object_key);if(!object)return new Response(null,{status:404});
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Vary':'Authorization, Cookie'};
 if(params.get('data')==='1'){
  const bytes=new Uint8Array(await object.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  return Response.json({uri:'data:'+photo.mime+';base64,'+btoa(binary)},{headers});
 }
 return new Response(object.body,{headers:{...headers,'Content-Type':photo.mime}});
}
async function readPhoto(req:Request){
 if(Number(req.headers.get('content-length')||0)>limit||!req.body)return null;
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();return null}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length}return bytes;
}
export async function POST(req:Request){
 const a=await getStaffAccess();if(!a?.isApproved||!hasPermission(a,'map.manage')||!sameOrigin(req))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 const bytes=await readPhoto(req);if(!bytes)return Response.json({error:'აირჩიე პატარა ფოტო, 256 KB-მდე.'},{status:413});
 const jpeg=bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const png=bytes.length>24&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
 if(!jpeg&&!png)return Response.json({error:'საჭიროა JPG ან PNG ფოტო.'},{status:400});
 const {DB,BUCKET}=storage(),count=await DB.prepare('SELECT COUNT(*) AS n FROM place_photos WHERE user_id=? AND created>?').bind(a.userId,Date.now()-3600000).first<{n:number}>();
 if((count?.n||0)>=40)return Response.json({error:'ატვირთვების ლიმიტი. მოგვიანებით სცადე.'},{status:429});
 const id=crypto.randomUUID(),key='place-photos/'+id,mime=jpeg?'image/jpeg':'image/png';
 await BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
 try{await DB.prepare('INSERT INTO place_photos (id,user_id,object_key,mime,created) VALUES (?,?,?,?,?)').bind(id,a.userId,key,mime,Date.now()).run()}catch(e){await BUCKET.delete(key);throw e}
 return Response.json({id},{status:201,headers:{'Cache-Control':'private, no-store'}});
}
