import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const dir = mkdtempSync(path.join(tmpdir(), 'hajzi-owner-'));
process.env.HAJZI_DATA_FILE = path.join(dir, 'db.json');
process.env.HAJZI_SEED = 'demo';

const { getStore } = await import('../../src/lib/db');
const core = await import('../../src/lib/auth/core');
after(() => rmSync(dir, { recursive: true, force: true }));

const store = getStore();
const admin = await store.createUser({
  id: randomUUID(), email: 'boss@hajzi.test', name: 'Boss', role: 'admin',
  passwordHash: await core.hashPassword(`a-${randomUUID()}`), totpEnabled: false, failedAttempts: 0, createdAt: new Date().toISOString(),
});

test('admin creates an owner: temporary password works once, must be changed, fields are validated', async () => {
  assert.deepEqual(await core.createOwnerAccount(admin, { email: 'x@hajzi.test', name: '', fieldIds: ['no-such-field'] }), { ok: false, reason: 'no_fields' });
  const r = await core.createOwnerAccount(admin, { email: 'Owner@HAJZI.test', name: 'Abu Ali', fieldIds: ['green-line-arena', 'green-line-arena'] });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.user.role, 'owner');
  assert.deepEqual(r.user.fieldIds, ['green-line-arena']);
  assert.equal(r.user.mustChangePassword, true);
  assert.match(r.tempPassword, /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
  assert.match(r.user.passwordHash, /^\$2[aby]\$12\$/, 'only a bcrypt hash is stored');

  const login = await core.authenticate({ email: 'owner@hajzi.test', password: r.tempPassword }, 'ip');
  assert.ok(login.ok);
  assert.deepEqual(await core.createOwnerAccount(admin, { email: 'owner@hajzi.test', name: '', fieldIds: ['midfield-five'] }), { ok: false, reason: 'exists' });

  // Change the temporary password.
  const owner = (await store.getUserByEmail('owner@hajzi.test'))!;
  assert.deepEqual(await core.changeOwnPassword(owner, 'wrong', 'Some-New-Pass-123'), { ok: false, reason: 'wrong_password' });
  assert.deepEqual(await core.changeOwnPassword(owner, r.tempPassword, 'short'), { ok: false, reason: 'short' });
  assert.deepEqual(await core.changeOwnPassword(owner, r.tempPassword, 'Some-New-Pass-123'), { ok: true });
  const changed = (await store.getUserByEmail('owner@hajzi.test'))!;
  assert.equal(changed.mustChangePassword, undefined);
  assert.equal((await core.authenticate({ email: 'owner@hajzi.test', password: r.tempPassword }, 'ip')).ok, false, 'temporary password no longer works');
  assert.equal((await core.authenticate({ email: 'owner@hajzi.test', password: 'Some-New-Pass-123' }, 'ip')).ok, true);
});

test('an owner can only access their own field', async () => {
  const owner = (await store.getUserByEmail('owner@hajzi.test'))!;
  assert.equal(core.canAccessField(owner, 'green-line-arena'), true);
  assert.equal(core.canAccessField(owner, 'midfield-five'), false);
  assert.equal(core.canAccessField(admin, 'midfield-five'), true, 'admins see every field');
  // Owners have no access to admin-only areas.
  for (const p of ['viewMessages', 'manageFields', 'manageOwners', 'viewAudit'] as const) assert.equal(core.permissions[p]('owner'), false, p);
  for (const p of ['viewBookings', 'manageBookings', 'manageBlocks', 'editOwnField'] as const) assert.equal(core.permissions[p]('owner'), true, p);
  assert.equal(core.permissions.editOwnField('staff'), false, 'staff still cannot edit fields');
});

test('a removed owner cannot log in and their sessions stop working', async () => {
  const owner = (await store.getUserByEmail('owner@hajzi.test'))!;
  const login = await core.authenticate({ email: 'owner@hajzi.test', password: 'Some-New-Pass-123' }, 'ip');
  assert.ok(login.ok);
  if (!login.ok) return;
  assert.equal((await core.userFromSessionToken(login.token))?.id, owner.id);
  assert.equal(await core.disableOwner(admin, owner.id), true);
  assert.equal(await core.userFromSessionToken(login.token), null, 'session revoked');
  assert.equal((await core.authenticate({ email: 'owner@hajzi.test', password: 'Some-New-Pass-123' }, 'ip')).ok, false);
  assert.equal(await core.disableOwner(admin, admin.id), false, 'only owner accounts can be removed this way');
  // The same email can be given a new account later.
  const again = await core.createOwnerAccount(admin, { email: 'owner@hajzi.test', name: '', fieldIds: ['midfield-five'] });
  assert.ok(again.ok);
  if (again.ok) assert.deepEqual(again.user.fieldIds, ['midfield-five']);
});
