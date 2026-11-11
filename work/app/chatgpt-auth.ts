import {getSessionUser,requireSessionUser,safeReturnPath} from '@/lib/staff-auth';

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const user=await getSessionUser();
  return user?{userId:user.userId,displayName:user.fullName||user.email,email:user.email,fullName:user.fullName||null}:null;
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user=await requireSessionUser(returnTo);
  return {userId:user.userId,displayName:user.fullName||user.email,email:user.email,fullName:user.fullName||null};
}

export function chatGPTSignInPath(returnTo: string): string {
  return `/team/auth?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  return `/team/auth?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}
