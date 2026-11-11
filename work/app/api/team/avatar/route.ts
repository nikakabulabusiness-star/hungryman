import {hasPermission} from '@/lib/permissions';
import {getStaffAccess,syncStaffProfile} from '@/lib/staff-access';
import {OWNER_EMAIL} from '@/lib/staff-auth';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';

export const dynamic='force-dynamic';
const MAX_SIZE=5*1024*1024;
const normalize=(value:string|null)=>String(value||'').trim().toLowerCase();
const validEmail=(value:string)=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function imageType(bytes:Uint8Array):'image/jpeg'|'image/png'|'image/webp'|null{
 if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return'image/jpeg';
 if(bytes.length>=8&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a)return'image/png';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return'image/webp';
 return null;
}

async function approvedAccess(){
 const access=await getStaffAccess();
 return access?.isApproved&&hasPermission(access,'workspace.view')?access:null;
}

async function targetIsApproved(email:string){
 if(email===OWNER_EMAIL)return true;
 return !!await storage().DB.prepare("SELECT email FROM admin_users WHERE lower(email)=? AND status='approved' LIMIT 1").bind(email).first();
}

export async function GET(request:Request){
 const access=await approvedAccess();if(!access)return new Response(null,{status:403});
 try{
  const params=new URL(request.url).searchParams,userId=String(params.get('userId')||access.userId).trim();
  if(userId.length>256)return new Response(null,{status:404});
  const profile=await storage().DB.prepare('SELECT email,avatar_key FROM team_members WHERE user_id=? LIMIT 1').bind(userId).first<{email:string;avatar_key:string|null}>();
  if(!profile?.avatar_key)return new Response(null,{status:404});
  const email=normalize(profile.email);
  if(!validEmail(email)||!await targetIsApproved(email))return new Response(null,{status:404});
  const object=await storage().BUCKET.get(profile.avatar_key);if(!object)return new Response(null,{status:404});
  const headers=new Headers({'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'});
  if(object.httpEtag)headers.set('ETag',object.httpEtag);
  return new Response(object.body,{headers});
 }catch{return new Response(null,{status:503})}
}

export async function POST(request:Request){
 const access=await approvedAccess();if(!access||!hasPermission(access,'cabinet.view'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 if(!sameOrigin(request))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 let newKey:string|null=null;
 try{
  const synced=await syncStaffProfile(access,{touch:true}),form=await request.formData(),file=form.get('avatar');
  if(!(file instanceof File)||file.size<1||file.size>MAX_SIZE)return Response.json({error:'აირჩიე JPG, PNG ან WEBP — მაქსიმუმ 5 MB.'},{status:400});
  const bytes=new Uint8Array(await file.arrayBuffer()),type=imageType(bytes);
  if(!type)return Response.json({error:'ფაილი უნდა იყოს ნამდვილი JPG, PNG ან WEBP სურათი.'},{status:400});
  const {DB,BUCKET}=storage(),old=await DB.prepare('SELECT avatar_key FROM team_members WHERE lower(email)=? LIMIT 1').bind(synced.email).first<{avatar_key:string|null}>(),version=Date.now();
  newKey=`staff-avatars/${synced.userId}/${crypto.randomUUID()}`;
  await BUCKET.put(newKey,bytes,{httpMetadata:{contentType:type}});
  const result=await DB.prepare('UPDATE team_members SET avatar_key=?,updated=?,last_seen=? WHERE lower(email)=?').bind(newKey,version,version,synced.email).run();
  if(!result.meta.changes)throw new Error('Profile update failed');
  if(old?.avatar_key&&old.avatar_key!==newKey)try{await BUCKET.delete(old.avatar_key)}catch(error){console.error('Old staff avatar cleanup failed',error)}
  return Response.json({ok:true,version});
 }catch(error){
  if(newKey)try{await storage().BUCKET.delete(newKey)}catch(cleanupError){console.error('New staff avatar cleanup failed',cleanupError)}
  console.error('Staff avatar upload failed',error);
  return Response.json({error:'პროფილის ფოტო დროებით ვერ განახლდა.'},{status:503});
 }
}

export async function DELETE(request:Request){
 const access=await approvedAccess();if(!access||!hasPermission(access,'cabinet.view'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 if(!sameOrigin(request))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{
  const synced=await syncStaffProfile(access,{touch:true}),{DB,BUCKET}=storage(),profile=await DB.prepare('SELECT avatar_key FROM team_members WHERE lower(email)=? LIMIT 1').bind(synced.email).first<{avatar_key:string|null}>(),now=Date.now();
  await DB.prepare('UPDATE team_members SET avatar_key=NULL,updated=?,last_seen=? WHERE lower(email)=?').bind(now,now,synced.email).run();
  if(profile?.avatar_key)try{await BUCKET.delete(profile.avatar_key)}catch(error){console.error('Staff avatar delete cleanup failed',error)}
  return Response.json({ok:true,version:now});
 }catch{return Response.json({error:'პროფილის ფოტო დროებით ვერ წაიშალა.'},{status:503})}
}
