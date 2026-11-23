import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Isolated temporary database for this test file.
const dir = mkdtempSync(path.join(tmpdir(), 'hajzi-test-'));
process.env.HAJZI_DATA_FILE = path.join(dir, 'db.json');
process.env.HAJZI_SEED = 'demo'; // bookable fictional fields

const { getStore, SlotTakenError, PhoneLimitError } = await import('../../src/lib/db');
const { addDays, todayISO } = await import('../../src/lib/booking');
const { generateRef, randomToken, sha256, safeEqual } = await import('../../src/lib/security/crypto');

const store = getStore();
const date = addDays(todayISO(), 2);
const opts = () => ({ ref: generateRef(), accessTokenHash: sha256(randomToken()), maxPerPhonePerDay: 2, maxActivePerPhone: 4 });
const input = (start: number, phone: string, duration = 60) => ({
  fieldId: 'green-line-arena', date, startMinutes: start, durationMinutes: duration, customerName: 'Test', phone,
});

before(async () => {
  await store.listFields(); // seeds the DB
});
after(() => rmSync(dir, { recursive: true, force: true }));

test('20 simultaneous requests for the same slot → exactly one booking', async () => {
  const attempts = Array.from({ length: 20 }, (_, i) => store.createBooking(input(18 * 60, `+96279000${String(i).padStart(4, '0')}`), opts()));
  const results = await Promise.allSettled(attempts);
  const ok = results.filter((r) => r.status === 'fulfilled');
  const taken = results.filter((r) => r.status === 'rejected' && r.reason instanceof SlotTakenError);
  assert.equal(ok.length, 1);
  assert.equal(taken.length, 19);
});

test('overlapping durations are rejected (1.5h at 18:00 blocks 19:00)', async () => {
  await store.createBooking(input(20 * 60, '+962781111111', 90), opts());
  await assert.rejects(store.createBooking(input(21 * 60, '+962782222222'), opts()), SlotTakenError);
});

test('price is calculated on the server from the field price', async () => {
  const field = (await store.getField('green-line-arena'))!;
  const b = await store.createBooking(input(23 * 60, '+962783333333', 120), opts());
  assert.equal(b.totalPrice, field.pricePerHour * 2);
});

test('per-phone daily limit', async () => {
  const phone = '+962774444444';
  await store.createBooking({ ...input(16 * 60, phone), fieldId: 'midfield-five' }, opts());
  await store.createBooking({ ...input(17 * 60, phone), fieldId: 'midfield-five' }, opts());
  await assert.rejects(store.createBooking({ ...input(18 * 60, phone), fieldId: 'midfield-five' }, opts()), PhoneLimitError);
});

test('booking refs are random, non-sequential and unique', () => {
  const refs = new Set(Array.from({ length: 2000 }, generateRef));
  assert.equal(refs.size, 2000);
  for (const r of refs) assert.match(r, /^HZ-[A-Z2-9]{8}$/);
});

test('IDOR: only the matching secret token unlocks a booking', async () => {
  const token = randomToken();
  const b = await store.createBooking({ ...input(16 * 60, '+962795555555'), fieldId: 'golden-boot-stadium' }, { ...opts(), accessTokenHash: sha256(token) });
  const found = (await store.getBookingByRef(b.ref))!;
  assert.ok(safeEqual(sha256(token), found.accessTokenHash), 'owner token works');
  assert.ok(!safeEqual(sha256(randomToken()), found.accessTokenHash), 'random token fails');
  assert.ok(!safeEqual(sha256(''), found.accessTokenHash), 'empty token fails');
  assert.notEqual(found.accessTokenHash, token, 'raw token is never stored');
});

test('restoring a cancelled booking cannot double-book', async () => {
  const a = await store.createBooking({ ...input(19 * 60, '+962796666666'), fieldId: 'corner-flag-park' }, opts());
  await store.setBookingStatus(a.id, 'cancelled');
  await store.createBooking({ ...input(19 * 60, '+962797777777'), fieldId: 'corner-flag-park' }, opts());
  await assert.rejects(store.setBookingStatus(a.id, 'confirmed'), SlotTakenError);
});

test('retention anonymises old bookings', async () => {
  const r = await store.runRetention(addDays(todayISO(), 30)); // pretend everything is old
  assert.ok(r.bookings > 0);
  const all = await store.listBookings();
  assert.ok(all.every((b) => b.anonymized && b.phone === '' && b.customerName === '—'));
});
