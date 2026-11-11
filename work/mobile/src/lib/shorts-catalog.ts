// Public, individual posts from Hungryman's official accounts. Never proxy media
// files or manufacture engagement counts. The server refreshes YouTube via RSS.
export type ShortsPlatform = 'instagram' | 'tiktok' | 'youtube';
export type ShortVideo = {
  id: string;
  platform: ShortsPlatform;
  title: string;
  url: string;
  published?: string;
  thumbnail?: string;
};
export type ShortsFeed = {
  platform: ShortsPlatform;
  items: ShortVideo[];
  mode: 'channel-feed' | 'selected-posts';
  checkedAt: number | null;
  stale: boolean;
};
export const SHORTS_ACCOUNTS = {
  instagram: { label: 'Instagram', handle: 'hungrymantv', url: 'https://www.instagram.com/hungrymantv/reels/' },
  tiktok: { label: 'TikTok', handle: 'hungryman.ge', url: 'https://www.tiktok.com/@hungryman.ge' },
  youtube: { label: 'YouTube', handle: 'hungrymantv', url: 'https://www.youtube.com/@hungrymantv/shorts' },
} as const;
export const SHORTS_PLATFORMS: ShortsPlatform[] = ['instagram', 'tiktok', 'youtube'];
export const YOUTUBE_CHANNEL_ID = 'UCWGUvLISUIa5QciKrZY0jyw';
export function shortVideo(platform: ShortsPlatform, id: string, title = '', published?: string): ShortVideo {
  return {
    id, platform, title, ...(published ? { published } : {}),
    url: platform === 'youtube' ? `https://www.youtube.com/shorts/${id}` : platform === 'instagram'
      ? `https://www.instagram.com/hungrymantv/reel/${id}/` : `https://www.tiktok.com/@hungryman.ge/video/${id}`,
    ...(platform === 'youtube' ? { thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } : {}),
  };
}
// Verified on 2026-10-23: YouTube's channel Atom feed marks these /shorts/ links.
// Instagram posts are public indexed Reels. TikTok's public oEmbed resolves its ID.
// These fallback entries are not presented as a synchronized Instagram/TikTok feed.
export const SHORTS_SEED: Record<ShortsPlatform, ShortVideo[]> = {
  youtube: [
    shortVideo('youtube', 'c2ILYXDk2iU', 'დავდივართ მანქანით გაუჩერებლად და ვაგროვებთ თანხას ჩვენი გამომწერებისთვის! 🚗'),
    shortVideo('youtube', 'dUjOUJDH55g', '1 წუთში რასაც ჩაატევ, ყველაფერი შენია!'),
    shortVideo('youtube', 'eNwGW2lGC_k', 'ქობულეთი vs ???? 👀'),
    shortVideo('youtube', 'hdBRqqMw79s', '100 გიორგის ბრძოლა 10,000 ლარისთვის'),
    shortVideo('youtube', 'joCT7Kdg9gM', 'წინ 1,000,000-კენ! ❤️💪'),
  ],
  instagram: [
    shortVideo('instagram', 'DZ0W_qqoTII', 'AI ფრენქი'),
    shortVideo('instagram', 'DVYjZS9iIjb', '1 ბილეთით მოგებული ნახევარი მილიონი ლარი'),
    shortVideo('instagram', 'C8SNzwWsGFH', 'ევროპის ჩემპიონატი'),
    shortVideo('instagram', 'CzqhHCusNhP', 'ოთახის გამარჯვებულები'),
  ],
  tiktok: [shortVideo('tiktok', '7481321681789701384', 'Hungryman')],
};
export function initialShortsFeed(platform: ShortsPlatform): ShortsFeed {
  return { platform, items: SHORTS_SEED[platform], mode: platform === 'youtube' ? 'channel-feed' : 'selected-posts', checkedAt: null, stale: platform === 'youtube' };
}
export function validShortVideo(value: unknown, platform: ShortsPlatform): value is ShortVideo {
  if (!value || typeof value !== 'object') return false;
  const item = value as ShortVideo;
  const idPattern = platform === 'youtube' ? /^[\w-]{11}$/ : platform === 'instagram' ? /^[\w-]{5,30}$/ : /^\d{15,22}$/;
  return item.platform === platform && typeof item.id === 'string' && idPattern.test(item.id)
    && typeof item.title === 'string' && item.title.length <= 500 && item.url === shortVideo(platform, item.id).url;
}
