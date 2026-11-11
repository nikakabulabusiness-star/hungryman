import {getStaffAccess} from '@/lib/staff-access';
import {hasPermission} from '@/lib/permissions';
import {sameOrigin} from '@/lib/visitor';
import {storage} from '@/lib/storage';
import {listPlaces} from '@/lib/map-places';
import {mapsLink,placeId,resolveMapCoordinates,validCoordinates} from '@/lib/map-coordinates';
export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private, no-store'};
export async function GET(){
 const a=await getStaffAccess();
 if(!a?.isApproved||a.features?.map===false||!hasPermission(a,'workspace.view'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 return Response.json({places:await listPlaces(),canManage:hasPermission(a,'map.manage')},{headers:privateHeaders});
}
export async function POST(req:Request){
 const a=await getStaffAccess();
 if(!a?.isApproved||!hasPermission(a,'map.manage')||!sameOrigin(req))return Response.json({error:'ადგილის მართვის უფლება არ გაქვს.'},{status:403});
 const b=await req.json().catch(()=>null) as Record<string,unknown>|null;
 if(!b||typeof b!=='object')return Response.json({error:'არასწორი მოთხოვნა.'},{status:400});
 if(b.action==='resolve'){
  const coordinates=await resolveMapCoordinates(b.url);
  return coordinates?Response.json(coordinates,{headers:privateHeaders}):Response.json({error:'ბმულში ზუსტი წერტილი ვერ მოიძებნა. გამოიყენე სრული Google Maps / Apple Maps ბმული ან რუკაზე მონიშნე ადგილი.'},{status:400});
 }
 if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>80)return Response.json({error:'მიუთითე სახელი, 80 სიმბოლომდე.'},{status:400});
 const explicit=b.latitude!==undefined||b.longitude!==undefined;
 const coords=explicit?(validCoordinates(b)?{latitude:b.latitude,longitude:b.longitude}:null):await resolveMapCoordinates(b.url);
 if(!coords)return Response.json({error:'რუკაზე მონიშნე წერტილი ან მიუთითე კოორდინატების შემცველი რუკის ბმული.'},{status:400});
 const db=storage().DB,id=b.id===undefined?crypto.randomUUID():b.id,now=Date.now();
 if(!placeId(id)||b.photoId!==undefined&&b.photoId!==null&&!placeId(b.photoId))return Response.json({error:'არასწორი ადგილი ან ფოტო.'},{status:400});
 const old=b.id?await db.prepare('SELECT id,photo_id FROM workspace_places WHERE id=?').bind(id).first<{id:string;photo_id:string|null}>():null;
 if(b.id&&!old)return Response.json({error:'ეს ადგილი უკვე წაშლილია. განაახლე რუკა.'},{status:404});
 const photoId=b.photoId===undefined?(old?.photo_id||null):b.photoId;
 if(photoId&&!(await db.prepare('SELECT id FROM place_photos WHERE id=? AND (user_id=? OR id=?)').bind(photoId,a.userId,old?.photo_id||null).first()))return Response.json({error:'ფოტო ვერ მოიძებნა. თავიდან ატვირთე.'},{status:400});
 const url=mapsLink(coords);
 if(old){
  const result=await db.prepare('UPDATE workspace_places SET name=?,latitude=?,longitude=?,url=?,photo_id=?,updated=?,updated_by=? WHERE id=?').bind(b.name.trim(),coords.latitude,coords.longitude,url,photoId,now,a.userId,id).run();
  if(!result.meta.changes)return Response.json({error:'ეს ადგილი უკვე წაშლილია.'},{status:404});
 }else{
  const result=await db.prepare('INSERT INTO workspace_places (id,name,latitude,longitude,url,photo_id,created,updated,updated_by) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM workspace_places)<100').bind(id,b.name.trim(),coords.latitude,coords.longitude,url,photoId,now,now,a.userId).run();
  if(!result.meta.changes)return Response.json({error:'რუკაზე მაქსიმუმ 100 ადგილის შენახვა შეიძლება.'},{status:409});
 }
 return Response.json({id},{status:old?200:201,headers:privateHeaders});
}
export async function DELETE(req:Request){
 const a=await getStaffAccess();
 if(!a?.isApproved||!hasPermission(a,'map.manage')||!sameOrigin(req))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 const b=await req.json().catch(()=>null) as Record<string,unknown>|null;
 if(!placeId(b?.id))return Response.json({error:'აირჩიე ადგილი.'},{status:400});
 await storage().DB.prepare('DELETE FROM workspace_places WHERE id=?').bind(b.id).run();
 return Response.json({ok:true},{headers:privateHeaders});
}
