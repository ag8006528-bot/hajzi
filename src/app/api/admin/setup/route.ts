import { createAccountWithSetupCode } from '@/lib/auth';
import { hashIp } from '@/lib/security/crypto';
import { clientIp, fail, json, limit, parseJson, route } from '@/lib/security/request';
import { setupSchema } from '@/lib/validation';

const STATUS: Record<string, number> = { disabled: 403, invalid_code: 403, used_code: 403, exists: 409, short: 400, weak: 400 };

/**
 * POST /api/admin/setup { email, password, code } — create an admin account with the one-time setup code.
 * Shares the login rate limit (10 / 15 min per IP) so the code can't be brute-forced.
 */
export const POST = route(async (req) => {
  const ip = clientIp(req);
  const limited = await limit(req, 'login', ip);
  if (limited) return limited;
  const body = await parseJson(req, setupSchema, 2_048);
  if (!body.ok) return fail('Please check the form', 400, { code: 'INVALID' });
  const r = await createAccountWithSetupCode(body.data, hashIp(ip));
  if (!r.ok) return fail('Account could not be created', STATUS[r.reason] ?? 400, { code: r.reason });
  return json({ ok: true }, 201);
});
