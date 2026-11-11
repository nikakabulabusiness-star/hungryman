import {hasPermission} from '@/lib/permissions';
import {isAdmin,getAdminAccess} from '@/lib/admin';
import {storage} from '@/lib/storage';
import {sameOrigin,visitorKey} from '@/lib/visitor';
export const dynamic='force-dynamic';
const ACTIVE_WINDOW=90*1000;
export async function POST(req:Request){
 if(!sameOrigin(req))return Response.json({ok:false},{status:403});
 try{if(await isAdmin())return Response.json({ok:true});const visitor=await visitorKey(req),now=Date.now();await storage().DB.prepare('INSERT INTO site_visitors (visitor,first_seen,last_seen) VALUES (?,?,?) ON CONFLICT(visitor) DO UPDATE SET last_seen=excluded.last_seen').bind(visitor,now,now).run();return Response.json({ok:true});}catch{return Response.json({ok:false},{status:503});}
}
export async function GET(){
 if(!hasPermission(await getAdminAccess(),'analytics.view'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 try{const {DB}=storage(),now=Date.now();const [active,total]=await Promise.all([DB.prepare('SELECT COUNT(*) AS count FROM site_visitors WHERE last_seen>?').bind(now-ACTIVE_WINDOW).first<{count:number}>(),DB.prepare('SELECT COUNT(*) AS count FROM site_visitors').bind().first<{count:number}>()]);return Response.json({active:Number(active?.count||0),total:Number(total?.count||0),updatedAt:now});}catch{return Response.json({error:'ვიზიტორების მონაცემები დროებით მიუწვდომელია.'},{status:503});}
}
