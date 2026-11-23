import { clearCustomerCookie, destroySession, getCustomerToken } from '@/lib/auth';
import { json, route } from '@/lib/security/request';

/** POST /api/account/logout — ends the customer session on the server. */
export const POST = route(async () => {
  await destroySession(await getCustomerToken());
  const res = json({ ok: true });
  clearCustomerCookie(res);
  return res;
});
