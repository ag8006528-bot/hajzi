/**
 * End-to-end security tests against a running server.
 *   npm run dev            (or: npm run build && npm start)
 *   npm run test:security  (BASE_URL defaults to http://localhost:3000)
 * Needs HAJZI_TEST_ADMIN_* / HAJZI_TEST_STAFF_* in .env.local (accounts created with npm run user:create).
 * Needs the bookable FICTIONAL demo fields (the real listings are call-to-book only), e.g. a server started with
 *   HAJZI_SEED=demo HAJZI_DATA_FILE=./data/test-db.json   (then create the test accounts in that file too).
 * Each scenario uses its own X-Forwarded-For IP so rate limits don't interfere between tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const envFile = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
const env = (k: string) => process.env[k] || envFile.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() || '';

// Random per-run prefix: the server remembers rate-limit counters between test runs.
const runPrefix = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
let ipCounter = 1;
const newIp = () => `${runPrefix}.${ipCounter++ % 250}`;

function addDays(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function req(path: string, init: RequestInit & { ip?: string; cookie?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set('x-forwarded-for', init.ip || newIp());
  if (init.cookie) headers.set('cookie', init.cookie);
  return fetch(`${BASE}${path}`, { ...init, headers, redirect: 'manual' });
}
const postJson = (path: string, body: unknown, init: Parameters<typeof req>[1] = {}) =>
  req(path, { ...init, method: init.method || 'POST', headers: { 'content-type': 'application/json', ...(init.headers as object) }, body: JSON.stringify(body) });

async function login(email: string, password: string) {
  const res = await postJson('/api/admin/login', { email, password });
  assert.equal(res.status, 200, `login ${email}`);
  const setCookie = res.headers.get('set-cookie') || '';
  return { cookie: setCookie.split(';')[0], setCookie };
}

/** A brand-new customer account (bookings require login; per-account limits stay separate per test). */
async function customerLogin() {
  const email = `cust-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
  const res = await postJson('/api/account/register', { name: 'Test Customer', phone: randomPhone(), email, password: `Pw-${Math.random().toString(36).slice(2)}-xyz` });
  assert.equal(res.status, 201, 'register customer');
  const setCookie = res.headers.get('set-cookie') || '';
  return { cookie: setCookie.split(';')[0], setCookie };
}

/** Random valid Jordan mobile so per-phone limits never collide between runs. */
const randomPhone = () => `079${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;

/** Find a free 1-hour slot (keeps the suite re-runnable against a persistent database). */
async function freeSlot(fieldId: string) {
  for (let d = 3; d <= 28; d++) {
    const date = addDays(d);
    const { busy } = await (await req(`/api/availability?fieldId=${fieldId}&date=${date}`)).json();
    for (let s = 16 * 60; s <= 22 * 60; s += 60)
      if (!busy.some((b: { start: number; duration: number }) => s < b.start + b.duration && b.start < s + 60)) return { date, startMinutes: s };
  }
  throw new Error('no free slot');
}

const booking = (patch: Record<string, unknown> = {}) => ({
  fieldId: 'golden-boot-stadium',
  date: addDays(5),
  startMinutes: 18 * 60,
  durationMinutes: 60,
  customerName: 'Omar Test',
  phone: randomPhone(),
  ...patch,
});

/* ───────── Security headers ───────── */

test('security headers are present', async () => {
  const res = await req('/');
  const csp = res.headers.get('content-security-policy') || '';
  assert.match(csp, /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.match(res.headers.get('permissions-policy') || '', /camera=\(\).*microphone=\(\).*geolocation=\(\)/);
  assert.equal(res.headers.get('x-powered-by'), null);
  // The nonce in the header matches the nonce on Next.js script tags
  const nonce = csp.match(/'nonce-([^']+)'/)![1];
  assert.ok((await res.text()).includes(`nonce="${nonce}"`));
});

/* ───────── Admin access control ───────── */

test('/admin redirects to login without a session (and with a forged cookie)', async () => {
  const r1 = await req('/admin');
  assert.ok([307, 308].includes(r1.status));
  assert.match(r1.headers.get('location') || '', /\/admin\/login$/);
  const r2 = await req('/admin', { cookie: 'hajzi_session=forged-value' });
  assert.ok([307, 308].includes(r2.status), 'forged cookie is rejected by the server-side session check');
  assert.match(r2.headers.get('location') || '', /\/admin\/login$/);
});

test('every admin API returns 401 without a session', async () => {
  const id = '00000000-0000-0000-0000-000000000000';
  const calls: [string, string, unknown?][] = [
    ['GET', '/api/bookings'],
    ['PATCH', `/api/bookings/${id}`, { status: 'cancelled' }],
    ['GET', `/api/bookings/${id}/phone`],
    ['POST', '/api/fields', {}],
    ['PUT', '/api/fields/golden-boot-stadium', {}],
    ['DELETE', '/api/fields/golden-boot-stadium'],
    ['GET', `/api/blocks?fieldId=golden-boot-stadium&date=${addDays(3)}`],
    ['POST', '/api/blocks', {}],
    ['DELETE', `/api/blocks?id=${id}`],
    ['GET', '/api/admin/audit'],
    ['GET', '/api/admin/messages'],
    ['POST', '/api/admin/totp', { action: 'setup' }],
  ];
  for (const [method, path, body] of calls) {
    const res = body === undefined ? await req(path, { method }) : await postJson(path, body, { method });
    assert.equal(res.status, 401, `${method} ${path}`);
  }
  const up = await req('/api/uploads', { method: 'POST', body: new FormData() });
  assert.equal(up.status, 401, 'POST /api/uploads');
});

test('login: generic error, secure cookie flags', async () => {
  const bad = await postJson('/api/admin/login', { email: env('HAJZI_TEST_STAFF_EMAIL'), password: 'definitely-wrong' });
  assert.equal(bad.status, 401);
  const body = await bad.json();
  assert.equal(body.code, 'INVALID');
  assert.ok(!/stack|Error:|at /.test(JSON.stringify(body)));

  const { setCookie } = await login(env('HAJZI_TEST_STAFF_EMAIL'), env('HAJZI_TEST_STAFF_PASSWORD'));
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  assert.match(setCookie, /Path=\//);
  assert.match(setCookie, /Max-Age=\d+/);
});

test('staff role: can view bookings (masked phones) but cannot change fields or read the audit log', async () => {
  const { cookie } = await login(env('HAJZI_TEST_STAFF_EMAIL'), env('HAJZI_TEST_STAFF_PASSWORD'));
  const list = await req('/api/bookings', { cookie });
  assert.equal(list.status, 200);
  for (const b of (await list.json()).bookings) {
    assert.ok(!('accessTokenHash' in b), 'token hash never leaves the server');
    if (b.phone) assert.match(b.phone, /\*\*\*/, 'phone is masked');
  }
  assert.equal((await req('/api/fields/golden-boot-stadium', { method: 'DELETE', cookie })).status, 403);
  assert.equal((await postJson('/api/fields', {}, { cookie })).status, 403);
  assert.equal((await req('/api/admin/audit', { cookie })).status, 403);
});

/* ───────── CSRF / CORS ───────── */

test('cross-origin state-changing requests are blocked', async () => {
  const evil = { origin: 'https://evil.example' };
  assert.equal((await postJson('/api/bookings', booking(), { headers: evil })).status, 403);
  assert.equal((await postJson('/api/admin/login', { email: 'a@b.co', password: 'x' }, { headers: evil })).status, 403);
  assert.equal((await postJson('/api/contact', {}, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  const pre = await req('/api/bookings', { method: 'OPTIONS', headers: { ...evil, 'access-control-request-method': 'POST' } });
  assert.equal(pre.status, 403);
  assert.equal(pre.headers.get('access-control-allow-origin'), null);
});

/* ───────── Booking integrity ───────── */

test('nobody can book without logging in as a customer', async () => {
  const slot = await freeSlot('golden-boot-stadium');
  const guest = await postJson('/api/bookings', booking(slot));
  assert.equal(guest.status, 401);
  assert.equal((await guest.json()).code, 'LOGIN_REQUIRED');
  // Forged cookies and staff/admin sessions are not customer sessions either.
  assert.equal((await postJson('/api/bookings', booking(slot), { cookie: 'hajzi_customer=forged-value' })).status, 401);
  const staff = await login(env('HAJZI_TEST_STAFF_EMAIL'), env('HAJZI_TEST_STAFF_PASSWORD'));
  assert.equal((await postJson('/api/bookings', booking(slot), { cookie: staff.cookie })).status, 401);
  // The slot is still free afterwards.
  assert.deepEqual(await freeSlot('golden-boot-stadium'), slot);
});

test('a logged-in customer can book, and the booking is in their account', async () => {
  const { cookie } = await customerLogin();
  const res = await postJson('/api/bookings', booking(await freeSlot('golden-boot-stadium')), { cookie });
  assert.equal(res.status, 201);
  const { ref } = await res.json();
  assert.ok((await (await req('/account', { cookie })).text()).includes(ref), 'shown under My bookings');
});

test('after login, ?next= only redirects to field pages on this site', async () => {
  const { cookie } = await customerLogin();
  const ok = await req('/account/login?next=%2Ffields%2Fgolden-boot-stadium', { cookie });
  assert.match(ok.headers.get('location') || '', /\/fields\/golden-boot-stadium$/);
  for (const bad of ['https://evil.example', '//evil.example', '/admin']) {
    const r = await req(`/account/login?next=${encodeURIComponent(bad)}`, { cookie });
    assert.match(r.headers.get('location') || '', /\/account$/, bad);
  }
});

test('price tampering is ignored and XSS is neutralised', async () => {
  const { cookie } = await customerLogin();
  const res = await postJson('/api/bookings', booking({ ...(await freeSlot('golden-boot-stadium')), totalPrice: 0.01, customerName: '<script>alert(1)</script>Omar <img src=x onerror=alert(2)>' }), { cookie });
  assert.equal(res.status, 201);
  const { ref, token, totalPrice } = await res.json();
  assert.equal(totalPrice, 85, 'server price for 1h of Golden Boot Stadium (85 JOD/h)');
  const page = await (await req(`/booking/${ref}?t=${token}`)).text();
  assert.ok(page.includes('alert(1)Omar'), 'name shown as plain text');
  assert.ok(!page.includes('<script>alert(1)'), 'no injected script');
  assert.ok(!page.includes('onerror=alert'), 'no injected handler');

  // IDOR: the reference alone, or a wrong token, reveals nothing.
  for (const url of [`/booking/${ref}`, `/booking/${ref}?t=wrong`, `/booking/${ref}?t=${token.slice(0, -2)}xx`]) {
    const html = await (await req(url)).text();
    assert.ok(html.includes('Booking not found'), url);
    assert.ok(!html.includes('alert(1)Omar'), `${url} leaks no customer data`);
  }
});

test('SQL-injection-style input is inert', async () => {
  const { cookie } = await customerLogin();
  const ok = await postJson('/api/bookings', booking({ ...(await freeSlot('golden-boot-stadium')), customerName: "x' OR '1'='1'; DROP TABLE bookings;--" }), { cookie });
  assert.equal(ok.status, 201);
  const bad = await req(`/api/availability?fieldId=${encodeURIComponent("golden-boot-stadium' OR 1=1--")}&date=${addDays(5)}`);
  assert.equal(bad.status, 400);
});

test('two people booking the same slot at the same moment → one wins, one gets 409', async () => {
  const body = booking({ fieldId: 'corner-flag-park', ...(await freeSlot('corner-flag-park')) });
  const [c1, c2] = await Promise.all([customerLogin(), customerLogin()]);
  const [a, b] = await Promise.all([
    postJson('/api/bookings', { ...body, phone: randomPhone() }, { cookie: c1.cookie }),
    postJson('/api/bookings', { ...body, phone: randomPhone() }, { cookie: c2.cookie }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
});

test('availability API never exposes customer data', async () => {
  const res = await req(`/api/availability?fieldId=golden-boot-stadium&date=${addDays(5)}`);
  const text = await res.text();
  assert.ok(!/Omar|0791|\+962|customer|phone/i.test(text), text);
});

test('bad input gets generic errors, never stack traces', async () => {
  const ip = newIp();
  const { cookie } = await customerLogin();
  const r1 = await req('/api/bookings', { method: 'POST', ip, cookie, headers: { 'content-type': 'application/json' }, body: '{"broken' });
  assert.equal(r1.status, 400);
  assert.deepEqual(await r1.json(), { error: 'Invalid JSON' });
  const r2 = await req('/api/bookings', { method: 'POST', ip, cookie, headers: { 'content-type': 'text/plain' }, body: '{}' });
  assert.equal(r2.status, 415);
  const r3 = await postJson('/api/bookings', 'x'.repeat(20_000), { ip, cookie });
  assert.equal(r3.status, 413);
});

test('honeypot submissions are rejected', async () => {
  const { cookie } = await customerLogin();
  const res = await postJson('/api/bookings', booking({ ...(await freeSlot('golden-boot-stadium')), website: 'http://spam.example' }), { cookie });
  assert.equal(res.status, 400);
});

/* ───────── Rate limiting ───────── */

test('booking endpoint is rate limited per IP', async () => {
  const ip = newIp();
  const { cookie } = await customerLogin();
  const statuses: number[] = [];
  for (let i = 0; i < 7; i++) statuses.push((await postJson('/api/bookings', { bad: true }, { ip, cookie })).status);
  assert.ok(statuses.slice(0, 5).every((s) => s === 400), statuses.join());
  assert.equal(statuses[6], 429);
});

test('contact form is rate limited per IP', async () => {
  const ip = newIp();
  const statuses: number[] = [];
  for (let i = 0; i < 5; i++) statuses.push((await postJson('/api/contact', { name: 'Sara', contact: 'sara@example.com', message: 'Rate limit test message' }, { ip })).status);
  assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
});

test('login is rate limited per IP', async () => {
  const ip = newIp();
  let last = 0;
  for (let i = 0; i < 11; i++) last = (await postJson('/api/admin/login', { email: 'nobody@hajzi.test', password: 'x' }, { ip })).status;
  assert.equal(last, 429);
});

/* ───────── Uploads ───────── */

test('uploads: content sniffing, EXIF stripping, random names, no path traversal', async () => {
  const { cookie } = await login(env('HAJZI_TEST_ADMIN_EMAIL'), env('HAJZI_TEST_ADMIN_PASSWORD'));

  const fake = new FormData();
  fake.append('file', new Blob(['<?php system($_GET["c"]); ?>'], { type: 'image/jpeg' }), 'shell.jpg');
  assert.equal((await req('/api/uploads', { method: 'POST', body: fake, cookie })).status, 415, 'non-image with .jpg name rejected');

  const jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#1B7A3D' } })
    .jpeg()
    .withExif({ IFD0: { Copyright: 'SECRET-GPS-31.95,35.91', Artist: 'Phone owner' } })
    .toBuffer();
  assert.ok((await sharp(jpeg).metadata()).exif, 'test image starts with EXIF');
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }), '../../evil name.jpg');
  const up = await req('/api/uploads', { method: 'POST', body: fd, cookie });
  assert.equal(up.status, 201);
  const { url } = await up.json();
  assert.match(url, /^\/api\/uploads\/[a-f0-9]{32}\.webp$/);

  const img = await req(url);
  assert.equal(img.headers.get('content-type'), 'image/webp');
  const meta = await sharp(Buffer.from(await img.arrayBuffer())).metadata();
  assert.equal(meta.exif, undefined, 'EXIF removed');

  assert.equal((await req('/api/uploads/..%2F..%2F.env.local')).status, 404);
  assert.equal((await req('/api/uploads/x.svg')).status, 404);
});

/* ───────── Field owner accounts ───────── */

test('field owners only ever see and change their OWN field', async () => {
  const admin = await login(env('HAJZI_TEST_ADMIN_EMAIL'), env('HAJZI_TEST_ADMIN_PASSWORD'));
  const email = `owner-${Date.now()}@example.com`;
  const created = await postJson('/api/admin/owners', { email, name: 'Test Owner', fieldIds: ['golden-boot-stadium'] }, { cookie: admin.cookie });
  assert.equal(created.status, 201);
  const { tempPassword, owner } = await created.json();
  const { cookie } = await login(email, tempPassword);

  // A booking on ANOTHER field, made by a customer.
  const customer = await customerLogin();
  const other = await postJson('/api/bookings', booking({ fieldId: 'corner-flag-park', ...(await freeSlot('corner-flag-park')) }), { cookie: customer.cookie });
  assert.equal(other.status, 201);
  const staffList = await (await req('/api/bookings?fieldId=corner-flag-park', { cookie: admin.cookie })).json();
  const otherId = staffList.bookings[0].id;

  // Bookings: only their field.
  const mine = await (await req('/api/bookings', { cookie })).json();
  assert.ok(mine.bookings.every((b: { fieldId: string }) => b.fieldId === 'golden-boot-stadium'));
  assert.equal((await req('/api/bookings?fieldId=corner-flag-park', { cookie })).status, 403);
  assert.equal((await postJson(`/api/bookings/${otherId}`, { status: 'cancelled' }, { cookie, method: 'PATCH' })).status, 404);
  assert.equal((await req(`/api/bookings/${otherId}/phone`, { cookie })).status, 404);

  // Blocked times: only their field.
  const date = addDays(9);
  assert.equal((await req(`/api/blocks?fieldId=corner-flag-park&date=${date}`, { cookie })).status, 403);
  assert.equal((await postJson('/api/blocks', { fieldId: 'corner-flag-park', date, startMinutes: 17 * 60 }, { cookie })).status, 403);
  const blk = await postJson('/api/blocks', { fieldId: 'golden-boot-stadium', date, startMinutes: 17 * 60 }, { cookie });
  assert.equal(blk.status, 201);
  const blockId = (await blk.json()).block.id;
  assert.equal((await req(`/api/blocks?id=${blockId}&fieldId=golden-boot-stadium&date=${date}`, { cookie, method: 'DELETE' })).status, 200);

  // Field details: own field only, and only owner-editable settings.
  const field = (await (await req('/api/fields/golden-boot-stadium')).json()).field;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _i, createdAt: _c, ...input } = field;
  assert.equal((await postJson('/api/fields/corner-flag-park', input, { cookie, method: 'PUT' })).status, 404);
  const upd = await postJson('/api/fields/golden-boot-stadium', { ...input, pricePerHour: 90, name: { en: 'Hacked', ar: 'Hacked' }, featured: false }, { cookie, method: 'PUT' });
  assert.equal(upd.status, 200);
  const after = (await upd.json()).field;
  assert.equal(after.pricePerHour, 90, 'owner can change the price');
  assert.equal(after.name.en, field.name.en, 'owner cannot rename the field');
  assert.equal(after.featured, field.featured, 'owner cannot change listing flags');
  // Restore the price for the other tests.
  assert.equal((await postJson('/api/fields/golden-boot-stadium', input, { cookie: admin.cookie, method: 'PUT' })).status, 200);

  // Admin-only areas.
  for (const path of ['/api/admin/messages', '/api/admin/audit', '/api/admin/owners']) assert.equal((await req(path, { cookie })).status, 403, path);
  assert.equal((await req('/api/fields/golden-boot-stadium', { cookie, method: 'DELETE' })).status, 403);
  assert.equal((await postJson('/api/fields', input, { cookie })).status, 403);

  // Removing the owner ends their access immediately.
  assert.equal((await req(`/api/admin/owners?id=${owner.id}`, { cookie: admin.cookie, method: 'DELETE' })).status, 200);
  assert.equal((await req('/api/bookings', { cookie })).status, 401);
});
