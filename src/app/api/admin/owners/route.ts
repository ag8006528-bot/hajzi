import { createOwnerAccount, disableOwner, requirePermission } from '@/lib/auth';
import { getStore } from '@/lib/db';
import { fail, json, limit, parseJson, route } from '@/lib/security/request';
import { ownerCreateSchema, uuidSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

async function guard(req: Request) {
  const auth = await requirePermission('manageOwners');
  if ('res' in auth) return auth;
  const limited = await limit(req, 'admin', auth.user.id);
  return limited ? { res: limited } : auth;
}

/** GET /api/admin/owners — admin only: active field-owner accounts. */
export const GET = route(async (req) => {
  const auth = await guard(req);
  if ('res' in auth) return auth.res;
  const owners = (await getStore().listUsers())
    .filter((u) => u.role === 'owner' && !u.disabled)
    .map((u) => ({ id: u.id, email: u.email, name: u.name, fieldIds: u.fieldIds ?? [], createdAt: u.createdAt, lastLoginAt: u.lastLoginAt ?? null }));
  return json({ owners });
});

/** POST /api/admin/owners { email, name, fieldIds } — admin only. Returns a one-time temporary password. */
export const POST = route(async (req) => {
  const auth = await guard(req);
  if ('res' in auth) return auth.res;
  const body = await parseJson(req, ownerCreateSchema);
  if (!body.ok) return body.res;
  const r = await createOwnerAccount(auth.user, body.data);
  if (!r.ok) return fail(r.reason === 'exists' ? 'An account with this email already exists' : 'Choose at least one field', r.reason === 'exists' ? 409 : 400, { code: r.reason });
  return json({ owner: { id: r.user.id, email: r.user.email, fieldIds: r.user.fieldIds }, tempPassword: r.tempPassword }, 201);
});

/** DELETE /api/admin/owners?id= — admin only: the owner can no longer log in. */
export const DELETE = route(async (req) => {
  const auth = await guard(req);
  if ('res' in auth) return auth.res;
  const id = uuidSchema.safeParse(new URL(req.url).searchParams.get('id'));
  if (!id.success || !(await disableOwner(auth.user, id.data))) return fail('Not found', 404);
  return json({ ok: true });
});
