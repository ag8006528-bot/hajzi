/**
 * The production PostgreSQL store, tested against a real Postgres engine (PGlite, in-process)
 * with the exact schema from src/lib/db/schema.ts.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const pg = new PGlite({ extensions: { btree_gist } });
const { setSqlForTests } = await import('../../src/lib/db/sql');
setSqlForTests(async (text: string, params: unknown[] = []) => {
  if (params.length === 0) {
    const results = await pg.exec(text);
    return (results.at(-1)?.rows ?? []) as never[];
  }
  return (await pg.query(text, params)).rows as never[];
});

const { getStore, SlotTakenError, PhoneLimitError, NotFoundError } = await import('../../src/lib/db');
const { demoFields } = await import('../../src/data/demo-fields');
const { realFields } = await import('../../src/data/seed');
const { addDays, todayISO } = await import('../../src/lib/booking');
const { generateRef, randomToken, sha256 } = await import('../../src/lib/security/crypto');
const { rateLimit } = await import('../../src/lib/security/rate-limit');
const { saveUpload, readUpload } = await import('../../src/lib/security/uploads');

const store = getStore();
const date = addDays(todayISO(), 3);
const opts = (patch = {}) => ({ ref: generateRef(), accessTokenHash: sha256(randomToken()), maxPerPhonePerDay: 2, maxActivePerPhone: 4, ...patch });
const input = (start: number, phone: string, fieldId = 'green-line-arena', duration = 60) => ({
  fieldId, date, startMinutes: start, durationMinutes: duration, customerName: 'Test', phone,
});

before(async () => {
  const { SCHEMA_SQL } = await import('../../src/lib/db/schema');
  await pg.exec(SCHEMA_SQL);
  await pg.exec(SCHEMA_SQL); // setup is safe to run twice
  for (const f of [...demoFields, ...realFields]) await pg.query('insert into fields (id, doc) values ($1, $2::jsonb)', [f.id, f]);
});

test('the store in use is the Postgres one', async () => {
  assert.equal((await store.listFields()).length, demoFields.length + realFields.length);
  assert.equal((await store.getField('green-line-arena'))?.name.en, 'Green Line Arena');
});

test('booking: price comes from the database, snapshot fields are filled in', async () => {
  const b = await store.createBooking({ ...input(16 * 60, '+962790000001'), players: 10 }, opts({ customerId: 'cust-1' }));
  assert.equal(b.totalPrice, 30);
  assert.equal(b.status, 'confirmed');
  assert.equal(b.fieldName.en, 'Green Line Arena');
  assert.equal(b.players, 10);
  assert.equal((await store.getBookingByRef(b.ref.toLowerCase()))?.id, b.id);
  assert.equal((await store.listBookings({ customerId: 'cust-1' })).length, 1);
  assert.equal((await store.listBookings({ date, fieldId: 'green-line-arena', status: 'confirmed' })).length, 1);
});

test('double booking is impossible, including simultaneous requests', async () => {
  await store.createBooking(input(18 * 60, '+962790000002', 'green-line-arena', 120), opts());
  await assert.rejects(store.createBooking(input(19 * 60, '+962790000003'), opts()), SlotTakenError);
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, (_, i) => store.createBooking(input(21 * 60, `+96279100000${i}`), opts())),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.ok(results.every((r) => r.status === 'fulfilled' || r.reason instanceof SlotTakenError));
});

test('admin blocks and bookings can never overlap', async () => {
  const block = await store.addBlock('green-line-arena', date, 23 * 60, 60);
  await assert.rejects(store.createBooking(input(23 * 60, '+962790000004'), opts()), SlotTakenError);
  await assert.rejects(store.addBlock('green-line-arena', date, 16 * 60, 60), SlotTakenError); // over a booking
  assert.ok((await store.getBusy('green-line-arena', date)).some((x) => x.kind === 'block' && x.blockId === block.id));
  assert.equal((await store.listBlocks('green-line-arena', date)).length, 1);
  assert.equal((await store.removeBlock(block.id))?.id, block.id);
  assert.equal((await store.listBlocks('green-line-arena', date)).length, 0);
});

test('per-phone limits, call-to-book fields and closing times are enforced', async () => {
  const phone = '+962790000009';
  await store.createBooking(input(16 * 60, phone, 'midfield-five'), opts());
  await store.createBooking(input(17 * 60, phone, 'midfield-five'), opts());
  await assert.rejects(store.createBooking(input(19 * 60, phone, 'midfield-five'), opts()), PhoneLimitError);

  await store.updateField('corner-flag-park', { onlineBooking: false });
  await assert.rejects(store.createBooking(input(16 * 60, '+962790000010', 'corner-flag-park'), opts()),
    (e: unknown) => e instanceof NotFoundError && e.message === 'FIELD_NOT_BOOKABLE');
  await assert.rejects(store.createBooking(input(20 * 60, '+962790000011', 'mayar-football-pitch', 90), opts()),
    (e: unknown) => e instanceof NotFoundError && e.message === 'OUTSIDE_HOURS');
  await assert.rejects(store.createBooking(input(16 * 60, '+962790000012', 'no-such-field'), opts()),
    (e: unknown) => e instanceof NotFoundError && e.message === 'FIELD_NOT_FOUND');
});

test('cancel and restore: restoring can never create a double booking', async () => {
  const a = await store.createBooking(input(16 * 60, '+962790000020', 'golden-boot-stadium'), opts());
  assert.equal((await store.setBookingStatus(a.id, 'cancelled'))?.status, 'cancelled');
  await store.createBooking(input(16 * 60, '+962790000021', 'golden-boot-stadium'), opts());
  await assert.rejects(store.setBookingStatus(a.id, 'confirmed'), SlotTakenError);
  assert.equal(await store.setBookingStatus(randomUUID(), 'cancelled'), null);
});

test('fields: create (unique id), update (id/createdAt protected), delete', async () => {
  const { id: _i, createdAt: _c, ...data } = demoFields[0];
  const f1 = await store.createField({ ...data, name: { en: 'New Pitch', ar: 'ملعب' } });
  const f2 = await store.createField({ ...data, name: { en: 'New Pitch', ar: 'ملعب' } });
  assert.equal(f1.id, 'new-pitch');
  assert.notEqual(f2.id, f1.id);
  const u = await store.updateField(f1.id, { pricePerHour: 40, id: 'hacked' } as never);
  assert.equal(u?.pricePerHour, 40);
  assert.equal(u?.id, 'new-pitch');
  assert.equal(u?.createdAt, f1.createdAt);
  assert.equal(await store.deleteField(f2.id), true);
  assert.equal(await store.getField(f2.id), null);
});

test('staff users and customers: unique emails, patches can clear values', async () => {
  const user = { id: randomUUID(), email: 'a@hajzi.test', name: 'A', role: 'admin' as const, passwordHash: 'x', totpEnabled: false, failedAttempts: 3, lockedUntil: new Date().toISOString(), createdAt: new Date().toISOString() };
  await store.createUser(user);
  await assert.rejects(store.createUser({ ...user, id: randomUUID() }), /USER_EXISTS/);
  const cleared = await store.updateUser(user.id, { failedAttempts: 0, lockedUntil: undefined });
  assert.equal(cleared?.failedAttempts, 0);
  assert.equal('lockedUntil' in (cleared ?? {}), false);
  assert.equal((await store.getUserByEmail(' A@HAJZI.test '))?.id, user.id);
  assert.equal(await store.countUsers(), 1);

  const cust = { id: randomUUID(), name: 'C', email: 'c@hajzi.test', phone: '+962790000099', passwordHash: 'x', failedAttempts: 0, createdAt: new Date().toISOString() };
  await store.createCustomer(cust);
  await assert.rejects(store.createCustomer({ ...cust, id: randomUUID() }), /CUSTOMER_EXISTS/);
  assert.equal((await store.updateCustomer(cust.id, { name: 'Changed' }))?.name, 'Changed');
  assert.equal((await store.getCustomerById(cust.id))?.email, 'c@hajzi.test');
});

test('sessions: create, read, revoke one or all', async () => {
  const s = (userId: string) => ({ id: sha256(randomToken()), userId, kind: 'customer' as const, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600_000).toISOString() });
  const s1 = s('u1'), s2 = s('u1');
  await store.createSession(s1);
  await store.createSession(s2);
  assert.equal((await store.getSession(s1.id))?.kind, 'customer');
  await store.deleteSession(s1.id);
  assert.equal(await store.getSession(s1.id), null);
  await store.deleteUserSessions('u1');
  assert.equal(await store.getSession(s2.id), null);
});

test('audit log and messages come back newest first', async () => {
  for (let i = 0; i < 3; i++) await store.addAudit({ id: randomUUID(), at: new Date(Date.now() + i * 1000).toISOString(), actor: 't', action: `a${i}` });
  assert.deepEqual((await store.listAudit(2)).map((a) => a.action), ['a2', 'a1']);
  await store.addMessage({ id: randomUUID(), name: 'N', contact: 'n@x.co', message: 'hello there', createdAt: new Date().toISOString() });
  assert.equal((await store.listMessages(5))[0].name, 'N');
});

test('retention anonymises old bookings', async () => {
  const old = addDays(todayISO(), -400);
  await pg.query(
    `insert into bookings (id, ref, field_id, booking_date, start_minutes, duration_minutes, status, phone, doc)
     values ('old-1', 'HZ-OLD00001', 'green-line-arena', $1::date, 960, 60, 'confirmed', '+962790000050', $2::jsonb)`,
    [old, JSON.stringify({ id: 'old-1', ref: 'HZ-OLD00001', customerName: 'Old Name', phone: '+962790000050', notes: 'x', date: old })],
  );
  const r = await store.runRetention(addDays(todayISO(), -365));
  assert.equal(r.bookings, 1);
  const b = await store.getBookingById('old-1');
  assert.equal(b?.customerName, '—');
  assert.equal(b?.phone, '');
  assert.equal(b?.anonymized, true);
  assert.equal('notes' in (b ?? {}), false);
});

test('rate limits are shared through the database', async () => {
  const id = randomUUID();
  const results = [];
  for (let i = 0; i < 4; i++) results.push((await rateLimit('contact', id)).ok); // limit 3 / 10 min
  assert.deepEqual(results, [true, true, true, false]);
  const [{ n }] = (await pg.query<{ n: number }>("select count(*)::int as n from rate_limits where key like '%contact%'")).rows;
  assert.equal(n, 1);
});

test('uploaded images are stored in the database', async () => {
  const bytes = Buffer.from('RIFF0000WEBPtest-image-bytes');
  const name = await saveUpload(bytes);
  assert.match(name, /^[a-f0-9]{32}\.webp$/);
  assert.deepEqual(await readUpload(name), bytes);
  assert.equal(await readUpload('../../etc/passwd'), null);
  assert.equal(await readUpload(`${'0'.repeat(32)}.webp`), null);
});

test('records are stored as real JSON objects, never double-encoded strings', async () => {
  for (const table of ['fields', 'bookings', 'users', 'customers', 'sessions', 'audit_log', 'contact_messages']) {
    const { rows } = await pg.query<{ t: string }>(`select distinct jsonb_typeof(doc) as t from ${table}`);
    assert.deepEqual(rows.map((r) => r.t), rows.length ? ['object'] : [], table);
  }
});

test('Supabase public API is locked down: RLS on every table', async () => {
  const { rows } = await pg.query<{ t: string }>(
    "select relname as t from pg_class where relkind = 'r' and relnamespace = 'public'::regnamespace and not relrowsecurity",
  );
  assert.deepEqual(rows, []);
});
