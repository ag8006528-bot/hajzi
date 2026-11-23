/**
 * RFC 6238 TOTP (SHA-1, 6 digits, 30 s) — compatible with Google Authenticator,
 * Microsoft Authenticator, 1Password, Authy, etc. No third-party dependency.
 */
import { createHmac, randomBytes } from 'crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string) {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const generateTotpSecret = () => base32Encode(randomBytes(20));

export function hotp(key: Buffer, counter: number, digits = 6) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', key).update(buf).digest();
  const offset = h[h.length - 1] & 0xf;
  const code = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return (code % 10 ** digits).toString().padStart(digits, '0');
}

export const currentStep = (now = Date.now()) => Math.floor(now / 30_000);

/**
 * Verify a code allowing ±1 step of clock drift. Returns the matched step, or null.
 * Pass `lastStep` to reject replay of an already-used code.
 */
export function verifyTotp(secretB32: string, code: string, lastStep?: number, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32Decode(secretB32);
  const step = currentStep(now);
  for (const s of [step - 1, step, step + 1]) {
    if (lastStep !== undefined && s <= lastStep) continue;
    if (hotp(key, s) === code) return s;
  }
  return null;
}

export function otpauthUri(secretB32: string, account: string, issuer = 'HAJZI') {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
