import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { getAuthSecret } from '../env';

/** Cryptographically random URL-safe token (default 256 bits). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Constant-time string comparison (hashes first so lengths always match). */
export function safeEqual(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

/** Unguessable, non-sequential booking reference, e.g. HZ-7K3QW9PX (40 bits, crypto RNG). */
export function generateRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
  let s = '';
  for (let i = 0; i < 8; i++) s += alphabet[randomInt(alphabet.length)];
  return `HZ-${s}`;
}

/** Hash an IP for logs so we can correlate abuse without storing raw IPs. */
export const hashIp = (ip: string) => createHmac('sha256', getAuthSecret()).update(`ip:${ip}`).digest('hex').slice(0, 16);

const key = () => createHash('sha256').update(`enc:${getAuthSecret()}`).digest();

/** AES-256-GCM encrypt (used for TOTP secrets at rest). */
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(payload: string) {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}
