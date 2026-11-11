/** Web Push wire format: RFC 8291 §§3–4 / RFC 8292 §§2–3. No Node APIs. */
export type WebPushSubscription = { endpoint: string; p256dh: string; auth: string };
export type WebPushVapid = { publicKey: string; privateKey: string; subject: string };

const encoder = new TextEncoder();
const MAX_PLAINTEXT_BYTES = 3993;
const RECORD_SIZE = 4096;

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeKey(value: string, length: number, label: string): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(value) || value.length > 100) {
    throw new Error(`Invalid ${label}`);
  }
  const unpadded = value.replace(/=+$/, '');
  let binary: string;
  try { binary = atob(unpadded.replace(/-/g, '+').replace(/_/g, '/')); }
  catch { throw new Error(`Invalid ${label}`); }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (bytes.length !== length || base64url(bytes) !== unpadded) throw new Error(`Invalid ${label}`);
  if (length === 65 && bytes[0] !== 4) throw new Error(`Invalid ${label}`);
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

async function hkdf(input: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number) {
  const key = await crypto.subtle.importKey('raw', input, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/** Builds an encrypted request only. Delivery must separately allowlist push endpoints. */
export async function createWebPushRequest(
  subscription: WebPushSubscription,
  payload: object,
  vapid: WebPushVapid,
  now = Date.now(),
): Promise<{ headers: Record<string, string>; body: Uint8Array<ArrayBuffer> }> {
  const endpoint = new URL(subscription.endpoint);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hash) throw new Error('Invalid push endpoint');
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid push timestamp');
  const subject = new URL(vapid.subject);
  if (vapid.subject.length > 512 || subject.username || subject.password || subject.hash ||
      !(subject.protocol === 'https:' || (subject.protocol === 'mailto:' && /^[^\s@]+@[^\s@]+$/.test(subject.pathname)))) {
    throw new Error('Invalid VAPID contact');
  }
  if (payload === null || typeof payload !== 'object') throw new Error('Push payload must be an object');
  const json = JSON.stringify(payload);
  if (typeof json !== 'string') throw new Error('Invalid push payload');
  const plaintext = encoder.encode(json);
  if (plaintext.length > MAX_PLAINTEXT_BYTES) throw new Error('Push payload exceeds 3993 bytes');

  const receiverPublic = decodeKey(subscription.p256dh, 65, 'subscription public key');
  const authSecret = decodeKey(subscription.auth, 16, 'subscription authentication secret');
  const vapidPublic = decodeKey(vapid.publicKey, 65, 'VAPID public key');
  const vapidPrivate = decodeKey(vapid.privateKey, 32, 'VAPID private key');

  // Import validates that the receiver's point belongs to P-256.
  const receiverKey = await crypto.subtle.importKey('raw', receiverPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, ephemeral.privateKey, 256));
  const keyInfo = concat(encoder.encode('WebPush: info\0'), receiverPublic, senderPublic);
  const ikm = await hkdf(sharedSecret, authSecret, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const [cek, nonce] = await Promise.all([
    hkdf(ikm, salt, encoder.encode('Content-Encoding: aes128gcm\0'), 16),
    hkdf(ikm, salt, encoder.encode('Content-Encoding: nonce\0'), 12),
  ]);
  const encryptionKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 }, encryptionKey, concat(plaintext, new Uint8Array([2])),
  ));
  const recordHeader = new Uint8Array(21);
  recordHeader.set(salt);
  new DataView(recordHeader.buffer).setUint32(16, RECORD_SIZE, false);
  recordHeader[20] = senderPublic.length;

  const publicJwk = { kty: 'EC', crv: 'P-256', x: base64url(vapidPublic.slice(1, 33)), y: base64url(vapidPublic.slice(33)) };
  const signingKey = await crypto.subtle.importKey('jwk', { ...publicJwk, d: base64url(vapidPrivate) }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const protectedHeader = base64url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64url(encoder.encode(JSON.stringify({ aud: endpoint.origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: vapid.subject })));
  const signingInput = `${protectedHeader}.${claims}`;
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, encoder.encode(signingInput)));
  const verificationKey = await crypto.subtle.importKey('jwk', publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  if (signature.length !== 64 || !await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verificationKey, signature, encoder.encode(signingInput))) {
    throw new Error('VAPID key pair does not match');
  }
  return {
    headers: {
      Authorization: `vapid t=${signingInput}.${base64url(signature)}, k=${base64url(vapidPublic)}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '3600',
      Urgency: 'normal',
    },
    body: concat(recordHeader, senderPublic, ciphertext),
  };
}
