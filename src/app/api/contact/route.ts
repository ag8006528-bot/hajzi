import { randomUUID } from 'crypto';
import { getStore } from '@/lib/db';
import { log } from '@/lib/logger';
import { hashIp } from '@/lib/security/crypto';
import { clientIp, fail, json, limit, parseJson, route } from '@/lib/security/request';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { contactSchema } from '@/lib/validation';

/** POST /api/contact — stores the message for staff (visible in /admin → Messages). */
export const POST = route(async (req) => {
  const ip = clientIp(req);
  const limited = await limit(req, 'contact', ip);
  if (limited) return limited;
  const body = await parseJson(req, contactSchema, 8_192);
  if (!body.ok) return body.res;
  const { name, contact, message, website, turnstileToken } = body.data;

  // Honeypot: pretend success so bots don't learn they were caught.
  if (website) {
    log('warn', 'honeypot_triggered', { route: 'contact', ip: hashIp(ip) });
    return json({ ok: true });
  }
  if (!(await verifyTurnstile(turnstileToken, ip))) return fail('Captcha check failed', 400, { code: 'CAPTCHA' });

  await getStore().addMessage({ id: randomUUID(), name, contact, message, createdAt: new Date().toISOString() });
  log('info', 'contact_message_received', { ip: hashIp(ip), length: message.length }); // no PII in logs
  return json({ ok: true });
});
