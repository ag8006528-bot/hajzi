import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const dir = mkdtempSync(path.join(tmpdir(), 'hajzi-cust-'));
process.env.HAJZI_DATA_FILE = path.join(dir, 'db.json');
process.env.HAJZI_SEED = 'demo'; // bookable fictional fields

const { getStore } = await import('../../src/lib/db');
const core = await import('../../src/lib/auth/core');
const cust = await import('../../src/lib/auth/customer');
const { addDays, todayISO } = await import('../../src/lib/booking');
const { generateRef, randomToken, sha256 } = await import('../../src/lib/security/crypto');

const store = getStore();
const PW = `cpw-${randomUUID()}`;
after(() => rmSync(dir, { recursive: true, force: true }));

test('register creates a hashed customer account and a customer session', async () => {
  const r = await cust.registerCustomer({ name: 'Sara Ali', phone: '+962791112233', email: 'Sara@Example.com', password: PW }, 'ip');
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.customer.email, 'sara@example.com');
  assert.match(r.customer.passwordHash, /^\$2[aby]\$12\$/);
  assert.equal((await cust.customerFromSessionToken(r.token))?.id, r.customer.id);
});

test('a customer session can NEVER act as staff/admin', async () => {
  const r = await cust.authenticateCustomer({ email: 'sara@example.com', password: PW }, 'ip');
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(await core.userFromSessionToken(r.token), null);
});

test('a staff session is not accepted as a customer session', async () => {
  const u = await store.createUser({
    id: randomUUID(), email: 'st@test.local', name: 'st', role: 'admin', passwordHash: await core.hashPassword(`x-${randomUUID()}`),
    totpEnabled: false, failedAttempts: 0, createdAt: new Date().toISOString(),
  });
  const staffToken = await core.createSession(u.id);
  assert.equal(await cust.customerFromSessionToken(staffToken), null);
});

test('duplicate emails and weak passwords are refused', async () => {
  assert.deepEqual(await cust.registerCustomer({ name: 'X', phone: '+962791112244', email: 'sara@example.com', password: PW }, 'ip'), { ok: false, reason: 'exists' });
  assert.deepEqual(await cust.registerCustomer({ name: 'X', phone: '+962791112244', email: 'new@example.com', password: 'short' }, 'ip'), { ok: false, reason: 'short' });
  assert.deepEqual(await cust.registerCustomer({ name: 'X', phone: '+962791112244', email: 'new@example.com', password: 'password123' }, 'ip'), { ok: false, reason: 'weak' });
});

test('customer account locks after 5 wrong passwords', async () => {
  await cust.registerCustomer({ name: 'Lock Me', phone: '+962791112255', email: 'lock@example.com', password: PW }, 'ip');
  for (let i = 0; i < 5; i++) assert.equal((await cust.authenticateCustomer({ email: 'lock@example.com', password: 'wrong-pass' }, 'ip')).ok, false);
  assert.equal((await cust.authenticateCustomer({ email: 'lock@example.com', password: PW }, 'ip')).ok, false, 'locked even with correct password');
});

test('customers only see bookings made from their own account (not matched by phone)', async () => {
  const a = await cust.registerCustomer({ name: 'Owner', phone: '+962791119999', email: 'owner@example.com', password: PW }, 'ip');
  const b = await cust.registerCustomer({ name: 'Other', phone: '+962791119999', email: 'other@example.com', password: PW }, 'ip'); // same phone!
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) return;
  const date = addDays(todayISO(), 3);
  const opts = (customerId?: string) => ({ ref: generateRef(), accessTokenHash: sha256(randomToken()), maxPerPhonePerDay: 5, maxActivePerPhone: 10, customerId });
  const input = (start: number) => ({ fieldId: 'green-line-arena', date, startMinutes: start, durationMinutes: 60, customerName: 'Owner', phone: '+962791119999' });
  await store.createBooking(input(16 * 60), opts(a.customer.id));
  await store.createBooking(input(17 * 60), opts()); // guest booking with the same phone
  assert.equal((await store.listBookings({ customerId: a.customer.id })).length, 1);
  assert.equal((await store.listBookings({ customerId: b.customer.id })).length, 0);
});
