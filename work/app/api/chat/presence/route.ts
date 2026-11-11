import {publicRole} from '@/lib/site-controls';
import {storage} from '@/lib/storage';
import {hasPermission} from '@/lib/permissions';
import {getStaffAccess,listApprovedStaff} from '@/lib/staff-access';
import {sameOrigin} from '@/lib/visitor';

export const dynamic='force-dynamic';

const ACTIVE_WINDOW=90_000;

function safeDisplayName(value:string){
 const name=String(value||'').trim();
 return !name||/^\S+@\S+\.\S+$/.test(name)?'თანამშრომელი':name.slice(0,120);
}

async function approvedAccess(){
 const access=await getStaffAccess();
 return access?.isApproved&&hasPermission(access,'chat.view')?access:null;
}

function avatarUrl(userId:string|null,hasAvatar:boolean,profileUpdated:number|null|undefined){
 if(!userId||!hasAvatar)return null;
 const version=Number(profileUpdated||0);
 return `/api/team/avatar?userId=${encodeURIComponent(userId)}${version?`&v=${version}`:''}`;
}

export async function GET(){
 const access=await approvedAccess();
 if(!access)return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 try{
  const staff=await listApprovedStaff();
  const now=Date.now();
  const people=staff.filter(person=>person.userId).map(person=>({
   userId:person.userId!,
   name:safeDisplayName(person.fullName),
   role:publicRole(person.role),
   avatarUrl:avatarUrl(person.userId,person.hasAvatar,person.profileUpdated),
   active:now-Number(person.lastSeen||0)<=ACTIVE_WINDOW,
  })).sort((a,b)=>Number(b.active)-Number(a.active)||a.name.localeCompare(b.name,'ka'));
  return Response.json({people,updatedAt:now},{headers:{'Cache-Control':'private, no-store'}});
 }catch{
  return Response.json({error:'თანამშრომელთა სტატუსი დროებით მიუწვდომელია.'},{status:503});
 }
}

export async function POST(req:Request){
 if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 const access=await approvedAccess();
 if(!access)return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 try{
  const now=Date.now();
  // The authenticated session already guarantees this member exists; a heartbeat
  // must not rewrite identity/role or read the profile back on every tick.
  if(now-access.lastSeen>10000)await storage().DB.prepare('UPDATE team_members SET last_seen=? WHERE user_id=? AND last_seen<?').bind(now,access.userId,now-10000).run();
  return Response.json({ok:true,updatedAt:now});
 }catch{
  return Response.json({error:'აქტიურობის სტატუსი ვერ განახლდა.'},{status:503});
 }
}
