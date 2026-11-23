import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { checkEnv } from '../env';
import { logError } from '../logger';
import { rateLimit, type LimitName } from './rate-limit';

const NO_STORE = { 'Cache-Control': 'no-store' };

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(data, { status, headers: { ...NO_STORE, ...headers } });

/** Generic, user-safe error. Internal details are only ever logged server-side. */
export const fail = (message: string, status = 400, extra: Record<string, unknown> = {}) => json({ error: message, ...extra }, status);

/**
 * Client IP. On Vercel / Cloudflare the first X-Forwarded-For entry is set by the edge network.
 * If you self-host behind your own proxy, make sure it overwrites (not appends to) X-Forwarded-For.
 */
export function clientIp(req: Request) {
  const h = req.headers;
  return (
    h.get('cf-connecting-ip') ||
    h.get('x-real-ip') ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  ).slice(0, 64);
}

export async function limit(req: Request, name: LimitName, id = clientIp(req)) {
  const r = await rateLimit(name, id);
  if (r.ok) return null;
  return fail('Too many requests. Please try again later.', 429, { code: 'RATE_LIMITED', retryAfter: r.resetSeconds });
}

/** Parse + validate a JSON body with size and content-type limits. */
export async function parseJson<S extends z.ZodType>(
  req: Request,
  schema: S,
  maxBytes = 16_384,
  mapError: (e: z.ZodError) => Record<string, unknown> = (e) => ({ issues: issueMap(e) }),
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; res: NextResponse }> {
  const type = req.headers.get('content-type') || '';
  if (!type.toLowerCase().startsWith('application/json')) return { ok: false, res: fail('Unsupported content type', 415) };
  const len = Number(req.headers.get('content-length') || 0);
  if (len > maxBytes) return { ok: false, res: fail('Request too large', 413) };
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, res: fail('Invalid request') };
  }
  if (text.length > maxBytes) return { ok: false, res: fail('Request too large', 413) };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, res: fail('Invalid JSON') };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, res: fail('Validation failed', 400, mapError(parsed.error)) };
  return { ok: true, data: parsed.data };
}

/** { fieldName: firstMessage } — messages are translation keys, never internals. */
export function issueMap(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = String(i.path[0] ?? '_');
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wrap a route handler: config check, and no stack traces / internal errors ever reach the client. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    checkEnv();
    try {
      return await handler(req, ctx);
    } catch (err) {
      logError(err, { method: req.method, path: new URL(req.url).pathname });
      return fail('Something went wrong. Please try again.', 500);
    }
  };
}
