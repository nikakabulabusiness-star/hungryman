import { storage } from './storage';
import { initialShortsFeed, shortVideo, validShortVideo, YOUTUBE_CHANNEL_ID, type ShortsFeed, type ShortVideo } from '../mobile/src/lib/shorts-catalog';

const TTL = 10 * 60 * 1000;
const KEY = 'shorts.feed.youtube.v1';
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;
let inFlight: Promise<ShortsFeed> | undefined;
function decode(value: string) {
  return value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, entity => {
    const named: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
    if (named[entity]) return named[entity];
    const n = entity.startsWith('&#x') ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  });
}
export function parseYouTubeShorts(xml: string): ShortVideo[] {
  if (xml.length > 300_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw Error('Invalid feed');
  if (!xml.includes(`https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}`)) throw Error('Wrong channel');
  const result: ShortVideo[] = [], ids = new Set<string>();
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = match[1], id = entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1];
    // Use YouTube's explicit Shorts classification, not an unreliable duration guess.
    if (!id || ids.has(id) || !entry.includes(`<yt:channelId>${YOUTUBE_CHANNEL_ID}</yt:channelId>`)
      || !entry.includes(`href="https://www.youtube.com/shorts/${id}"`)) continue;
    const title = decode(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').slice(0, 500);
    const date = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    result.push(shortVideo('youtube', id, title, date && Number.isFinite(Date.parse(date)) ? date : undefined));
    ids.add(id);
  }
  if (!/<feed\b/.test(xml) || !/<\/feed>/.test(xml)) throw Error('Incomplete feed');
  return result.slice(0, 30);
}
async function readFeed(): Promise<ShortsFeed> {
  const db = storage().DB;
  let cached: ShortsFeed | null = null;
  try {
    const row = await db.prepare('SELECT value FROM workspace_settings WHERE key=?').bind(KEY).first<{ value: string }>();
    const parsed = JSON.parse(row?.value || 'null');
    if (parsed?.platform === 'youtube' && Array.isArray(parsed.items) && parsed.items.length <= 30
      && parsed.items.every((item: unknown) => validShortVideo(item, 'youtube')) && Number.isFinite(parsed.checkedAt)) cached = parsed;
  } catch { /* A bad cache must not break playback. */ }
  if (cached?.checkedAt && Date.now() - cached.checkedAt < TTL) return cached;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(FEED_URL, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/atom+xml' } });
    if (!response.ok) throw Error('Feed unavailable');
    if (Number(response.headers.get('content-length')) > 300_000) throw Error('Feed too large');
    const items = parseYouTubeShorts(await response.text());
    const result: ShortsFeed = { platform: 'youtube', items, mode: 'channel-feed', checkedAt: Date.now(), stale: false };
    await db.prepare('INSERT INTO workspace_settings (key,value,updated,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated,updated_by=excluded.updated_by')
      .bind(KEY, JSON.stringify(result), result.checkedAt, 'youtube-public-feed').run();
    return result;
  } catch {
    return { ...(cached || initialShortsFeed('youtube')), stale: true };
  } finally { clearTimeout(timer); }
}
export function youtubeShortsFeed() {
  if (!inFlight) inFlight = readFeed().finally(() => { inFlight = undefined; });
  return inFlight;
}
