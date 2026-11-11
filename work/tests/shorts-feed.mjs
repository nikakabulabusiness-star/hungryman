import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import ts from 'typescript';

const modules = new Map(), rows = new Map();
let requests = 0, failure = false, approved = true;
const channel = 'UCWGUvLISUIa5QciKrZY0jyw';
const entry = (id, shorts = true, owner = channel, title = 'Test &amp; title') => `<entry><yt:videoId>${id}</yt:videoId><yt:channelId>${owner}</yt:channelId><title>${title}</title><published>2026-10-23T00:00:00Z</published><link rel="alternate" href="https://www.youtube.com/${shorts ? 'shorts/' + id : 'watch?v=' + id}"/></entry>`;
const xml = `<feed><link href="https://www.youtube.com/channel/${channel}"/>${entry('c2ILYXDk2iU')}${entry('keerbdtCvwI', false)}${entry('dUjOUJDH55g', true, 'wrong-channel')}${entry('c2ILYXDk2iU')}</feed>`;
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const exports = {}; modules.set(file, exports);
  const require = name => {
    if (name === './storage') return { storage: () => ({ DB: { prepare: query => ({ bind: (...args) => ({ first: async () => rows.get(args[0]) || null, run: async () => { rows.set(args[0], { value: args[1] }); } }) }) } }) };
    if (name === '@/lib/staff-access') return { getStaffAccess: async () => ({ isApproved: approved }) };
    const target = name.startsWith('@/') ? name.slice(2) : path.posix.join(path.posix.dirname(file), name);
    return load(target.endsWith('.ts') ? target : target + '.ts');
  };
  const fetch = async url => { requests++; assert.equal(url, `https://www.youtube.com/feeds/videos.xml?channel_id=${channel}`); if (failure) throw Error('offline'); await new Promise(resolve => setImmediate(resolve)); return new Response(xml); };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require, fetch, URL, Request, Response, AbortController, setTimeout, clearTimeout, Date });
  return exports;
}
const catalog = load('mobile/src/lib/shorts-catalog.ts'), feed = load('lib/shorts-feed.ts');
const parsed = feed.parseYouTubeShorts(xml);
assert.equal(parsed.length, 1, 'Exclude long-form, another channel, and duplicate videos');
assert.equal(parsed[0].title, 'Test & title');
assert.equal(parsed[0].url, 'https://www.youtube.com/shorts/c2ILYXDk2iU');
for (const bad of [xml.replaceAll(channel, 'wrong-channel'), '<!DOCTYPE rss>' + xml, xml.slice(0, -7), 'x'.repeat(300001)]) assert.throws(() => feed.parseYouTubeShorts(bad));
for (const platform of catalog.SHORTS_PLATFORMS) {
  const items = catalog.initialShortsFeed(platform).items;
  assert.ok(items.length); assert.ok(items.every(item => catalog.validShortVideo(item, platform)));
  assert.equal(catalog.validShortVideo({ ...items[0], url: 'https://evil.example' }, platform), false);
  assert.equal(catalog.validShortVideo({ ...items[0], id: '</script>' }, platform), false);
}
const concurrent = await Promise.all([feed.youtubeShortsFeed(), feed.youtubeShortsFeed()]);
assert.equal(requests, 1); assert.equal(concurrent[0].stale, false);
await feed.youtubeShortsFeed(); assert.equal(requests, 1, 'Fresh cache avoids fetching on each phone visit');
const key = [...rows.keys()][0], cached = JSON.parse(rows.get(key).value);
cached.checkedAt = Date.now() - 700000; rows.set(key, { value: JSON.stringify(cached) }); failure = true;
const offline = await feed.youtubeShortsFeed(); assert.equal(offline.stale, true); assert.equal(offline.items[0].id, parsed[0].id);
rows.set(key, { value: '{broken' }); const fallback = await feed.youtubeShortsFeed(); assert.equal(fallback.items[0].id, 'c2ILYXDk2iU');
const route = load('app/api/mobile/shorts/feed/route.ts');
approved = false; assert.equal((await route.GET(new Request('https://test/api/mobile/shorts/feed?platform=youtube'))).status, 403);
approved = true; assert.equal((await route.GET(new Request('https://test/api/mobile/shorts/feed?platform=unknown'))).status, 400);
const res = await route.GET(new Request('https://test/api/mobile/shorts/feed?platform=instagram'));
assert.equal(res.headers.get('cache-control'), 'private, no-store'); const selected = await res.json(); assert.equal(selected.mode, 'selected-posts'); assert.equal(selected.checkedAt, null);
console.log('PASS: Shorts channel identity, Shorts-only filtering, duplicates, entity decoding, private staff endpoint, cache coalescing, offline fallback and honest selected-post feeds.');
