import { NextResponse, type NextRequest } from 'next/server';
import { CUSTOMER_COOKIE, SESSION_COOKIE } from './lib/auth/cookie';

/**
 * Runs before every page and API request (Edge runtime):
 *  1. Forces HTTPS in production.
 *  2. CSRF / CORS: rejects state-changing API requests from other origins.
 *  3. Redirects unauthenticated visitors away from /admin (the real session check
 *     happens again on the server inside every admin page and API route).
 *  4. Sets a strict, per-request nonce-based Content-Security-Policy.
 */

const isProd = process.env.NODE_ENV === 'production';
const SAFE_METHODS = new Set(['GET', 'HEAD']);

function allowedOrigins(req: NextRequest) {
  const set = new Set<string>([req.nextUrl.origin]);
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) set.add(site.replace(/\/$/, ''));
  if (!isProd) set.add('http://localhost:3000');
  return set;
}

function buildCsp(nonce: string, isLocal: boolean) {
  return [
    "default-src 'self'",
    // 'strict-dynamic' + nonce: only scripts Next.js renders (and scripts they load) can run.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${isProd ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'", // inline style attributes from animations; no script risk
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src 'self' https://challenges.cloudflare.com${isProd ? '' : ' ws: wss:'}`,
    'frame-src https://www.google.com https://maps.google.com https://challenges.cloudflare.com',
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isProd && !isLocal ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Force HTTPS (Vercel already does this; this covers other hosts behind a proxy).
  const host = req.nextUrl.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  if (isProd && !isLocal && req.headers.get('x-forwarded-proto') === 'http') {
    const url = req.nextUrl.clone();
    url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }

  // 2. CSRF + CORS for the API.
  if (pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin');
    if (req.method === 'OPTIONS') {
      // No CORS headers are ever granted: cross-origin browser calls are refused.
      return new NextResponse(null, { status: origin && !allowedOrigins(req).has(origin) ? 403 : 204 });
    }
    if (!SAFE_METHODS.has(req.method)) {
      const fetchSite = req.headers.get('sec-fetch-site');
      if ((origin && !allowedOrigins(req).has(origin)) || (!origin && fetchSite === 'cross-site')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  // 3. Admin pages: no session cookie → login page.
  const publicAdminPages = pathname === '/admin/login' || pathname === '/admin/setup';
  if (pathname.startsWith('/admin') && !publicAdminPages && !req.cookies.get(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Customer account pages: no customer cookie → customer login (real check happens in the page).
  if (pathname === '/account' && !req.cookies.get(CUSTOMER_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = '/account/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // 4. Nonce-based CSP. Next.js reads the nonce from the request header and applies it to its scripts.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, isLocal);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  if (pathname.startsWith('/admin') || pathname.startsWith('/booking') || pathname.startsWith('/account')) {
    res.headers.set('Cache-Control', 'no-store'); // never cache pages with personal data
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return res;
}

export const config = {
  matcher: [
    // Everything except static assets.
    { source: '/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)' },
  ],
};
