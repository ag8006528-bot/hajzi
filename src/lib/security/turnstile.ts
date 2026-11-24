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
    // A wrong/missing SECRET is OUR misconfiguration, not a bot. Don't lock every customer out over it:
    // behave as if Turnstile were not configured, and log loudly so it gets fixed.
    const reasons = data['error-codes'] ?? [];
    if (!data.success && reasons.some((r) => r === 'invalid-input-secret' || r === 'missing-input-secret')) {
      log('error', 'turnstile_misconfigured', { reasons: reasons.join(','), fix: 'TURNSTILE_SECRET_KEY is wrong; bot protection is OFF until it is corrected' });
      return true;
    }
    // Field named "reasons" (not "codes") so the PII/secret scrubber in the logger doesn't hide it.
    // e.g. "invalid-input-response" = bad/expired token (normal); "invalid-input-secret" = TURNSTILE_SECRET_KEY is wrong.
    if (!data.success) log('warn', 'turnstile_failed', { reasons: data['error-codes']?.join(',') });
    return data.success === true;
  } catch {
    log('warn', 'turnstile_unreachable');
    return false; // fail closed
  }
}
