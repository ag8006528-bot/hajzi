import 'server-only';
import { createHash } from 'crypto';

/**
 * Server-side configuration. Secrets live ONLY in environment variables
 * (never NEXT_PUBLIC_*, which would ship them to the browser). See .env.example.
 */
const isProd = process.env.NODE_ENV === 'production';
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

export const env = {
  isProd,
  /** Used to encrypt TOTP secrets and to salt hashed IPs in logs. REQUIRED in production. */
  authSecret: process.env.AUTH_SECRET || '',
  sessionMaxAgeHours: num(process.env.SESSION_MAX_AGE_HOURS, 8),
  /** Bootstrap the first admin when the user table is empty (bcrypt hash, never a plain password). */
  bootstrapAdminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  bootstrapAdminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
  /** One-time code that unlocks the "Create account" page. Empty = account creation disabled. */
  setupCode: process.env.ADMIN_SETUP_CODE || '',
  turnstileSecret: process.env.TURNSTILE_SECRET_KEY || '',
  upstashUrl: process.env.UPSTASH_REDIS_REST_URL || '',
  upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  retentionMonths: num(process.env.BOOKING_RETENTION_MONTHS, 12),
  maxBookingsPerPhonePerDay: num(process.env.MAX_BOOKINGS_PER_PHONE_PER_DAY, 2),
  maxActiveBookingsPerPhone: num(process.env.MAX_ACTIVE_BOOKINGS_PER_PHONE, 4),
  siteUrl: (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')
  ).replace(/\/$/, ''),
};

let warned = false;
/** Logs configuration problems once at first use (does not print secret values). */
export function checkEnv() {
  if (warned) return;
  warned = true;
  const problems: string[] = [];
  const db = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (isProd && env.authSecret.length < 32 && !db) problems.push('AUTH_SECRET is missing or shorter than 32 characters');
  if (isProd && !env.turnstileSecret) problems.push('TURNSTILE_SECRET_KEY is not set — bot protection is OFF');
  if (isProd && !env.upstashUrl && !db) problems.push('No database or Upstash configured — rate limits are per-instance only');
  if (isProd && process.env.VERCEL && !db)
    problems.push('No DATABASE_URL / POSTGRES_URL — on Vercel the JSON file store LOSES bookings. Connect a database before taking real bookings');
  for (const p of problems) console.warn(JSON.stringify({ level: 'warn', event: 'config_warning', message: p }));
}

/**
 * Key material for AES/HMAC.
 *  1. AUTH_SECRET if set (recommended).
 *  2. Otherwise, derived from the database connection string. It contains the database password (long,
 *     random, server-only), so the derived key is secret too. Note: changing the database password then
 *     logs everyone out and resets 2FA. Setting AUTH_SECRET avoids that.
 *  3. Fails closed in production when neither exists.
 */
export function getAuthSecret(): string {
  if (env.authSecret.length >= 32) return env.authSecret;
  const db = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (db) return createHash('sha256').update(`hajzi-auth-secret-v1:${db}`).digest('hex');
  if (isProd) throw new Error('AUTH_SECRET must be set (32+ chars) in production');
  return 'hajzi-dev-only-secret-not-for-production-use';
}
