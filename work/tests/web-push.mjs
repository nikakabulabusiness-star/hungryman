import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const sql = new DatabaseSync(':memory:');
for (const file of fs.readdirSync('drizzle').filter(file => file.endsWith('.sql')).sort()) {
  sql.exec(fs.readFileSync('drizzle/' + file, 'utf8').replaceAll('--> statement-breakpoint', ''));
}
sql.exec('PRAGMA foreign_keys=ON');
let afterClaim;
function statement(query, args = []) {
  return {
    bind(...values) { assert.ok(values.length <= 100, 'Respect D1 binding limit'); return statement(query, values); },
    first: async () => sql.prepare(query).get(...args) || null,
    all: async () => ({ results: sql.prepare(query).all(...args) }),
    run: async () => { const changes = Number(sql.prepare(query).run(...args).changes); if (afterClaim && query.startsWith('UPDATE web_push_deliveries SET attempts=attempts+1')) { const hook = afterClaim; afterClaim = null; hook(); } return { meta: { changes } }; },
  };
}
const DB = { prepare: statement, batch: async statements => {
  sql.exec('BEGIN');
  try { const results = []; for (const item of statements) results.push(await item.run()); sql.exec('COMMIT'); return results; }
  catch (error) { sql.exec('ROLLBACK'); throw error; }
} };
let now = Date.parse('2026-10-26T08:00:00Z'), actor = null, nextStatus = 201, fetchHook = null;
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
const env = { WORK_WEB_PUSH_PUBLIC_KEY: 'configured-public', WORK_WEB_PUSH_PRIVATE_KEY: 'configured-private', WORK_WEB_PUSH_SUBJECT: 'https://work.hungryman.ge' };
const encryptedPayloads = [], outbound = [], cache = new Map(), statusByEndpoint = new Map();
const mockEncrypt = async (subscription, payload) => {
  encryptedPayloads.push({ subscription, payload });
  return { headers: { Authorization: 'vapid signed', 'Content-Encoding': 'aes128gcm' }, body: new Uint8Array([8, 2, 9, 1]) };
};
const fakeFetch = async (url, options) => {
  outbound.push({ url, options });
  if (fetchHook) await fetchHook();
  return new Response(null, { status: statusByEndpoint.get(url) ?? nextStatus });
};
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  function require(name) {
    if (name === 'cloudflare:workers') return { env };
    if (['./storage', '@/lib/storage'].includes(name)) return { storage: () => ({ DB }) };
    if (['./staff-access', '@/lib/staff-access'].includes(name)) return { getStaffAccess: async () => actor };
    if (name === './web-push-crypto') return { createWebPushRequest: mockEncrypt };
    if (name === 'next/headers') return { cookies: async () => ({ get: () => null }), headers: async () => new Headers() };
    if (name === 'next/navigation') return { redirect: () => { throw Error('Unexpected redirect'); } };
    if (name === '@/lib/careers-bridge') return { isCareersBridge: () => false, isPublicCareersPath: () => false };
    if (name === '@/app/chatgpt-auth') return { getChatGPTUser: async () => null };
    if (name.startsWith('@/') || name.startsWith('.')) {
      const target = name.startsWith('@/') ? name.slice(2) : path.posix.join(path.posix.dirname(file), name);
      return load(target.endsWith('.ts') ? target : target + '.ts');
    }
    throw Error('Unexpected import ' + name);
  }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require, fetch: fakeFetch, crypto, Date: Clock, URL, Request, Response, Headers, AbortSignal, TextEncoder, TextDecoder, Uint8Array, atob, btoa, console });
  return exports;
}
const push = load('lib/web-push.ts'), api = load('app/api/web-push/route.ts'), auth = load('lib/staff-auth.ts'), logout = load('app/api/auth/logout/route.ts');
const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const p256dh = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url');
const authKey = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url');
const tokenA = 'a'.repeat(64), tokenB = 'b'.repeat(64), tokenExpired = 'e'.repeat(64);
async function session(user, token, expires = now + 86400000) {
  const hash = await auth.hashSessionToken(token);
  sql.prepare('INSERT OR REPLACE INTO staff_sessions(token_hash,user_id,created,expires,last_seen) VALUES(?,?,?,?,?)').run(hash, user, now, expires, now);
  return hash;
}
const sessionA = await session('alice', tokenA), sessionB = await session('bob', tokenB);
await session('alice', tokenExpired, now - 1);
function as(id, options = {}) { actor = id ? { userId: id, isApproved: true, features: { notifications: true }, ...options } : null; }
function request(body, options = {}) {
  const { method = 'POST', origin = 'https://work.hungryman.ge', cookie = `hm_staff_session=${tokenA}`, fetchSite } = options;
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (origin !== null) headers.set('origin', origin);
  if (cookie) headers.set('cookie', cookie);
  if (fetchSite) headers.set('sec-fetch-site', fetchSite);
  return new Request('https://work.hungryman.ge/api/web-push', { method, headers, body: JSON.stringify(body) });
}
const endpoint = suffix => 'https://fcm.googleapis.com/fcm/send/' + suffix;
const subscription = suffix => ({ endpoint: endpoint(suffix), keys: { p256dh, auth: authKey } });
const count = (table, where = '1', ...args) => sql.prepare(`SELECT COUNT(*) n FROM ${table} WHERE ${where}`).get(...args).n;
const event = (id, kind = 'chat') => ({ id, href: '/team/chat?thread=dm_private', kind, ttl: kind === 'call' ? 30 : 3600 });
function seedDevice(id, user = 'alice', sessionHash = sessionA, updated = now, url = endpoint(id)) {
  sql.prepare('INSERT INTO web_push_subscriptions(id,endpoint,user_id,session_hash,p256dh,auth,updated) VALUES(?,?,?,?,?,?,?)').run(id, url, user, sessionHash, p256dh, authKey, updated);
}
function clearDeliveryState() { sql.exec('DELETE FROM web_push_subscriptions'); outbound.length = 0; encryptedPayloads.length = 0; nextStatus = 201; fetchHook = null; statusByEndpoint.clear(); }

for (const url of [endpoint('valid'), 'https://fcm.googleapis.com/wp/test', 'https://updates.push.services.mozilla.com/wpush/v2/test', 'https://web.push.apple.com/test', 'https://wns2-db5p.notify.windows.com/test']) assert.equal(push.validPushEndpoint(url), true, url);
for (const url of ['http://fcm.googleapis.com/fcm/send/test', 'https://127.0.0.1/push', 'https://[::1]/push', 'https://169.254.169.254/latest', 'https://fcm.googleapis.com.evil.example/fcm/send/test', 'https://evil.push.apple.com.example/push', 'https://fcm.googleapis.com@evil.example/fcm/send/test', 'https://user:pass@fcm.googleapis.com/fcm/send/test', 'https://fcm.googleapis.com:8443/fcm/send/test', 'https://fcm.googleapis.com/fcm/send/test#fragment', 'https://fcm.googleapis.com/other', 'file:///etc/passwd']) assert.equal(push.validPushEndpoint(url), false, url);
assert.equal(push.validSubscription({ endpoint: endpoint('valid'), p256dh, auth: authKey }), true);
assert.equal(push.validSubscription({ endpoint: endpoint('valid'), p256dh: Buffer.alloc(65).toString('base64url'), auth: authKey }), false, 'Uncompressed EC keys must start with 0x04');
assert.equal(push.validSubscription({ endpoint: endpoint('valid'), p256dh, auth: Buffer.alloc(15).toString('base64url') }), false);
assert.equal(push.validSubscription({ endpoint: endpoint('valid'), p256dh: '!', auth: authKey }), false);
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const nonCanonicalAuth = authKey.slice(0, -1) + alphabet[alphabet.indexOf(authKey.at(-1)) + 1];
assert.equal(push.validSubscription({ endpoint: endpoint('valid'), p256dh, auth: nonCanonicalAuth }), false, 'Reject noncanonical base64url unused bits');

as(null); assert.equal((await api.GET()).status, 401); assert.equal((await api.POST(request(subscription('anonymous')))).status, 403);
as('alice', { isApproved: false }); assert.equal((await api.POST(request(subscription('pending')))).status, 403);
as('alice'); assert.equal((await api.POST(request(subscription('cross-site'), { origin: 'https://evil.example' }))).status, 403);
assert.equal((await api.POST(request(subscription('cross-site-meta'), { fetchSite: 'cross-site' }))).status, 403);
assert.equal((await api.POST(request(subscription('no-origin'), { origin: null }))).status, 403);
assert.equal((await api.POST(request(subscription('no-cookie'), { cookie: '' }))).status, 401);
assert.equal((await api.POST(request(subscription('wrong-owner-session'), { cookie: `hm_staff_session=${tokenB}` }))).status, 401);
assert.equal((await api.POST(request(subscription('expired'), { cookie: `hm_staff_session=${tokenExpired}` }))).status, 401);
assert.equal((await api.POST(request({ ...subscription('invalid'), endpoint: 'https://127.0.0.1/push' }))).status, 400);
as('alice', { features: { notifications: false } }); assert.equal((await api.POST(request(subscription('disabled')))).status, 403); assert.equal((await (await api.GET()).json()).enabled, false);
as('alice'); const savedKey = env.WORK_WEB_PUSH_PRIVATE_KEY; env.WORK_WEB_PUSH_PRIVATE_KEY = ''; assert.equal((await api.POST(request(subscription('unconfigured')))).status, 503); env.WORK_WEB_PUSH_PRIVATE_KEY = savedKey;
assert.equal(count('web_push_subscriptions'), 0, 'Rejected registrations never persist');
assert.equal((await api.POST(request(subscription('device')))).status, 200);
let row = sql.prepare('SELECT * FROM web_push_subscriptions WHERE endpoint=?').get(endpoint('device'));
assert.equal(row.user_id, 'alice'); assert.equal(row.session_hash, sessionA);
assert.equal((await api.GET()).headers.get('Cache-Control'), 'private, no-store');
assert.equal((await api.GET()).headers.get('Set-Cookie'), null);
now++; assert.equal((await api.POST(request(subscription('device')))).status, 200); assert.equal(count('web_push_subscriptions'), 1, 'Repeat registration updates the same endpoint');
as('bob'); assert.equal((await api.DELETE(request({ endpoint: endpoint('device') }, { method: 'DELETE', cookie: `hm_staff_session=${tokenB}` }))).status, 200); assert.equal(count('web_push_subscriptions'), 1, 'Another account cannot unsubscribe the owner');
as('alice'); assert.equal((await api.DELETE(request({ endpoint: endpoint('device') }, { method: 'DELETE', origin: 'https://evil.example' }))).status, 403); assert.equal(count('web_push_subscriptions'), 1);
as('bob');
assert.equal((await api.POST(request(subscription('device'), { cookie: `hm_staff_session=${tokenB}` }))).status, 200);
row = sql.prepare('SELECT * FROM web_push_subscriptions WHERE endpoint=?').get(endpoint('device')); assert.equal(row.user_id, 'bob'); assert.equal(row.session_hash, sessionB); assert.equal(count('web_push_subscriptions'), 1, 'Account switch transfers one browser endpoint');
as('alice'); assert.equal((await api.DELETE(request({ endpoint: endpoint('device') }, { method: 'DELETE' }))).status, 200); assert.equal(count('web_push_subscriptions'), 1);
as('bob'); assert.equal((await api.DELETE(request({ endpoint: endpoint('device') }, { method: 'DELETE', cookie: `hm_staff_session=${tokenB}` }))).status, 200); assert.equal(count('web_push_subscriptions'), 0);
as('alice'); for (let index = 0; index < 12; index++) { now++; assert.equal((await api.POST(request(subscription('limit-' + index)))).status, 200); } assert.equal(count('web_push_subscriptions'), 10, 'Per-account registration is bounded');
clearDeliveryState();

seedDevice('generic');
assert.equal(await push.deliverWebPush(event('private-chat'), ['alice']), true);
assert.equal(outbound.length, 1); assert.equal(encryptedPayloads.length, 1);
assert.equal(encryptedPayloads[0].payload.body, 'გაქვს ახალი შეტყობინება.');
assert.equal(encryptedPayloads[0].payload.recipientUserId, 'alice');
assert.equal(encryptedPayloads[0].payload.href, '/team/chat?thread=dm_private');
assert.deepEqual(Object.keys(encryptedPayloads[0].payload).sort(), ['body', 'href', 'recipientUserId', 'tag', 'title']);
assert.equal(outbound[0].options.method, 'POST'); assert.equal(outbound[0].options.redirect, 'error'); assert.equal(outbound[0].options.headers['Content-Encoding'], 'aes128gcm'); assert.equal(outbound[0].options.headers.TTL, '3600'); assert.ok(outbound[0].options.signal instanceof AbortSignal); assert.deepEqual([...outbound[0].options.body], [8, 2, 9, 1]);
await push.deliverWebPush(event('private-chat'), ['alice', 'alice']); assert.equal(outbound.length, 1, 'Accepted deliveries are not replayed');
await push.deliverWebPush(event('incoming-call', 'call'), ['alice']); assert.equal(outbound.at(-1).options.headers.TTL, '30'); assert.equal(outbound.at(-1).options.headers.Urgency, 'high');
clearDeliveryState(); seedDevice('for-alice'); seedDevice('for-bob', 'bob', sessionB);
await push.deliverWebPush(event('recipient-boundary'), ['alice']); assert.deepEqual(outbound.map(item => item.url), [endpoint('for-alice')]);

clearDeliveryState(); seedDevice('revoked');
sql.prepare('INSERT INTO web_push_deliveries(event_id,subscription_id,created) VALUES(?,?,?)').run('pending-logout', 'revoked', now);
assert.equal((await logout.POST(request({}))).status, 200);
assert.equal(count('staff_sessions', 'token_hash=?', sessionA), 0);
assert.equal(count('web_push_subscriptions'), 0, 'Session deletion cascades to browser subscriptions');
assert.equal(count('web_push_deliveries'), 0, 'Session deletion cascades through delivery history');
await push.deliverWebPush(event('pending-logout'), ['alice']); assert.equal(outbound.length, 0, 'Logged-out browser never receives queued notifications');
await session('alice', tokenA);
seedDevice('expired-session', 'alice', await session('alice', 'c'.repeat(64), now - 1));
seedDevice('stale-browser', 'alice', sessionA, now - 91 * 86400000);
seedDevice('mismatched-session', 'alice', sessionB);
await push.deliverWebPush(event('invalid-sessions'), ['alice']); assert.equal(outbound.length, 0, 'Expired, stale and foreign sessions are excluded');
clearDeliveryState(); seedDevice('logout-race');
afterClaim = () => sql.prepare('DELETE FROM staff_sessions WHERE token_hash=?').run(sessionA);
await push.deliverWebPush(event('logout-race'), ['alice']); assert.equal(outbound.length, 0, 'A logout racing claim acquisition is rechecked before delivery');
await session('alice', tokenA);
clearDeliveryState(); seedDevice('old-bad-url', 'alice', sessionA, now, 'https://127.0.0.1/internal'); await push.deliverWebPush(event('bad-legacy-row'), ['alice']); assert.equal(outbound.length, 0); assert.equal(count('web_push_subscriptions'), 0, 'Persisted malformed endpoints are removed without fetch');

clearDeliveryState(); seedDevice('gone'); nextStatus = 410; assert.equal(await push.deliverWebPush(event('gone'), ['alice']), true); assert.equal(count('web_push_subscriptions'), 0, '410 removes stale subscriptions'); assert.equal(count('web_push_deliveries'), 0);
clearDeliveryState(); seedDevice('retry'); nextStatus = 503;
assert.equal(await push.deliverWebPush(event('retryable'), ['alice']), false);
nextStatus = 201; assert.equal(await push.deliverWebPush(event('retryable'), ['alice']), true, 'Transient failure releases the claim for a later dispatch');
assert.equal(outbound.length, 2); await push.deliverWebPush(event('retryable'), ['alice']); assert.equal(outbound.length, 2);
clearDeliveryState(); seedDevice('partial-ok'); seedDevice('partial-retry'); statusByEndpoint.set(endpoint('partial-retry'), 503);
assert.equal(await push.deliverWebPush(event('partial'), ['alice']), false); statusByEndpoint.clear(); assert.equal(await push.deliverWebPush(event('partial'), ['alice']), true);
assert.equal(outbound.filter(item => item.url === endpoint('partial-ok')).length, 1, 'Partial retry skips accepted sibling devices'); assert.equal(outbound.filter(item => item.url === endpoint('partial-retry')).length, 2);
clearDeliveryState(); seedDevice('bounded'); nextStatus = 429;
for (let index = 0; index < 7; index++) await push.deliverWebPush(event('bounded-retries'), ['alice']);
assert.equal(outbound.length, 4, 'Retryable errors stop at four attempts');
clearDeliveryState(); seedDevice('fatal'); nextStatus = 403; await push.deliverWebPush(event('permanent-error'), ['alice']); await push.deliverWebPush(event('permanent-error'), ['alice']); assert.equal(outbound.length, 1, 'Permanent provider rejection is not retried');

clearDeliveryState(); seedDevice('concurrent');
let releaseFetch, signalFetch;
const started = new Promise(resolve => { signalFetch = resolve; });
fetchHook = async () => { signalFetch(); await new Promise(resolve => { releaseFetch = resolve; }); };
const firstDelivery = push.deliverWebPush(event('concurrent'), ['alice']); await started;
await push.deliverWebPush(event('concurrent'), ['alice']); assert.equal(outbound.length, 1, 'An in-flight claim prevents concurrent duplicates');
releaseFetch(); await firstDelivery;
clearDeliveryState();
const recipients = [];
for (let index = 0; index < 101; index++) {
  const user = 'bulk-' + index; recipients.push(user);
  if (index < 21) seedDevice('bulk-device-' + index, user, await session(user, 'bulk-session-' + index));
}
assert.equal(await push.deliverWebPush(event('bounded-batch'), recipients), false, 'One dispatch limits outbound requests'); assert.equal(outbound.length, 20);
assert.equal(await push.deliverWebPush(event('bounded-batch'), recipients), true); assert.equal(outbound.length, 21, 'Next dispatch advances without resending successes');
console.log('PASS: Web Push endpoint SSRF guards, subscription/session ownership, CSRF, logout cascades, generic encrypted delivery, deduplication, retry bounds, stale endpoints and D1/batch limits.');
