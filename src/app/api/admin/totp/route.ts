import { confirmTotp, disableTotp, getCurrentUser, startTotpSetup } from '@/lib/auth';
import { fail, json, limit, parseJson, route } from '@/lib/security/request';
import { generateTotpSecret, otpauthUri } from '@/lib/security/totp';
import { totpSchema } from '@/lib/validation';

/** POST /api/admin/totp — set up / enable / disable two-factor auth for the logged-in user. */
export const POST = route(async (req) => {
  const user = await getCurrentUser();
  if (!user) return fail('Unauthorized', 401);
  const limited = await limit(req, 'login', `totp:${user.id}`);
  if (limited) return limited;
  const body = await parseJson(req, totpSchema, 1_024);
  if (!body.ok) return body.res;

  switch (body.data.action) {
    case 'setup': {
      if (user.totpEnabled) return fail('Two-factor authentication is already enabled');
      const secret = generateTotpSecret();
      await startTotpSetup(user, secret);
      // The secret is shown once so it can be added to an authenticator app.
      return json({ secret, uri: otpauthUri(secret, user.email) });
    }
    case 'enable':
      return (await confirmTotp(user, body.data.code)) ? json({ ok: true }) : fail('Invalid code', 400);
    case 'disable':
      return (await disableTotp(user, body.data.password, body.data.code)) ? json({ ok: true }) : fail('Invalid password or code', 400);
  }
});
