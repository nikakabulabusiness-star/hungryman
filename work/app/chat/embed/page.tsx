import {requireApprovedStaff} from '@/lib/staff-access';
import {threadAllowed} from '@/lib/chat';
import {notFound} from 'next/navigation';
import ChatWorkspace from '../chat-workspace';

export const dynamic='force-dynamic';

export default async function ChatEmbedPage({searchParams}:{searchParams:Promise<{conversationId?:string}>}){
 const access=await requireApprovedStaff('/chat');
 const conversationId=(await searchParams).conversationId||'team';if(!await threadAllowed(conversationId,access))notFound();
 const profile=access;
 return <main className="staff-chat-page hm-embed-page m-0 h-dvh max-w-none overflow-hidden bg-[#061c2f] p-0"><ChatWorkspace currentUserId={profile.userId} initialId={conversationId} compact/></main>;
}
