import { getStaffAccess } from '@/lib/staff-access';
import { youtubeShortsFeed } from '@/lib/shorts-feed';
import { initialShortsFeed, SHORTS_PLATFORMS, type ShortsPlatform } from '@/mobile/src/lib/shorts-catalog';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  if (!(await getStaffAccess())?.isApproved) return Response.json({ error: 'წვდომა შეზღუდულია.' }, { status: 403 });
  const platform = new URL(req.url).searchParams.get('platform') as ShortsPlatform;
  if (!SHORTS_PLATFORMS.includes(platform)) return Response.json({ error: 'პლატფორმა არ არსებობს.' }, { status: 400 });
  const feed = platform === 'youtube' ? await youtubeShortsFeed() : initialShortsFeed(platform);
  return Response.json(feed, { headers: { 'Cache-Control': 'private, no-store' } });
}
