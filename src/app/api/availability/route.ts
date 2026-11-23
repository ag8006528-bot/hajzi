import { getStore } from '@/lib/db';
import { fail, json, limit, route } from '@/lib/security/request';
import { availabilityQuery, queryObject } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** GET /api/availability?fieldId=...&date=YYYY-MM-DD → occupied intervals only (never customer data). */
export const GET = route(async (req) => {
  const limited = await limit(req, 'availability');
  if (limited) return limited;
  const q = availabilityQuery.safeParse(queryObject(new URL(req.url).searchParams));
  if (!q.success) return fail('fieldId and a valid date are required');
  const store = getStore();
  if (!(await store.getField(q.data.fieldId))) return fail('Not found', 404);
  const busy = (await store.getBusy(q.data.fieldId, q.data.date)).map(({ start, duration, kind }) => ({ start, duration, kind }));
  return json({ fieldId: q.data.fieldId, date: q.data.date, busy });
});
