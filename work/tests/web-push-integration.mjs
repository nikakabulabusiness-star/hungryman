import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';

const sql = new DatabaseSync(':memory:');
for (const file of fs.readdirSync('drizzle').filter(file => file.endsWith('.sql')).sort()) sql.exec(fs.readFileSync('drizzle/' + file, 'utf8').replaceAll('--> statement-breakpoint', ''));
sql.exec('PRAGMA foreign_keys=ON');
function statement(query, args = []) { return { bind(...values) { assert.ok(values.length <= 100); return statement(query, values); }, first: async () => sql.prepare(query).get(...args) || null, all: async () => ({ results: sql.prepare(query).all(...args) }), run: async () => ({ meta: { changes: Number(sql.prepare(query).run(...args).changes) } }) }; }
const DB = { prepare: statement, batch: async statements => { sql.exec('BEGIN'); try { const results = []; for (const item of statements) results.push(await item.run()); sql.exec('COMMIT'); return results; } catch (error) { sql.exec('ROLLBACK'); throw error; } } };
let now = Date.parse('2026-10-26T08:00:00Z');
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
const people = [
  { userId: 'sender', email: 'sender@test.example', fullName: 'Sender', role: 'Video Editor' },
  { userId: 'hr', email: 'hr@test.example', fullName: 'HR', role: 'HR' },
  { userId: 'other', email: 'other@test.example', fullName: 'Other', role: 'Video Editor' },
];
let approved = people;
const cache = new Map(), browser = [], native = [], afterJobs = [];
const env = { WORK_WEB_PUSH_PUBLIC_KEY: 'configured', WORK_WEB_PUSH_PRIVATE_KEY: 'configured', WORK_WEB_PUSH_SUBJECT: 'https://work.hungryman.ge' };
const fetch = async (url, options) => {
  if (url.endsWith('/getReceipts')) return Response.json({ data: Object.fromEntries(JSON.parse(options.body).ids.map(id => [id, { status: 'ok' }])) });
  if (url === 'https://exp.host/--/api/v2/push/send') { const batch = JSON.parse(options.body); native.push(...batch); return Response.json({ data: batch.map(() => ({ status: 'ok', id: crypto.randomUUID() })) }); }
  assert.ok(url.startsWith('https://fcm.googleapis.com/fcm/send/')); assert.equal(options.redirect, 'error'); return new Response(null, { status: 201 });
};
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  function require(name) {
    if (name === 'cloudflare:workers') return { env };
    if (name === 'next/server') return { after: task => afterJobs.push(task) };
    if (['@/lib/storage', './storage'].includes(name)) return { storage: () => ({ DB }) };
    if (['@/lib/staff-access', './staff-access'].includes(name)) return { listApprovedStaff: async () => approved };
    if (name === './chat-directory') return { conversationPeople: async thread => thread === 'team' || thread.startsWith('grp_') ? people : people.filter(p => p.userId !== 'other') };
    if (name === './web-push-crypto') return { createWebPushRequest: async (subscription, payload) => { browser.push({ subscription, ...payload }); return { headers: { 'Content-Encoding': 'aes128gcm' }, body: new Uint8Array([1, 2, 3]) }; } };
    if (name.startsWith('@/') || name.startsWith('.')) { const base = name.startsWith('@/') ? name.slice(2) : path.posix.join(path.posix.dirname(file), name); return load(base.endsWith('.ts') ? base : base + '.ts'); }
    throw Error('Unexpected import ' + name);
  }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require, fetch, Date: Clock, Intl, crypto, TextEncoder, TextDecoder, Uint8Array, AbortSignal, URL, Request, Response, Headers, atob, btoa, console });
  return exports;
}
const push = load('lib/push.ts'), notices = load('lib/notifications.ts');
const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const p256dh = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url'), auth = Buffer.alloc(16, 7).toString('base64url');
for (const person of people) {
  sql.prepare('INSERT INTO staff_sessions(token_hash,user_id,created,expires,last_seen) VALUES(?,?,?,?,?)').run(person.userId + '-session', person.userId, now, now + 86400000, now);
  sql.prepare('INSERT INTO web_push_subscriptions(id,endpoint,user_id,session_hash,p256dh,auth,updated) VALUES(?,?,?,?,?,?,?)').run(person.userId + '-browser', 'https://fcm.googleapis.com/fcm/send/' + person.userId, person.userId, person.userId + '-session', p256dh, auth, now);
}
function features(value = {}) { sql.prepare("INSERT INTO workspace_settings(key,value,updated,updated_by) VALUES('site_features',?,?,'test') ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated").run(JSON.stringify(value), now); }
async function chat(id, thread = 'team', callId = null) { now++; await push.queuePush(id, thread, 'sender', 'Private author name', 'Private message must stay inside the account', callId).run(); await push.flushPush(); }
const chatRecipients = id => browser.filter(item => item.tag === 'chat:' + id).map(item => item.recipientUserId).sort();
const workRecipients = id => browser.filter(item => item.tag.startsWith('work:' + id + ':')).map(item => item.recipientUserId).sort();
async function notice(id, recipients, target = 'notifications', targetId = '', category = 'info') { now++; await notices.notifyUsers(recipients, { key: id, category, title: 'Confidential business title', body: 'Confidential business text', target, targetId }); await notices.flushNotices(); }

assert.equal(sql.prepare('SELECT COUNT(*) n FROM push_devices').get().n, 0);
await chat('browser-only'); assert.deepEqual(chatRecipients('browser-only'), ['hr', 'other']); assert.equal(native.length, 0, 'Browser-only employees do not need Expo registration');
const sentCount = browser.length; await push.flushPush(); assert.equal(browser.length, sentCount, 'Reflush does not duplicate browser chat delivery');
assert.ok(browser.every(item => !JSON.stringify(item).includes('Private message') && !JSON.stringify(item).includes('Private author')), 'Only generic content crosses into browser push');
sql.prepare("INSERT INTO chat_preferences(conversation_id,user_id,muted,updated) VALUES('team','hr',1,?)").run(now);
await chat('muted'); assert.deepEqual(chatRecipients('muted'), ['other']);
sql.prepare("INSERT INTO chat_mentions(message_id,user_id) VALUES('everyone','hr')").run(); await chat('everyone'); assert.deepEqual(chatRecipients('everyone'), ['hr', 'other'], '@everyone persisted mentions override a mute');
sql.prepare("DELETE FROM chat_preferences WHERE user_id='hr'").run();
sql.prepare("INSERT INTO chat_hidden_threads(conversation_id,user_id,cleared_before,hidden) VALUES('dm_private','hr',?,1)").run(now + 1000);
await chat('hidden-history', 'dm_private'); assert.deepEqual(chatRecipients('hidden-history'), [], 'Hidden history cutoff plus nonmember exclusion');
sql.prepare("DELETE FROM chat_hidden_threads WHERE user_id='hr'").run(); await chat('private-members', 'dm_private'); assert.deepEqual(chatRecipients('private-members'), ['hr'], 'Nonmembers do not receive private chat notifications');
const hrPermissions = sql.prepare("SELECT permissions_json FROM staff_positions WHERE name='HR'").get().permissions_json;
sql.prepare("UPDATE staff_positions SET permissions_json='[]' WHERE name='HR'").run(); await chat('permission-revoked', 'dm_private'); assert.deepEqual(chatRecipients('permission-revoked'), []);
sql.prepare("UPDATE staff_positions SET permissions_json=? WHERE name='HR'").run(hrPermissions);
features({ _removedPermissions: { 'chat.view': now } }); await chat('action-removed'); assert.deepEqual(chatRecipients('action-removed'), []);
features({ teamChat: false }); await chat('team-disabled'); assert.deepEqual(chatRecipients('team-disabled'), []);
features({ _removedFeatures: { privateChats: now } }); await chat('private-removed', 'dm_private'); assert.deepEqual(chatRecipients('private-removed'), []);
features({ notifications: false }); await chat('notifications-disabled'); assert.deepEqual(chatRecipients('notifications-disabled'), []); assert.equal(sql.prepare("SELECT COUNT(*) n FROM push_outbox WHERE id='notifications-disabled'").get().n, 0);
features(); approved = people.filter(p => p.userId !== 'hr'); await chat('not-approved', 'dm_private'); assert.deepEqual(chatRecipients('not-approved'), []); approved = people;
sql.prepare("INSERT INTO chat_calls(id,conversation_id,created_by,creator_name,room,created,ended) VALUES('ended','dm_private','sender','Sender','room',?,?)").run(now, now);
await chat('ended-call', 'dm_private', 'ended'); assert.deepEqual(chatRecipients('ended-call'), []);
sql.prepare("INSERT INTO chat_calls(id,conversation_id,created_by,creator_name,room,created) VALUES('live','dm_private','sender','Sender','room',?)").run(now);
features({ calls: false }); await chat('calls-disabled', 'dm_private', 'live'); assert.deepEqual(chatRecipients('calls-disabled'), []);
features(); await chat('live-call', 'dm_private', 'live'); assert.deepEqual(chatRecipients('live-call'), ['hr']); assert.ok(browser.find(item => item.tag === 'chat:live-call').body.includes('ზარი'));
sql.prepare("INSERT INTO chat_deleted_conversations(id,deleted,deleted_by) VALUES('grp_deleted',?,'sender')").run(now); await chat('deleted-group', 'grp_deleted'); assert.deepEqual(chatRecipients('deleted-group'), []);

await notice('browser-work', ['hr', 'other']); assert.deepEqual(workRecipients('browser-work'), ['hr', 'other']); assert.equal(native.length, 0);
const workCount = browser.length; await notices.flushNotices(); assert.equal(browser.length, workCount, 'Reflush does not duplicate browser work notices');
assert.ok(browser.every(item => !JSON.stringify(item).includes('Confidential')), 'Work titles and bodies remain inside the account');
// Give both employees Expo devices too, then compare the same business eligibility.
for (const id of ['hr', 'other']) sql.prepare('INSERT INTO push_devices(token,user_id,updated) VALUES(?,?,?)').run('ExpoPushToken[' + id + ']', id, now);
sql.prepare("INSERT INTO attendance_requests(id,user_id,email,employee_name,work_date,answer,created) VALUES('pending-request','sender','sender@test.example','Sender','2026-10-26','remote',?)").run(now);
await notice('request-review', ['hr', 'other'], 'requests', 'pending-request'); assert.deepEqual(workRecipients('request-review'), ['hr']);
assert.deepEqual(native.filter(item => item.data.notificationId.startsWith('request-review:')).map(item => item.data.recipientUserId), ['hr']);
sql.prepare("UPDATE attendance_requests SET status='approved' WHERE id='pending-request'").run();
await notice('resolved-request', ['hr', 'other'], 'requests', 'pending-request'); assert.deepEqual(workRecipients('resolved-request'), []); assert.equal(native.filter(item => item.data.notificationId.startsWith('resolved-request:')).length, 0);
features({ attendance: false }); await notice('attendance-disabled', ['hr', 'other'], 'attendance', '2026-10-26'); assert.deepEqual(workRecipients('attendance-disabled'), []); assert.equal(native.filter(item => item.data.notificationId.startsWith('attendance-disabled:')).length, 0);
features({ _removedPermissions: { 'calendar.view': now } }); await notice('calendar-removed', ['hr', 'other'], 'calendar'); assert.deepEqual(workRecipients('calendar-removed'), []); assert.equal(native.filter(item => item.data.notificationId.startsWith('calendar-removed:')).length, 0);
features(); await notice('private-chat-work', ['hr', 'other'], 'chat', 'dm_private'); assert.deepEqual(workRecipients('private-chat-work'), ['hr']); assert.deepEqual(native.filter(item => item.data.notificationId.startsWith('private-chat-work:')).map(item => item.data.recipientUserId), ['hr']);
sql.prepare("UPDATE staff_positions SET permissions_json='[]' WHERE name='HR'").run(); await notice('work-access-revoked', ['hr']); assert.deepEqual(workRecipients('work-access-revoked'), []); assert.equal(native.filter(item => item.data.notificationId.startsWith('work-access-revoked:')).length, 0); sql.prepare("UPDATE staff_positions SET permissions_json=? WHERE name='HR'").run(hrPermissions);
features({ notifications: false }); await notice('all-notices-disabled', ['hr', 'other']); assert.deepEqual(workRecipients('all-notices-disabled'), []); assert.equal(native.filter(item => item.data.notificationId.startsWith('all-notices-disabled:')).length, 0);
console.log('PASS: Browser-only chat/work delivery, muted mentions, membership/history and live-call checks, approval/permission/feature revocation, native/browser business eligibility parity and durable deduplication.');
