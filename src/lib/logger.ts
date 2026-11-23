import 'server-only';
import { randomUUID } from 'crypto';
import { getStore } from './db';
import { scrubPII } from './security/sanitize';

type Level = 'info' | 'warn' | 'error';
const SENSITIVE_KEY = /pass|token|secret|otp|totp|code|cookie|authorization|session|hash/i;

/** Remove secrets and mask PII before anything is written to logs. */
function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[depth]';
  if (typeof value === 'string') return scrubPII(value).slice(0, 500);
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : scrub(v, depth + 1);
    return out;
  }
  return value;
}

/** Structured JSON logs (picked up by Vercel / any log drain). */
export function log(level: Level, event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...(scrub(data) as object) });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

/** Log an unexpected error without leaking stack traces to users. Hook Sentry in here (see SECURITY.md). */
export function logError(err: unknown, context: Record<string, unknown> = {}) {
  const e = err instanceof Error ? err : new Error(String(err));
  log('error', 'unhandled_error', {
    ...context,
    name: e.name,
    message: e.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : e.stack?.split('\n').slice(0, 6).join(' | '),
  });
}

/**
 * Persistent audit trail: who did what, when. Never pass passwords, tokens or full phone numbers.
 * Failures to write the audit log are logged but never break the user's request.
 */
export async function audit(actor: string, action: string, target?: string, details?: Record<string, string | number | boolean>) {
  const entry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    actor,
    action,
    target,
    details: details ? (scrub(details) as Record<string, string | number | boolean>) : undefined,
  };
  log('info', `audit:${action}`, { actor, target, details });
  try {
    await getStore().addAudit(entry);
  } catch (err) {
    logError(err, { where: 'audit' });
  }
}
