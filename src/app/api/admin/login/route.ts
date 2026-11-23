import { authenticate, setSessionCookie, toPublicUser } from '@/lib/auth';
import { hashIp } from '@/lib/security/crypto';
import { clientIp, fail, json, limit, parseJson, route } from '@/lib/security/request';
import { loginSchema } from '@/lib/validation';

/**
 * POST /api/admin/login { email, password, totp? }
 * - IP rate limit (10 / 15 min) + account lockout (5 failures → 15 min)
 * - One generic error for wrong email / wrong password / locked account (no account enumeration)
 */
export const POST = route(async (req) => {
  const ip = clientIp(req);
  const limited = await limit(req, 'login', ip);
  if (limited) return limited;
  const body = await parseJson(req, loginSchema, 2_048, () => ({}));
  if (!body.ok) return fail('Invalid email or password, or the account is temporarily locked.', 401, { code: 'INVALID' });

  const result = await authenticate(body.data, hashIp(ip));
  if (!result.ok) {
    if (result.reason === 'totp_required') return fail('Enter your 6-digit authentication code.', 401, { code: 'TOTP_REQUIRED' });
    return fail('Invalid email or password, or the account is temporarily locked.', 401, { code: 'INVALID' });
  }
  const res = json({ user: toPublicUser(result.user) });
  setSessionCookie(res, result.token);
  return res;
});
