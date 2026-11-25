import { changeOwnPassword, getCurrentUser } from '@/lib/auth';
import { fail, json, limit, parseJson, route } from '@/lib/security/request';
import { passwordChangeSchema } from '@/lib/validation';

/** POST /api/admin/password { current, next } — any signed-in staff user changes their own password. */
export const POST = route(async (req) => {
  const user = await getCurrentUser();
  if (!user) return fail('Unauthorized', 401);
  const limited = await limit(req, 'login', `pw:${user.id}`);
  if (limited) return limited;
  const body = await parseJson(req, passwordChangeSchema);
  if (!body.ok) return body.res;
  const r = await changeOwnPassword(user, body.data.current, body.data.next);
  if (!r.ok) return fail('Password not changed', 400, { code: r.reason });
  return json({ ok: true });
});
