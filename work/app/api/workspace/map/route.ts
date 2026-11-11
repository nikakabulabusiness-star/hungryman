import {hasPermission} from '@/lib/permissions';
import {getStaffAccess} from '@/lib/staff-access';
import {officeConfig,localDate} from '@/lib/attendance';
import {storage} from '@/lib/storage';
import {listPlaces} from '@/lib/map-places';

export const dynamic='force-dynamic';
export async function GET(req:Request){
  const access=await getStaffAccess();
  if(!access?.isApproved||access.features?.map===false||!hasPermission(access,'workspace.view'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
  const places=await listPlaces(),canManagePlaces=hasPermission(access,'map.manage');
  if(!hasPermission(access,'shoots.view'))return Response.json({office:await officeConfig(),shoots:[],history:[],historyCursor:null,places,canManagePlaces},{headers:{'Cache-Control':'private, no-store'}});
  const params=new URL(req.url).searchParams,beforeDate=params.get('beforeDate'),beforeId=params.get('beforeId');
  if((beforeDate||beforeId)&&(!beforeDate||!/^\d{4}-\d{2}-\d{2}$/.test(beforeDate)||!beforeId||beforeId.length>100))return Response.json({error:'არასწორი გვერდი.'},{status:400});
  const {DB}=storage(),today=localDate(),fields='id,title,shoot_date,start_time,location_name,location_url,latitude,longitude,status';
  const cursor=beforeDate&&beforeId?' AND (shoot_date<? OR (shoot_date=? AND id<?))':'';
  const history=(await DB.prepare(`SELECT ${fields} FROM shoots WHERE status!='cancelled' AND (shoot_date<? OR (shoot_date=? AND status='completed'))${cursor} ORDER BY shoot_date DESC,id DESC LIMIT 101`).bind(today,today,...(cursor?[beforeDate,beforeDate,beforeId]:[])).all()).results as {id:string;shoot_date:string}[];
  const hasMore=history.length>100,items=history.slice(0,100),last=items.at(-1);
  const shoots=(await DB.prepare(`SELECT ${fields} FROM shoots WHERE status='planned' AND shoot_date>=? ORDER BY shoot_date,start_time LIMIT 100`).bind(today).all()).results;
  return Response.json({office:await officeConfig(),shoots,history:items,historyCursor:hasMore&&last?{date:last.shoot_date,id:last.id}:null,places,canManagePlaces},{headers:{'Cache-Control':'private, no-store'}});
}
