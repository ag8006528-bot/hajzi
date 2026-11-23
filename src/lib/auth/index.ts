import 'server-only';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { cache } from 'react';
import { env } from '../env';
import { fail } from '../security/request';
import type { Customer, User } from '../types';
import { CUSTOMER_COOKIE, SESSION_COOKIE } from './cookie';
import { permissions, userFromSessionToken, type Permission } from './core';
import { CUSTOMER_SESSION_HOURS, customerFromSessionToken } from './customer';

export { CUSTOMER_COOKIE, SESSION_COOKIE };
export * from './core';
export * from './customer';

/** The logged-in user for this request (verified against the server-side session store). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? userFromSessionToken(token) : null;
});

/**
 * Use at the top of EVERY admin route handler:
 *   const auth = await requirePermission('manageFields'); if ('res' in auth) return auth.res;
 */
export async function requirePermission(p: Permission): Promise<{ user: User } | { res: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { res: fail('Unauthorized', 401) };
  if (!permissions[p](user.role)) return { res: fail('Forbidden', 403) };
  return { user };
}

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? '';
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, // not readable by JavaScript (XSS can't steal it)
    secure: env.isProd, // HTTPS only in production
    sameSite: 'strict', // never sent on cross-site requests (CSRF)
    path: '/',
    maxAge: env.sessionMaxAgeHours * 3600,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: env.isProd, sameSite: 'strict', path: '/', maxAge: 0 });
}

/* ───── Customer accounts ───── */

/** The signed-in customer for this request, or null. */
export const getCurrentCustomer = cache(async (): Promise<Customer | null> => {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  return token ? customerFromSessionToken(token) : null;
});

export async function getCustomerToken() {
  return (await cookies()).get(CUSTOMER_COOKIE)?.value ?? '';
}

export function setCustomerCookie(res: NextResponse, token: string) {
  res.cookies.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    // Lax (not Strict) so the account stays signed in when arriving from a link (e.g. WhatsApp).
    // Every state-changing API is still protected by the Origin check in middleware.
    sameSite: 'lax',
    path: '/',
    maxAge: CUSTOMER_SESSION_HOURS * 3600,
  });
}

export function clearCustomerCookie(res: NextResponse) {
  res.cookies.set(CUSTOMER_COOKIE, '', { httpOnly: true, secure: env.isProd, sameSite: 'lax', path: '/', maxAge: 0 });
}
