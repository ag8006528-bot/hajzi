import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base32Decode, base32Encode, hotp, verifyTotp } from '../../src/lib/security/totp';
import { _resetRateLimits, LIMITS, rateLimit } from '../../src/lib/security/rate-limit';

test('TOTP matches the RFC 6238 test vector', () => {
  // RFC 6238 Appendix B: secret "12345678901234567890", T = 59 s → 94287082 (8 digits)
  const key = Buffer.from('12345678901234567890');
  assert.equal(hotp(key, 1, 8), '94287082');
  assert.equal(hotp(key, 1, 6), '287082');
});

test('TOTP verify accepts ±1 step and rejects replays', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  assert.deepEqual(base32Decode(secret), Buffer.from('12345678901234567890'));
  const now = 59_000;
  const step = verifyTotp(secret, '287082', undefined, now);
  assert.equal(step, 1);
  assert.equal(verifyTotp(secret, '287082', step!, now), null, 'same code cannot be used twice');
  assert.equal(verifyTotp(secret, '000000', undefined, now), null);
  assert.equal(verifyTotp(secret, 'abc', undefined, now), null);
});

test('rate limiter blocks after the limit', async () => {
  _resetRateLimits();
  const { limit } = LIMITS.contact;
  for (let i = 0; i < limit; i++) assert.ok((await rateLimit('contact', '1.2.3.4')).ok, `request ${i + 1}`);
  const blocked = await rateLimit('contact', '1.2.3.4');
  assert.equal(blocked.ok, false);
  assert.ok(blocked.resetSeconds > 0);
  assert.ok((await rateLimit('contact', '5.6.7.8')).ok, 'other IPs are unaffected');
});
