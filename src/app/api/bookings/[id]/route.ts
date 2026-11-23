import { requirePermission } from '@/lib/auth';
import { getStore, SlotTakenError } from '@/lib/db';
import { audit } from '@/lib/logger';
import { toBookingView } from '@/lib/retention';
import { fail, json, limit, parseJson, route } from '@/lib/security/request';
import { statusSchema, uuidSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/bookings/:id { status } — staff/admin only. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const auth = await requirePermission('manageBookings');
  if ('res' in auth) return auth.res;
  const limited = await limit(req, 'admin', auth.user.id);
  if (limited) return limited;
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return fail('Not found', 404);
  const body = await parseJson(req, statusSchema);
  if (!body.ok) return body.res;
  try {
    const updated = await getStore().setBookingStatus(id.data, body.data.status);
    if (!updated) return fail('Not found', 404);
    await audit(auth.user.email, body.data.status === 'cancelled' ? 'booking_cancelled' : 'booking_restored', updated.ref);
    return json({ booking: toBookingView(updated) });
  } catch (e) {
    if (e instanceof SlotTakenError) return fail('That time slot has been taken since this booking was cancelled', 409);
    throw e;
  }
});
