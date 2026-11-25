import { canAccessField, getCurrentCustomer, requirePermission } from '@/lib/auth';
import { getStore, NotFoundError, PhoneLimitError, SlotTakenError } from '@/lib/db';
import { env } from '@/lib/env';
import { audit, log } from '@/lib/logger';
import { maybeRunRetention, toBookingView } from '@/lib/retention';
import { generateRef, hashIp, randomToken, sha256 } from '@/lib/security/crypto';
import { clientIp, fail, json, limit, parseJson, route } from '@/lib/security/request';
import { maskPhone } from '@/lib/security/sanitize';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { bookingFilterQuery, bookingSchema, queryObject, toBookingErrors } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/bookings — create a booking. Only SIGNED-IN CUSTOMERS can book: every booking is tied to an
 * account, so it shows in "My bookings" and abuse can be traced to (and limited per) an account.
 * Everything is re-validated here.
 */
export const POST = route(async (req) => {
  const ip = clientIp(req);
  const limited = (await limit(req, 'booking', ip)) || (await limit(req, 'bookingDaily', ip));
  if (limited) return limited;

  // Login required. Checked on the server, so it can't be skipped by calling the API directly.
  // (Staff sessions use a different cookie and are not accepted here.)
  const customer = await getCurrentCustomer();
  if (!customer) return fail('Please log in to book a field', 401, { code: 'LOGIN_REQUIRED' });
  const perAccount = (await limit(req, 'booking', `customer:${customer.id}`)) || (await limit(req, 'bookingDaily', `customer:${customer.id}`));
  if (perAccount) return perAccount;

  // Validation errors come back as the booking form's translation keys.
  const parsed = await parseJson(req, bookingSchema, 8_192, (e) => ({ errors: toBookingErrors(e) }));
  if (!parsed.ok) return parsed.res;
  const data = parsed.data;

  // Honeypot: real users never see or fill this field.
  if (data.website) {
    log('warn', 'honeypot_triggered', { route: 'booking', ip: hashIp(ip) });
    return fail('Validation failed', 400);
  }
  if (!(await verifyTurnstile(data.turnstileToken, ip))) return fail('Captcha check failed', 400, { code: 'CAPTCHA' });

  const token = randomToken(32); // goes ONLY to this customer, in their confirmation link
  try {
    const booking = await getStore().createBooking(
      {
        fieldId: data.fieldId,
        date: data.date,
        startMinutes: data.startMinutes,
        durationMinutes: data.durationMinutes,
        customerName: data.customerName,
        phone: data.phone,
        players: data.players,
        notes: data.notes,
      },
      {
        ref: generateRef(),
        accessTokenHash: sha256(token),
        maxPerPhonePerDay: env.maxBookingsPerPhonePerDay,
        maxActivePerPhone: env.maxActiveBookingsPerPhone,
        customerId: customer.id,
      },
    );
    await audit(`customer:${customer.id}`, 'booking_created', booking.ref, {
      field: booking.fieldId,
      date: booking.date,
      start: booking.startMinutes,
      phone: maskPhone(booking.phone),
      ip: hashIp(ip),
    });
    void maybeRunRetention();
    return json({ ref: booking.ref, token, totalPrice: booking.totalPrice }, 201);
  } catch (e) {
    if (e instanceof SlotTakenError) return fail('This time slot is no longer available', 409, { code: 'SLOT_TAKEN' });
    if (e instanceof PhoneLimitError) return fail('Booking limit reached for this phone number', 429, { code: 'PHONE_LIMIT' });
    if (e instanceof NotFoundError && e.message === 'OUTSIDE_HOURS')
      return fail('The field is closed at that time', 400, { code: 'OUTSIDE_HOURS' });
    if (e instanceof NotFoundError && e.message === 'FIELD_NOT_BOOKABLE')
      return fail('This field takes bookings by phone only', 409, { code: 'CALL_TO_BOOK' });
    if (e instanceof NotFoundError) return fail('Not found', 404);
    throw e;
  }
});

/** GET /api/bookings?date=&fieldId=&fieldType=&status= — staff/admin only. Phones are masked. */
export const GET = route(async (req) => {
  const auth = await requirePermission('viewBookings');
  if ('res' in auth) return auth.res;
  const limited = await limit(req, 'admin', auth.user.id);
  if (limited) return limited;
  const q = bookingFilterQuery.safeParse(queryObject(new URL(req.url).searchParams));
  if (!q.success) return fail('Invalid filters');
  // Field owners: only bookings for THEIR field(s), whatever filters they send.
  if (q.data.fieldId && !canAccessField(auth.user, q.data.fieldId)) return fail('Forbidden', 403);
  void maybeRunRetention();
  const bookings = (await getStore().listBookings(q.data)).filter((b) => canAccessField(auth.user, b.fieldId));
  return json({ bookings: bookings.map(toBookingView) });
});
