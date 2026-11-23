import { registerCustomer, setCustomerCookie, toPublicCustomer } from '@/lib/auth';
import { hashIp } from '@/lib/security/crypto';
import { clientIp, fail, issueMap, json, limit, parseJson, route } from '@/lib/security/request';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { customerRegisterSchema } from '@/lib/validation';

/** POST /api/account/register — create a customer account and sign in. */
export const POST = route(async (req) => {
  const ip = clientIp(req);
  const limited = await limit(req, 'register', ip);
  if (limited) return limited;
  const body = await parseJson(req, customerRegisterSchema, 4_096, (e) => ({ code: 'INVALID', issues: issueMap(e) }));
  if (!body.ok) return body.res;
  if (body.data.website) return fail('Please check the form', 400, { code: 'INVALID' }); // honeypot
  if (!(await verifyTurnstile(body.data.turnstileToken, ip))) return fail('Captcha check failed', 400, { code: 'CAPTCHA' });

  const r = await registerCustomer(body.data, hashIp(ip));
  if (!r.ok) return fail('Account could not be created', r.reason === 'exists' ? 409 : 400, { code: r.reason });
  const res = json({ customer: toPublicCustomer(r.customer) }, 201);
  setCustomerCookie(res, r.token);
  return res;
});
