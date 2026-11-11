import {noticeStatements,dispatchNotices} from '@/lib/notifications';
import {hasPermission} from '@/lib/permissions';
import {getStaffAccess,listApprovedStaff} from '@/lib/staff-access';
import {getShoot,listShootsWithTasks,validateShootInput} from '@/lib/shoots';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';

export const dynamic='force-dynamic';

export async function GET(){
 const access=await getStaffAccess();
 if(!access?.isApproved||!hasPermission(access,'shoots.view'))return Response.json({error:'თანამშრომლის წვდომა საჭიროა.'},{status:403});
 try{return Response.json({shoots:await listShootsWithTasks(),people:await listApprovedStaff(),permissions:{canCreate:access.canCreateShoots,canEdit:access.canEditShoots,canDelete:hasPermission(access,'shoots.delete')}})}catch{return Response.json({error:'გადაღებების სია დროებით მიუწვდომელია.'},{status:503})}
}

export async function POST(req:Request){
 const access=await getStaffAccess();
 if(!access?.isApproved||!access.canCreateShoots)return Response.json({error:'გადაღების შექმნის უფლება არ გაქვს.'},{status:403});
 if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 try{
  const parsed=validateShootInput(await req.json());if(!parsed.ok)return Response.json({error:parsed.error},{status:400});
  const input=parsed.value,people=await listApprovedStaff(),directory=new Map(people.map(person=>[person.email.toLowerCase(),person]));
  if(input.photoId&&!await storage().DB.prepare('SELECT id FROM shoot_photos WHERE id=? AND user_id=?').bind(input.photoId,access.userId).first())return Response.json({error:'ფოტო ვერ მოიძებნა.'},{status:400});
  for(const assignment of input.assignments)if(!directory.has(assignment.assigneeEmail))return Response.json({error:'არჩეული თანამშრომელი აქტიურ გუნდში ვერ მოიძებნა.'},{status:400});
  const {DB}=storage(),id=crypto.randomUUID(),now=Date.now(),messageId=crypto.randomUUID();
  const statements=[DB.prepare('INSERT INTO shoots (id,title,shoot_date,start_time,end_time,location_name,location_url,details,status,created,updated,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,input.title,input.shootDate,input.startTime,input.endTime||null,input.locationName,input.locationUrl||null,input.details,input.status,now,now,access.email,access.email)];
  for(const assignment of input.assignments){const person=directory.get(assignment.assigneeEmail)!;statements.push(DB.prepare('INSERT INTO shoot_tasks (id,shoot_id,assignee_email,assignee_name,assignee_role,task,status,created) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,person.email,person.fullName,person.role,assignment.task,'todo',now))}
  const notice=`დაინიშნა ახალი გადაღება: ${input.title} — ${input.shootDate}, ${input.startTime}`;
  statements.push(DB.prepare('INSERT INTO staff_chat_messages (id,author_user_id,author_email,author_name,author_role,body,kind,reference_id,created,pinned) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(messageId,access.userId,access.email,access.fullName,access.role||'თანამშრომელი',notice,'shoot',id,now,0));
  statements.push(DB.prepare('UPDATE shoots SET latitude=?,longitude=?,photo_id=? WHERE id=?').bind(input.latitude,input.longitude,input.photoId,id));
  statements.push(...noticeStatements(people.map(p=>p.userId),{key:'shoot-created:'+id,category:'shoot',title:'ახალი გადაღება · '+input.title,body:input.shootDate+' · '+input.startTime+' · '+input.locationName,target:'shoot',targetId:id,important:true,created:now}));
  await DB.batch(statements);dispatchNotices();
  return Response.json({ok:true,shoot:await getShoot(id)});
 }catch{return Response.json({error:'გადაღება ვერ შეიქმნა. სცადე ხელახლა.'},{status:503})}
}
