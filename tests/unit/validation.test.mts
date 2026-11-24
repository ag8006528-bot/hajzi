import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayISO } from '../../src/lib/booking';
import { cleanText, isValidPhone, maskPhone, normalizePhone, scrubPII } from '../../src/lib/security/sanitize';
import { bookingSchema, contactSchema, fieldSchema, loginSchema, toBookingErrors } from '../../src/lib/validation';

const tomorrow = addDays(todayISO(), 1);
const valid = {
  fieldId: 'green-line-arena',
  date: tomorrow,
  startMinutes: 19 * 60,
  durationMinutes: 60,
  customerName: 'Omar Haddad',
  phone: '079 123 4567',
};

test('accepts a valid booking and normalises the phone to E.164', () => {
  const r = bookingSchema.safeParse(valid);
  assert.ok(r.success);
  assert.equal(r.data.phone, '+962791234567');
});

test('strips HTML/script from names and notes (XSS)', () => {
  const r = bookingSchema.safeParse({
    ...valid,
    customerName: '<script>alert(1)</script>Omar<img src=x onerror=alert(2)>',
    notes: 'hi <b onmouseover="x()">there</b> javascript:alert(1)',
  });
  assert.ok(r.success);
  assert.equal(r.data.customerName, 'alert(1)Omar');
  assert.ok(!/[<>]/.test(r.data.notes!));
  assert.ok(!/javascript:/i.test(r.data.notes!));
});

test('SQL injection strings are just inert text (no SQL is ever built from input)', () => {
  const r = bookingSchema.safeParse({ ...valid, customerName: "Robert'); DROP TABLE bookings;--" });
  assert.ok(r.success);
  assert.equal(r.data.customerName, "Robert'); DROP TABLE bookings;--");
});

test('ignores a client-sent price (unknown keys are stripped)', () => {
  const r = bookingSchema.safeParse({ ...valid, totalPrice: 0.01, pricePerHour: 0 });
  assert.ok(r.success);
  assert.ok(!('totalPrice' in r.data));
  assert.ok(!('pricePerHour' in r.data));
});

test('rejects past dates, closed hours, odd durations and off-grid times', () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ date: addDays(todayISO(), -1) }, 'slotPast'],
    [{ startMinutes: 6 * 60 }, 'slotRequired'], // 6 AM: closed (opens 7 AM)
    [{ startMinutes: 22 * 60, durationMinutes: 120 }, 'slotRequired'], // runs past 11 PM closing
    [{ durationMinutes: 45 }, 'slotRequired'],
    [{ startMinutes: 19 * 60 + 15 }, 'slotRequired'],
    [{ date: addDays(todayISO(), 400) }, 'dateInvalid'],
    [{ date: '2026-02-31' }, 'dateInvalid'],
    [{ date: "2026-01-01' OR 1=1" }, 'dateInvalid'],
  ];
  for (const [patch, key] of cases) {
    const r = bookingSchema.safeParse({ ...valid, ...patch });
    assert.equal(r.success, false, JSON.stringify(patch));
    assert.equal(toBookingErrors(r.error!).slot, key, JSON.stringify(patch));
  }
});

test('validates names, players and note length', () => {
  const bad = bookingSchema.safeParse({ ...valid, customerName: ' <b></b> ', players: 99, notes: 'x'.repeat(501) });
  assert.equal(bad.success, false);
  const e = toBookingErrors(bad.error!);
  assert.equal(e.customerName, 'nameRequired');
  assert.equal(e.players, 'playersInvalid');
  assert.equal(e.notes, 'notesLong');
});

test('phone validation: Jordan mobiles and international numbers', () => {
  for (const ok of ['0791234567', '+962 79 123 4567', '00962781234567', '962771234567', '+44 7700 900123', '+1 415 555 2671'])
    assert.ok(isValidPhone(ok), ok);
  for (const bad of ['123', '0761234567', '+962 6 555 1234', '07912345678', 'abc', '+0123456789', '079-123-45'])
    assert.ok(!isValidPhone(bad), bad);
  assert.equal(normalizePhone('079 123 4567'), '+962791234567');
});

test('masks phone numbers for staff lists and logs', () => {
  assert.equal(maskPhone('+962791234521'), '+962 79 *** 4521');
  assert.equal(maskPhone('0791234521'), '+962 79 *** 4521');
  assert.equal(scrubPII('call 0791234521 or a@b.com on 2026-11-23'), 'call +962 79 *** 4521 or a***@*** on 2026-11-23');
});

test('cleanText removes control / bidi-override characters', () => {
  assert.equal(cleanText('Ali\u202Egnp.exe\u0000', 50), 'Alignp.exe');
});

test('contact form schema', () => {
  assert.ok(contactSchema.safeParse({ name: 'Sara', contact: 'sara@example.com', message: 'Do you host tournaments?' }).success);
  assert.ok(contactSchema.safeParse({ name: 'Sara', contact: '0791234567', message: 'Do you host tournaments?' }).success);
  assert.equal(contactSchema.safeParse({ name: 'Sara', contact: 'not-a-contact', message: 'Do you host tournaments?' }).success, false);
  assert.equal(contactSchema.safeParse({ name: 'Sara', contact: 'sara@example.com', message: '<b>hi</b>' }).success, false); // too short after stripping
});

test('field schema rejects javascript:/http image URLs and bad prices', () => {
  const base = {
    name: { en: 'A', ar: 'ب' }, type: '5v5', area: { en: 'X', ar: '' }, address: { en: '', ar: '' }, description: { en: '', ar: '' },
    coordinates: { lat: 31.9, lng: 35.9 }, pricePerHour: 30, phone: '+962 79 000 0000', whatsapp: '962790000000', size: '',
    surface: 'artificial', lighting: true, amenities: ['parking', 'parking'], images: ['/api/uploads/' + 'a'.repeat(32) + '.webp'], featured: false,
  };
  const ok = fieldSchema.safeParse(base);
  assert.ok(ok.success);
  assert.deepEqual(ok.data.amenities, ['parking']);
  assert.equal(fieldSchema.safeParse({ ...base, images: ['javascript:alert(1)'] }).success, false);
  assert.equal(fieldSchema.safeParse({ ...base, images: ['http://insecure.example/x.jpg'] }).success, false);
  assert.equal(fieldSchema.safeParse({ ...base, images: ['/api/uploads/../../.env'] }).success, false);
  assert.equal(fieldSchema.safeParse({ ...base, pricePerHour: -5 }).success, false);
  assert.equal(fieldSchema.safeParse({ ...base, type: '7v7' }).success, false);
});

test('login schema', () => {
  assert.ok(loginSchema.safeParse({ email: 'A@B.co', password: 'x' }).success);
  assert.equal(loginSchema.safeParse({ email: 'a@b.co', password: 'x', totp: '12ab56' }).success, false);
  assert.equal(loginSchema.safeParse({ email: 'nope', password: 'x' }).success, false);
});
