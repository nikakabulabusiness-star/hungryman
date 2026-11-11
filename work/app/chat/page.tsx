import {threadAllowed} from '@/lib/chat';
import {notFound} from 'next/navigation';
import {requireApprovedStaff} from '@/lib/staff-access';
import {hasPermission} from '@/lib/permissions';
import {getNextShoot} from '@/lib/shoots';
import StaffHeader from '@/app/team/staff-header';
import ChatWorkspace from './chat-workspace';

export const dynamic='force-dynamic';

export default async function ChatPage({searchParams}:{searchParams:Promise<{conversationId?:string}>}){
 const access=await requireApprovedStaff('/chat');
 if(!hasPermission(access,'chat.view'))notFound();
 const requested=(await searchParams).conversationId;
 const [allowed,nextShoot]=await Promise.all([threadAllowed(requested||'team',access),getNextShoot()]);
 if(requested&&!allowed)notFound();
 // A disabled/deleted team chat must not hide the user's private conversations.
 const conversationId=allowed?(requested||'team'):'';
 const profile=access;
 return <main className="staff-chat-page m-0 flex h-dvh min-h-0 max-w-none flex-col overflow-hidden bg-[#061c2f] px-3 py-3 text-white sm:px-6 sm:py-5">
  <StaffHeader active="chat" access={profile} nextShoot={nextShoot?{id:nextShoot.id,title:nextShoot.title,shootDate:nextShoot.shoot_date,startTime:nextShoot.start_time}:null}/>
  <div className="mx-auto flex min-h-0 w-full max-w-none flex-1"><ChatWorkspace currentUserId={profile.userId} initialId={conversationId} startWithList={!requested}/></div>
 </main>;
}
