import {hasPermission} from '@/lib/permissions';
import {getStaffAccess,listApprovedStaff} from '@/lib/staff-access';
import {getShoot,validateShootInput} from '@/lib/shoots';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';

export const dynamic='force-dynamic';

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const access=await getStaffAccess();if(!access?.isApproved||!hasPermission(access,'shoots.view'))return Response.json({error:'თანამშრომლის წვდომა საჭიროა.'},{status:403});
 try{const {id}=await params,shoot=await getShoot(id);return shoot?Response.json({shoot}):Response.json({error:'გადაღება ვერ მოიძებნა.'},{status:404})}catch{return Response.json({error:'გადაღება დროებით მიუწვდომელია.'},{status:503})}
}

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const access=await getStaffAccess();if(!access?.isApproved||!access.canEditShoots)return Response.json({error:'გადაღების რედაქტირების უფლება არ გაქვს.'},{status:403});
 if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{
  const {id}=await params;const existing=await getShoot(id);if(!existing)return Response.json({error:'გადაღება ვერ მოიძებნა.'},{status:404});
  if(existing.work_video_id)return Response.json({error:'ეს გადაღება დამტკიცებულ ქოლშითს უკავშირდება. ცვლილება შეიტანე Work სივრცეში და ხელახლა გააგზავნე დასამტკიცებლად.'},{status:409});
  const raw=await req.json() as Record<string,unknown>,parsed=validateShootInput(raw);if(!parsed.ok)return Response.json({error:parsed.error},{status:400});
  const input=parsed.value;if(!Object.hasOwn(raw,'photoId'))input.photoId=existing.photo_id;const people=await listApprovedStaff(),directory=new Map(people.map(person=>[person.email.toLowerCase(),person]));
  if(input.photoId&&input.photoId!==existing.photo_id&&!await storage().DB.prepare('SELECT id FROM shoot_photos WHERE id=? AND user_id=?').bind(input.photoId,access.userId).first())return Response.json({error:'ფოტო ვერ მოიძებნა.'},{status:400});
  for(const assignment of input.assignments)if(!directory.has(assignment.assigneeEmail))return Response.json({error:'არჩეული თანამშრომელი აქტიურ გუნდში ვერ მოიძებნა.'},{status:400});
  const {DB}=storage(),now=Date.now(),statusLabel=input.status==='completed'?'დასრულებული':input.status==='cancelled'?'გაუქმებული':'დაგეგმილი',notice=`${statusLabel} გადაღება: ${input.title} — ${input.shootDate}, ${input.startTime}`,statements=[DB.prepare('UPDATE shoots SET title=?,shoot_date=?,start_time=?,end_time=?,location_name=?,location_url=?,details=?,status=?,updated=?,updated_by=? WHERE id=? AND work_video_id IS NULL').bind(input.title,input.shootDate,input.startTime,input.endTime||null,input.locationName,input.locationUrl||null,input.details,input.status,now,access.email,id),DB.prepare('DELETE FROM shoot_tasks WHERE shoot_id=? AND EXISTS(SELECT 1 FROM shoots WHERE id=? AND work_video_id IS NULL)').bind(id,id),DB.prepare("UPDATE staff_chat_messages SET body=? WHERE kind='shoot' AND reference_id=? AND EXISTS(SELECT 1 FROM shoots WHERE id=? AND work_video_id IS NULL)").bind(notice,id,id)];
  for(const assignment of input.assignments){const person=directory.get(assignment.assigneeEmail)!;statements.push(DB.prepare('INSERT INTO shoot_tasks (id,shoot_id,assignee_email,assignee_name,assignee_role,task,status,created) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM shoots WHERE id=? AND work_video_id IS NULL)').bind(crypto.randomUUID(),id,person.email,person.fullName,person.role,assignment.task,'todo',now,id))}
  statements.push(DB.prepare('UPDATE shoots SET latitude=?,longitude=?,photo_id=? WHERE id=? AND work_video_id IS NULL').bind(input.latitude,input.longitude,input.photoId,id));
  const saved=await DB.batch(statements);if(!saved[0].meta.changes)return Response.json({error:'გადაღება Work სივრცეს დაუკავშირდა. განაახლე გვერდი.'},{status:409});return Response.json({ok:true,shoot:await getShoot(id)});
 }catch{return Response.json({error:'გადაღების ცვლილება ვერ შეინახა.'},{status:503})}
}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 const access=await getStaffAccess();if(!access?.isApproved||!hasPermission(access,'shoots.delete'))return Response.json({error:'გადაღების წაშლის უფლება არ გაქვს.'},{status:403});
 if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{const {id}=await params,existing=await getShoot(id);if(!existing)return Response.json({error:'გადაღება ვერ მოიძებნა.'},{status:404});
  if(existing.work_video_id)return Response.json({error:'ქოლშითთან დაკავშირებული გადაღება არქივში ინახება. გეგმის ცვლილება Work სივრციდან შეიტანე.'},{status:409});
  const {DB}=storage();const result=await DB.batch([
   DB.prepare('DELETE FROM shoot_tasks WHERE shoot_id=? AND EXISTS(SELECT 1 FROM shoots WHERE id=? AND work_video_id IS NULL)').bind(id,id),
   DB.prepare("DELETE FROM staff_chat_messages WHERE kind='shoot' AND reference_id=? AND EXISTS(SELECT 1 FROM shoots WHERE id=? AND work_video_id IS NULL)").bind(id,id),
   DB.prepare('DELETE FROM shoots WHERE id=? AND work_video_id IS NULL').bind(id)
  ]);if(!result[2].meta.changes)return Response.json({error:'გადაღება Work სივრცეს დაუკავშირდა. განაახლე გვერდი.'},{status:409});return Response.json({ok:true})}catch{return Response.json({error:'გადაღება ვერ წაიშალა.'},{status:503})}
}
