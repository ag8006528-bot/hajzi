import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const dir = mkdtempSync(path.join(tmpdir(), 'hajzi-auth-'));
process.env.HAJZI_DATA_FILE = path.join(dir, 'db.json');
process.env.HAJZI_SEED = 'demo';

const { getStore } = await import('../../src/lib/db');
const core = await import('../../src/lib/auth/core');
const { encrypt } = await import('../../src/lib/security/crypto');
const { base32Decode, currentStep, generateTotpSecret, hotp } = await import('../../src/lib/security/totp');

const store = getStore();
const PASSWORD = `pw-${randomUUID()}`; // generated per run
after(() => rmSync(dir, { recursive: true, force: true }));

async function makeUser(email: string, role: 'admin' | 'staff' = 'admin', totpSecret?: string) {
  return store.createUser({
    id: randomUUID(),
    email,
    name: email,
    role,
    passwordHash: await core.hashPassword(PASSWORD),
    totpEnabled: !!totpSecret,
    totpSecretEnc: totpSecret ? encrypt(totpSecret) : undefined,
    failedAttempts: 0,
    createdAt: new Date().toISOString(),
  });
}

test('passwords are stored as bcrypt hashes and short passwords are refused', async () => {
  const u = await makeUser('hash@test.local');
  assert.match(u.passwordHash, /^\$2[aby]\$12\$/);
  assert.ok(!u.passwordHash.includes(PASSWORD));
  await assert.rejects(core.hashPassword('short'), /at least/);
});

test('correct login creates a server-side session; only its hash is stored', async () => {
  await makeUser('ok@test.local');
  const r = await core.authenticate({ email: 'OK@test.local', password: PASSWORD }, 'iphash');
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal((await core.userFromSessionToken(r.token))?.email, 'ok@test.local');
  const db = await store.getSession(r.token);
  assert.equal(db, null, 'raw token is not a session id');
  await core.destroySession(r.token);
  assert.equal(await core.userFromSessionToken(r.token), null, 'logout revokes the session');
});

test('account locks after 5 failed attempts — even the right password is refused while locked', async () => {
  await makeUser('lock@test.local');
  for (let i = 1; i <= 4; i++) {
    const r = await core.authenticate({ email: 'lock@test.local', password: 'wrong-password' }, 'ip');
    assert.deepEqual(r, { ok: false, reason: 'invalid' }, `attempt ${i}`);
  }
  assert.deepEqual(await core.authenticate({ email: 'lock@test.local', password: 'wrong-password' }, 'ip'), { ok: false, reason: 'locked' });
  assert.deepEqual(await core.authenticate({ email: 'lock@test.local', password: PASSWORD }, 'ip'), { ok: false, reason: 'locked' });
  const u = (await store.getUserByEmail('lock@test.local'))!;
  assert.ok(new Date(u.lockedUntil!) > new Date());
});

test('unknown emails get the same generic failure', async () => {
  assert.deepEqual(await core.authenticate({ email: 'nobody@test.local', password: PASSWORD }, 'ip'), { ok: false, reason: 'invalid' });
});

test('2FA: password alone is not enough; a valid code logs in; codes cannot be replayed', async () => {
  const secret = generateTotpSecret();
  await makeUser('totp@test.local', 'admin', secret);
  assert.deepEqual(await core.authenticate({ email: 'totp@test.local', password: PASSWORD }, 'ip'), { ok: false, reason: 'totp_required' });
  assert.deepEqual(await core.authenticate({ email: 'totp@test.local', password: PASSWORD, totp: '000000' }, 'ip'), { ok: false, reason: 'invalid' });
  const code = hotp(base32Decode(secret), currentStep());
  const ok = await core.authenticate({ email: 'totp@test.local', password: PASSWORD, totp: code }, 'ip');
  assert.ok(ok.ok);
  const replay = await core.authenticate({ email: 'totp@test.local', password: PASSWORD, totp: code }, 'ip');
  assert.equal(replay.ok, false);
});

test('expired sessions are rejected', async () => {
  const u = await makeUser('exp@test.local');
  await store.createSession({ id: 'x'.repeat(64), userId: u.id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1000).toISOString() });
  // Manually expire by writing a past session through a fresh token
  const token = await core.createSession(u.id);
  assert.ok(await core.userFromSessionToken(token));
  const { sha256 } = await import('../../src/lib/security/crypto');
  await store.deleteSession(sha256(token));
  await store.createSession({ id: sha256(token), userId: u.id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() - 1000).toISOString() });
  assert.equal(await core.userFromSessionToken(token), null);
});

test('role permissions: staff cannot manage fields, uploads or audit log', () => {
  assert.ok(core.permissions.viewBookings('staff'));
  assert.ok(core.permissions.manageBookings('staff'));
  assert.equal(core.permissions.manageFields('staff'), false);
  assert.equal(core.permissions.uploadImages('staff'), false);
  assert.equal(core.permissions.viewAudit('staff'), false);
  assert.ok(core.permissions.manageFields('admin'));
});
