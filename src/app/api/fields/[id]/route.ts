import { requirePermission } from '@/lib/auth';
import { getStore } from '@/lib/db';
import { audit } from '@/lib/logger';
import { fail, json, limit, parseJson, route } from '@/lib/security/request';
import { fieldSchema, idSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

const parseId = async (params: Ctx['params']) => idSchema.safeParse((await params).id);

export const GET = route<Ctx>(async (req, { params }) => {
  const limited = await limit(req, 'publicRead');
  if (limited) return limited;
  const id = await parseId(params);
  const field = id.success ? await getStore().getField(id.data) : null;
  return field ? json({ field }) : fail('Not found', 404);
});

/** PUT /api/fields/:id — admin only (staff get 403). */
export const PUT = route<Ctx>(async (req, { params }) => {
  const auth = await requirePermission('manageFields');
  if ('res' in auth) return auth.res;
  const limited = await limit(req, 'admin', auth.user.id);
  if (limited) return limited;
  const id = await parseId(params);
  if (!id.success) return fail('Not found', 404);
  const body = await parseJson(req, fieldSchema, 32_768);
  if (!body.ok) return body.res;
  const field = await getStore().updateField(id.data, body.data);
  if (!field) return fail('Not found', 404);
  await audit(auth.user.email, 'field_updated', field.id, { type: field.type, price: field.pricePerHour });
  return json({ field });
});

/** DELETE /api/fields/:id — admin only (staff get 403). */
export const DELETE = route<Ctx>(async (req, { params }) => {
  const auth = await requirePermission('manageFields');
  if ('res' in auth) return auth.res;
  const limited = await limit(req, 'admin', auth.user.id);
  if (limited) return limited;
  const id = await parseId(params);
  if (!id.success) return fail('Not found', 404);
  const ok = await getStore().deleteField(id.data);
  if (!ok) return fail('Not found', 404);
  await audit(auth.user.email, 'field_deleted', id.data);
  return json({ ok: true });
});
