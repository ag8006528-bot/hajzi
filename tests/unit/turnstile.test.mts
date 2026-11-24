import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.TURNSTILE_SECRET_KEY = 'test-secret';
const { verifyTurnstile } = await import('../../src/lib/security/turnstile');

const reply = (body: object) => {
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
};

test('valid token passes, bad token fails', async () => {
  reply({ success: true });
  assert.equal(await verifyTurnstile('tok', 'ip'), true);
  reply({ success: false, 'error-codes': ['invalid-input-response'] });
  assert.equal(await verifyTurnstile('tok', 'ip'), false);
  assert.equal(await verifyTurnstile(undefined, 'ip'), false);
});

test('a WRONG secret key (our misconfiguration) does not lock customers out', async () => {
  reply({ success: false, 'error-codes': ['invalid-input-secret'] });
  assert.equal(await verifyTurnstile('tok', 'ip'), true);
});

test('Cloudflare unreachable → fail closed', async () => {
  globalThis.fetch = (async () => {
    throw new Error('network');
  }) as typeof fetch;
  assert.equal(await verifyTurnstile('tok', 'ip'), false);
});
