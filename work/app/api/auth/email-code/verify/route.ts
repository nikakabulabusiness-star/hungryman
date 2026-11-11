import {emailAuthRoute} from '@/lib/email-auth-route';
import {verifyEmailCode} from '@/lib/email-verification';
export const dynamic='force-dynamic';
export async function POST(request:Request){return emailAuthRoute(request,verifyEmailCode)}
