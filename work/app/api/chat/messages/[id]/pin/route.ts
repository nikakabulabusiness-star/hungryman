import {hasPermission} from '@/lib/permissions';
import {messageAccess,bumpChat} from '@/lib/chat';
import {getStaffAccess} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';

export const dynamic='force-dynamic';

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(req))return Response.json({error:'მოთხოვნა უარყოფილია.'},{status:403});
 const access=await getStaffAccess();
 if(!access?.isApproved||!hasPermission(access,'chat.moderate'))return Response.json({error:'ჩატი მხოლოდ დადასტურებული თანამშრომლებისთვისაა.'},{status:403});

 try{
  const {id}=await params;
  if(!/^[A-Za-z0-9:_-]{1,100}$/.test(id))return Response.json({error:'შეტყობინება არ მოიძებნა.'},{status:404});
  const permitted=await messageAccess(id);if(!permitted)return Response.json({error:'შეტყობინება ვერ მოიძებნა.'},{status:404});
  const input=await req.json() as {pinned?:unknown};
  if(typeof input.pinned!=='boolean')return Response.json({error:'არასწორი მოთხოვნა.'},{status:400});
  const result=await storage().DB.prepare('UPDATE staff_chat_messages SET pinned=?,pinned_by=?,pinned_at=? WHERE id=?')
   .bind(input.pinned?1:0,input.pinned?access.userId:null,input.pinned?Date.now():null,id).run();
  if(!result.meta.changes)return Response.json({error:'შეტყობინება არ მოიძებნა.'},{status:404});
  await bumpChat(permitted.conversationId,access.email).run();
  return Response.json({ok:true,pinned:input.pinned});
 }catch{
  return Response.json({error:'პინის განახლება ვერ მოხერხდა.'},{status:503});
 }
}
