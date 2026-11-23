import { clearSessionCookie, destroySession, getCurrentUser, getSessionToken } from '@/lib/auth';
import { audit } from '@/lib/logger';
import { json, route } from '@/lib/security/request';

/** POST /api/admin/logout — deletes the server-side session (not just the cookie). */
export const POST = route(async () => {
  const user = await getCurrentUser();
  await destroySession(await getSessionToken());
  if (user) await audit(user.email, 'logout', user.email);
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
});
