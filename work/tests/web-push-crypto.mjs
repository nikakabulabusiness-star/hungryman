import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createDecipheriv, createPublicKey, hkdfSync, verify, webcrypto } from 'node:crypto';
import ts from 'typescript';

const exports = {};
const code = ts.transpileModule(fs.readFileSync('lib/web-push-crypto.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(code, { exports, crypto: webcrypto, URL, TextEncoder, Uint8Array, DataView, atob, btoa, Date });
const { createWebPushRequest } = exports;
const b64 = bytes => Buffer.from(bytes).toString('base64url');
const receiver = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const receiverPublic = Buffer.from(await webcrypto.subtle.exportKey('raw', receiver.publicKey));
const vapidPair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const vapidJwk = await webcrypto.subtle.exportKey('jwk', vapidPair.privateKey);
const authSecret = webcrypto.getRandomValues(new Uint8Array(16));
const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/example', p256dh: b64(receiverPublic), auth: b64(authSecret) };
const vapid = { publicKey: b64(await webcrypto.subtle.exportKey('raw', vapidPair.publicKey)), privateKey: vapidJwk.d, subject: 'https://work.hungryman.ge' };
const now = Date.UTC(2026, 9, 26, 8);
const payload = { title: 'ჰანგრიმენი', body: 'ახალი შეტყობინება', url: '/work/chat?thread=7' };
const request = await createWebPushRequest(subscription, payload, vapid, now);

// The receiving side uses independent Node HKDF/AES APIs, not implementation helpers.
async function decrypt(body) {
  body = Buffer.from(body);
  assert.equal(body.readUInt32BE(16), 4096);
  assert.equal(body[20], 65);
  const salt = body.subarray(0, 16);
  const senderPublic = body.subarray(21, 86);
  const senderKey = await webcrypto.subtle.importKey('raw', senderPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = await webcrypto.subtle.deriveBits({ name: 'ECDH', public: senderKey }, receiver.privateKey, 256);
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), receiverPublic, senderPublic]);
  const ikm = hkdfSync('sha256', Buffer.from(shared), authSecret, info, 32);
  const cek = hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const decipher = createDecipheriv('aes-128-gcm', Buffer.from(cek), Buffer.from(nonce));
  decipher.setAuthTag(body.subarray(-16));
  const plain = Buffer.concat([decipher.update(body.subarray(86, -16)), decipher.final()]);
  assert.equal(plain.at(-1), 2, 'The single final record has delimiter 0x02');
  return JSON.parse(plain.subarray(0, -1).toString('utf8'));
}
assert.deepEqual(await decrypt(request.body), payload);
assert.equal(request.headers['Content-Encoding'], 'aes128gcm');
assert.equal(request.headers.TTL, '3600');
assert.ok(request.body.length <= 4096);
const [, token, publicKey] = request.headers.Authorization.match(/^vapid t=([^,]+), k=(.+)$/);
assert.equal(publicKey, vapid.publicKey);
const [header, claims, signature] = token.split('.');
assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { typ: 'JWT', alg: 'ES256' });
assert.deepEqual(JSON.parse(Buffer.from(claims, 'base64url')), { aud: 'https://fcm.googleapis.com', exp: now / 1000 + 43200, sub: vapid.subject });
const publicJwk = { kty: 'EC', crv: 'P-256', x: vapidJwk.x, y: vapidJwk.y };
assert.ok(verify('sha256', Buffer.from(`${header}.${claims}`), { key: createPublicKey({ key: publicJwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')));
assert.equal(Buffer.from(signature, 'base64url').length, 64);
const second = await createWebPushRequest(subscription, payload, vapid, now);
assert.notDeepEqual(request.body.slice(0, 16), second.body.slice(0, 16), 'Each message needs a random salt');
assert.notDeepEqual(request.body.slice(21, 86), second.body.slice(21, 86), 'Each message needs an ephemeral ECDH key');
const tampered = Buffer.from(request.body); tampered[tampered.length - 1] ^= 1;
await assert.rejects(decrypt(tampered));

const maximumPayload = { text: 'a'.repeat(3993 - Buffer.byteLength(JSON.stringify({ text: '' }))) };
const maximum = await createWebPushRequest(subscription, maximumPayload, vapid, now);
assert.equal(maximum.body.length, 4096);
assert.deepEqual(await decrypt(maximum.body), maximumPayload);
await assert.rejects(createWebPushRequest(subscription, { text: maximumPayload.text + 'a' }, vapid, now), /exceeds/);
await assert.rejects(createWebPushRequest(subscription, { text: 'ა'.repeat(1400) }, vapid, now), /exceeds/, 'Bound UTF-8 bytes, not character count');
await assert.rejects(createWebPushRequest({ ...subscription, endpoint: 'http://fcm.googleapis.com/test' }, payload, vapid, now), /endpoint/);
await assert.rejects(createWebPushRequest({ ...subscription, endpoint: 'https://user:pass@fcm.googleapis.com/test' }, payload, vapid, now), /endpoint/);
await assert.rejects(createWebPushRequest({ ...subscription, auth: b64(new Uint8Array(15)) }, payload, vapid, now), /authentication/);
await assert.rejects(createWebPushRequest({ ...subscription, p256dh: b64(new Uint8Array(65)) }, payload, vapid, now), /public key/);
const invalidPoint = new Uint8Array(65); invalidPoint[0] = 4;
await assert.rejects(createWebPushRequest({ ...subscription, p256dh: b64(invalidPoint) }, payload, vapid, now));
await assert.rejects(createWebPushRequest(subscription, payload, { ...vapid, privateKey: '!' }, now), /private key/);
await assert.rejects(createWebPushRequest(subscription, payload, { ...vapid, subject: 'javascript:alert(1)' }, now), /contact/);
await assert.rejects(createWebPushRequest(subscription, payload, { ...vapid, subject: 'mailto:' }, now), /contact/);
await assert.rejects(createWebPushRequest(subscription, payload, vapid, NaN), /timestamp/);
const otherPair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const otherJwk = await webcrypto.subtle.exportKey('jwk', otherPair.privateKey);
await assert.rejects(createWebPushRequest(subscription, payload, { ...vapid, privateKey: otherJwk.d }, now), 'Mismatched signing/public keys must fail');
console.log('PASS: Web Push interoperable encryption, VAPID signature/claims, freshness, payload boundary, tamper detection and malformed-input rejection.');
