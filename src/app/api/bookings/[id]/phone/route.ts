import { requirePermission } from '@/lib/auth';
import { getStore } from '@/lib/db';
import { audit } from '@/lib/logger';
import { fail, json, limit, route } from '@/lib/security/request';
import { uuidSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/bookings/:id/phone — reveal a customer's full number (staff/admin). Every reveal is audited. */
export const GET = route<Ctx>(async (req, { params }) => {
  const auth = await requirePermission('viewBookings');
  if ('res' in auth) return auth.res;
  const limited = await limit(req, 'admin', auth.user.id);
  if (limited) return limited;
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return fail('Not found', 404);
  const b = await getStore().getBookingById(id.data);
  if (!b || !b.phone) return fail('Not found', 404);
  await audit(auth.user.email, 'phone_revealed', b.ref);
  return json({ phone: b.phone });
});
