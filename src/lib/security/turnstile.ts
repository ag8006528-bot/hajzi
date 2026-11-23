import 'server-only';
import { env } from '../env';
import { log } from '../logger';

/**
 * Verify a Cloudflare Turnstile token server-side.
 * Enforced whenever TURNSTILE_SECRET_KEY is set. Without it (local dev) the check is skipped,
 * and a config warning is logged in production (see env.checkEnv()).
 */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  if (!env.turnstileSecret) return true;
  if (!token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret: env.turnstileSecret, response: token, remoteip: ip });
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (!data.success) log('warn', 'turnstile_failed', { codes: data['error-codes']?.join(',') });
    return data.success === true;
  } catch {
    log('warn', 'turnstile_unreachable');
    return false; // fail closed
  }
}
