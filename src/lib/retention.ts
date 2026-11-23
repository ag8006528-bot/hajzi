import 'server-only';
import { addDays, todayISO } from './booking';
import { getStore } from './db';
import { env } from './env';
import { audit, logError } from './logger';
import { maskPhone } from './security/sanitize';
import type { Booking, BookingView } from './types';

const g = globalThis as unknown as { __hajziRetentionAt?: number };

/**
 * Privacy: anonymise bookings and delete audit logs / messages older than
 * BOOKING_RETENTION_MONTHS (default 12). Runs at most once a day per server, triggered by traffic.
 * For a database, schedule the equivalent SQL job instead (see supabase/migrations).
 */
export async function maybeRunRetention() {
  const now = Date.now();
  if (g.__hajziRetentionAt && now - g.__hajziRetentionAt < 86_400_000) return;
  g.__hajziRetentionAt = now;
  try {
    const cutoff = addDays(todayISO(), -Math.round(env.retentionMonths * 30.44));
    const r = await getStore().runRetention(cutoff);
    if (r.bookings || r.audit || r.messages) await audit('system', 'retention_run', cutoff, r);
  } catch (err) {
    logError(err, { where: 'retention' });
  }
}

/** Admin/staff view of a booking: no token hash, phone masked unless explicitly revealed. */
export function toBookingView(b: Booking): BookingView {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { accessTokenHash, ...rest } = b;
  return { ...rest, phone: maskPhone(b.phone) };
}
