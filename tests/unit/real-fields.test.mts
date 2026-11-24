import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Fresh database seeded with the REAL Amman listings (no HAJZI_SEED=demo).
const dir = mkdtempSync(path.join(tmpdir(), 'hajzi-real-'));
process.env.HAJZI_DATA_FILE = path.join(dir, 'db.json');
delete process.env.HAJZI_SEED;

const { getStore, NotFoundError } = await import('../../src/lib/db');
const { realFields } = await import('../../src/data/seed');
const { fieldSchema, isBookableOnline } = await import('../../src/lib/validation');
const { addDays, todayISO } = await import('../../src/lib/booking');
const { generateRef, randomToken, sha256 } = await import('../../src/lib/security/crypto');

after(() => rmSync(dir, { recursive: true, force: true }));

const opts = () => ({ ref: generateRef(), accessTokenHash: sha256(randomToken()), maxPerPhonePerDay: 5, maxActivePerPhone: 10 });
const date = addDays(todayISO(), 2);

test('23 real listings: unique ids, valid for the admin form, bookable online with a price', () => {
  assert.equal(realFields.length, 23);
  assert.equal(new Set(realFields.map((f) => f.id)).size, 23);
  for (const f of realFields) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, ...input } = f;
    const r = fieldSchema.safeParse(input);
    assert.ok(r.success, `${f.id}: ${r.success ? '' : JSON.stringify(r.error.issues)}`);
    assert.ok(isBookableOnline(f), f.id);
    assert.ok(f.pricePerHour >= 10 && f.pricePerHour <= 60, `${f.id} price ${f.pricePerHour}`);
    // Every price is either published by the venue (with a source) or labelled approximate.
    assert.ok(Boolean(f.priceSource) !== Boolean(f.priceEstimated), `${f.id} price is sourced XOR estimated`);
  }
  const published = realFields.filter((f) => f.priceSource).map((f) => [f.id, f.pricePerHour]);
  assert.deepEqual(Object.fromEntries(published), {
    'aldaoud-goal-space': 30,
    'martyr-pilot-ayed-al-dasan-6-a-side-pitc': 25,
    'marar-football-pitch': 15,
  });
});

test('closing times come from the listed opening hours', () => {
  const close = (id: string) => realFields.find((f) => f.id === id)?.closeMinutes;
  assert.equal(close('mayar-football-pitch'), 21 * 60); // until 9 PM
  assert.equal(close('amman-football-club'), 22 * 60 + 30); // until 10:30 PM
  assert.equal(close('yarmouk-sports-stadiums'), 24 * 60 + 30); // until 12:30 AM
  assert.equal(close('jo-street-court'), undefined); // open 24 h → site-wide hours
});

test('a real field can be booked online, but not after it closes', async () => {
  const store = getStore();
  const b = await store.createBooking(
    { fieldId: 'mayar-football-pitch', date, startMinutes: 20 * 60, durationMinutes: 60, customerName: 'Test', phone: '+962791234567' },
    opts(),
  );
  assert.equal(b.totalPrice, 30); // approx. price for Tla'a Al-Ali
  await assert.rejects(
    store.createBooking(
      { fieldId: 'mayar-football-pitch', date, startMinutes: 20 * 60, durationMinutes: 90, customerName: 'Test', phone: '+962791234568' },
      opts(),
    ),
    (e: unknown) => e instanceof NotFoundError && e.message === 'OUTSIDE_HOURS',
  );
});

test('a field switched to "call to book" by an admin refuses online bookings', async () => {
  const store = getStore();
  await store.updateField('marar-football-pitch', { onlineBooking: false });
  await assert.rejects(
    store.createBooking(
      { fieldId: 'marar-football-pitch', date, startMinutes: 18 * 60, durationMinutes: 60, customerName: 'Test', phone: '+962791234569' },
      opts(),
    ),
    (e: unknown) => e instanceof NotFoundError && e.message === 'FIELD_NOT_BOOKABLE',
  );
});

test('WhatsApp defaults to the field owner\'s phone when left empty', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, createdAt, ...input } = realFields[0];
  const r = fieldSchema.safeParse({ ...input, phone: '079 123 4567', whatsapp: '' });
  assert.ok(r.success);
  if (r.success) assert.equal(r.data.whatsapp, '962791234567');
  assert.equal(fieldSchema.safeParse({ ...input, whatsapp: '12' }).success, false);
});

test('a field taking online bookings must have a price', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, createdAt, ...input } = realFields[0];
  assert.equal(fieldSchema.safeParse({ ...input, onlineBooking: true, pricePerHour: 0 }).success, false);
  assert.equal(fieldSchema.safeParse({ ...input, onlineBooking: true, pricePerHour: 30 }).success, true);
});
