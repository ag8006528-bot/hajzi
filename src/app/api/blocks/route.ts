import { requirePermission } from '@/lib/auth';
import { isWithinHours, SLOT_MINUTES } from '@/lib/booking';
import { getStore, SlotTakenError } from '@/lib/db';
import { audit } from '@/lib/logger';
import { fail, json, limit, parseJson, route } from '@/lib/security/request';
import { availabilityQuery, blockSchema, queryObject, uuidSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

async function guard(req: Request) {
  const auth = await requirePermission('manageBlocks');
  if ('res' in auth) return auth;
  const limited = await limit(req, 'admin', auth.user.id);
  return limited ? { res: limited } : auth;
}

/** Staff/admin: busy intervals including block ids. */
export const GET = route(async (req) => {
  const auth = await guard(req);
  if ('res' in auth) return auth.res;
  const q = availabilityQuery.safeParse(queryObject(new URL(req.url).searchParams));
  if (!q.success) return fail('fieldId and date are required');
  return json({ busy: await getStore().getBusy(q.data.fieldId, q.data.date) });
});

/** Staff/admin: mark a 1-hour slot unavailable. */
export const POST = route(async (req) => {
  const auth = await guard(req);
  if ('res' in auth) return auth.res;
  const body = await parseJson(req, blockSchema);
  if (!body.ok) return body.res;
  const { fieldId, date, startMinutes } = body.data;
  if (!isWithinHours(startMinutes, SLOT_MINUTES)) return fail('Invalid slot');
  const store = getStore();
  if (!(await store.getField(fieldId))) return fail('Not found', 404);
  try {
    const block = await store.addBlock(fieldId, date, startMinutes, SLOT_MINUTES);
    await audit(auth.user.email, 'slot_blocked', fieldId, { date, start: startMinutes });
    return json({ block }, 201);
  } catch (e) {
    if (e instanceof SlotTakenError) return fail('Slot already booked or blocked', 409);
    throw e;
  }
});

export const DELETE = route(async (req) => {
  const auth = await guard(req);
  if ('res' in auth) return auth.res;
  const id = uuidSchema.safeParse(new URL(req.url).searchParams.get('id'));
  if (!id.success) return fail('Not found', 404);
  const block = await getStore().removeBlock(id.data);
  if (!block) return fail('Not found', 404);
  await audit(auth.user.email, 'slot_unblocked', block.fieldId, { date: block.date, start: block.startMinutes });
  return json({ ok: true });
});
