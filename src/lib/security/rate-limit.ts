import 'server-only';
import { hasDatabase, query } from '../db/sql';
import { env } from '../env';

/**
 * Fixed-window rate limiter.
 * - With UPSTASH_REDIS_REST_URL/TOKEN set: shared across all server instances (recommended for production).
 * - Otherwise: in-memory per server process (fine for dev / a single server).
 */
export interface LimitResult {
  ok: boolean;
  remaining: number;
  resetSeconds: number;
}

export const LIMITS = {
  booking: { limit: 5, window: 600 }, // 5 booking attempts / 10 min / IP
  bookingDaily: { limit: 20, window: 86_400 },
  contact: { limit: 3, window: 600 },
  login: { limit: 10, window: 900 }, // + per-account lockout after 5 failures
  register: { limit: 5, window: 3600 }, // new customer accounts per IP per hour
  availability: { limit: 120, window: 60 },
  publicRead: { limit: 120, window: 60 },
  admin: { limit: 300, window: 60 },
  upload: { limit: 30, window: 600 },
} as const;
export type LimitName = keyof typeof LIMITS;

type Bucket = { count: number; reset: number };
const g = globalThis as unknown as { __hajziRl?: Map<string, Bucket>; __hajziRlSweep?: number };
const mem = (g.__hajziRl ??= new Map());

function memoryHit(key: string, limit: number, windowSec: number): LimitResult {
  const now = Date.now();
  if (!g.__hajziRlSweep || now - g.__hajziRlSweep > 60_000) {
    g.__hajziRlSweep = now;
    for (const [k, b] of mem) if (b.reset <= now) mem.delete(k);
  }
  let b = mem.get(key);
  if (!b || b.reset <= now) {
    b = { count: 0, reset: now + windowSec * 1000 };
    mem.set(key, b);
  }
  b.count++;
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), resetSeconds: Math.ceil((b.reset - now) / 1000) };
}

async function upstashHit(key: string, limit: number, windowSec: number): Promise<LimitResult> {
  const res = await fetch(`${env.upstashUrl}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.upstashToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, String(windowSec), 'NX'],
      ['TTL', key],
    ]),
    cache: 'no-store',
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const [incr, , ttl] = (await res.json()) as { result: number }[];
  const count = Number(incr.result);
  return { ok: count <= limit, remaining: Math.max(0, limit - count), resetSeconds: Math.max(1, Number(ttl.result)) };
}

async function postgresHit(key: string, limit: number, windowSec: number): Promise<LimitResult> {
  const rows = await query<{ hits: number; reset_seconds: number }>('select * from hajzi_rate_hit($1, $2)', [key, windowSec]);
  const count = Number(rows[0].hits);
  return { ok: count <= limit, remaining: Math.max(0, limit - count), resetSeconds: Number(rows[0].reset_seconds) };
}

/**
 * Shared across all server instances when Upstash or a database is configured (production);
 * in-memory otherwise (local dev).
 */
export async function rateLimit(name: LimitName, id: string): Promise<LimitResult> {
  const { limit, window } = LIMITS[name];
  const key = `hajzi:rl:${name}:${id}`;
  try {
    if (env.upstashUrl && env.upstashToken) return await upstashHit(key, limit, window);
    if (hasDatabase()) return await postgresHit(key, limit, window);
  } catch {
    // Shared store unreachable → degrade to local limiting rather than failing open.
  }
  return memoryHit(key, limit, window);
}

/** Test helper. */
export function _resetRateLimits() {
  mem.clear();
}
