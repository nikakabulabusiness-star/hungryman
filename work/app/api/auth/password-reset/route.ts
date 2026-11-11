import {emailAuthRoute} from '@/lib/email-auth-route';
import {completeEmailFlow} from '@/lib/email-verification';
export const dynamic='force-dynamic';
export async function POST(request:Request){return emailAuthRoute(request,(req,body)=>completeEmailFlow(req,body,'reset'))}
