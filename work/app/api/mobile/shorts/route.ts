import {getAdminAccess} from '@/lib/admin';
import {getStaffAccess} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {audit} from '@/lib/attendance';
import {DEFAULT_SHORTS,shortsHandles,shortsSources} from '@/lib/shorts';
export const dynamic='force-dynamic';
export async function GET(){
  const access=await getStaffAccess();
  if(!access?.isApproved)return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
  const saved=await storage().DB.prepare("SELECT value FROM workspace_settings WHERE key='shorts.sources'").first<{value:string}>();
  let handles=DEFAULT_SHORTS;
  try{handles=shortsHandles(JSON.parse(saved?.value||'null'))||DEFAULT_SHORTS}catch{}
  return Response.json({sources:shortsSources(handles),canManage:!!(await getAdminAccess())?.isOwner},{headers:{'Cache-Control':'private, no-store'}});
}
export async function PUT(req:Request){
  const access=await getAdminAccess();
  if(!access?.isOwner||!sameOrigin(req))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
  let body:unknown;try{body=await req.json()}catch{return Response.json({error:'არასწორი მონაცემები.'},{status:400})}
  const handles=shortsHandles(body);
  if(!handles)return Response.json({error:'მიუთითე ანგარიშების სახელები, ბმულის გარეშე (2–30 სიმბოლო).'},{status:400});
  await storage().DB.prepare("INSERT INTO workspace_settings (key,value,updated,updated_by) VALUES ('shorts.sources',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated,updated_by=excluded.updated_by").bind(JSON.stringify(handles),Date.now(),access.email).run();
  await audit(access.email,'shorts.sources','shorts',handles);
  return Response.json({sources:shortsSources(handles),canManage:true});
}
