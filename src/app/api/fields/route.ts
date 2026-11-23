import { requirePermission } from '@/lib/auth';
import { getStore } from '@/lib/db';
import { audit } from '@/lib/logger';
import { json, limit, parseJson, route } from '@/lib/security/request';
import { fieldSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const limited = await limit(req, 'publicRead');
  if (limited) return limited;
  return json({ fields: await getStore().listFields() });
});

/** POST /api/fields — admin only. */
export const POST = route(async (req) => {
  const auth = await requirePermission('manageFields');
  if ('res' in auth) return auth.res;
  const limited = await limit(req, 'admin', auth.user.id);
  if (limited) return limited;
  const body = await parseJson(req, fieldSchema, 32_768);
  if (!body.ok) return body.res;
  const field = await getStore().createField(body.data);
  await audit(auth.user.email, 'field_created', field.id, { type: field.type, price: field.pricePerHour });
  return json({ field }, 201);
});
