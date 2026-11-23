import { authenticateCustomer, setCustomerCookie, toPublicCustomer } from '@/lib/auth';
import { hashIp } from '@/lib/security/crypto';
import { clientIp, fail, json, limit, parseJson, route } from '@/lib/security/request';
import { customerLoginSchema } from '@/lib/validation';

/** POST /api/account/login — customer sign-in (rate limited, 5-strike lockout, generic errors). */
export const POST = route(async (req) => {
  const ip = clientIp(req);
  const limited = await limit(req, 'login', `customer:${ip}`);
  if (limited) return limited;
  const body = await parseJson(req, customerLoginSchema, 2_048, () => ({ code: 'INVALID' }));
  if (!body.ok) return fail('Invalid email or password', 401, { code: 'INVALID' });
  const r = await authenticateCustomer(body.data, hashIp(ip));
  if (!r.ok) return fail('Invalid email or password, or the account is temporarily locked.', 401, { code: 'INVALID' });
  const res = json({ customer: toPublicCustomer(r.customer) });
  setCustomerCookie(res, r.token);
  return res;
});
