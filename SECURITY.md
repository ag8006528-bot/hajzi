# HAJZI Security

This document describes how HAJZI protects customer data (names, phone numbers, bookings) and the admin area, what you need to configure, and how to report a vulnerability.

- [Reporting a vulnerability](#reporting-a-vulnerability)
- [Security measures](#security-measures)
- [Environment variables](#environment-variables)
- [Accounts, roles and 2FA](#accounts-roles-and-2fa)
- [Testing](#testing)
- [Deployment security checklist](#deployment-security-checklist)
- [Before / after summary](#before--after-summary)
- [Remaining risks and decisions needed](#remaining-risks-and-decisions-needed)

---

## Reporting a vulnerability

Please **do not** open a public issue. Email **security@hajzi.example** <!-- TODO: replace with a real, monitored address --> with:

- what you found and where (URL / endpoint),
- steps to reproduce,
- the impact you think it has.

We aim to acknowledge reports within **2 business days** and fix confirmed critical issues within **7 days**. Please give us reasonable time to fix an issue before disclosing it, and don't access or change other people's data while testing. Good-faith research is welcome.

---

## Security measures

### 1. Admin authentication & access control

| Measure | Where |
| --- | --- |
| Individual user accounts (no shared or default password). Created with `npm run user:create`, or bootstrapped once from `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (a bcrypt **hash**) | `scripts/create-user.ts`, `src/lib/auth/core.ts` |
| Passwords hashed with **bcrypt (cost 12)**; minimum 12 characters; common passwords refused | `src/lib/auth/core.ts` |
| Server-side sessions: a random 256-bit token in the cookie, **only its SHA-256 stored**. Logout deletes the session on the server; password reset revokes all sessions | `src/lib/auth/core.ts` |
| Cookie: `HttpOnly`, `Secure` (production), `SameSite=Strict`, `__Host-` prefix, 8 h expiry (`SESSION_MAX_AGE_HOURS`) | `src/lib/auth/index.ts` |
| **Lockout:** 5 failed attempts → account locked for 15 minutes (even the correct password is refused while locked) + IP rate limit of 10 logins / 15 min | `src/lib/auth/core.ts`, `api/admin/login` |
| No account enumeration: the same message for unknown email, wrong password and locked account; constant-time dummy bcrypt check for unknown emails | `src/lib/auth/core.ts` |
| **Optional TOTP 2FA** (RFC 6238; works with Google/Microsoft Authenticator, 1Password…). Secrets encrypted at rest with AES-256-GCM; codes can't be replayed | `src/lib/security/totp.ts`, `api/admin/totp`, Admin → Account |
| **Roles:** `admin` and `staff` (see matrix below) enforced **in every API route** with `requirePermission()`, not just in the UI | `src/lib/auth/index.ts` |
| Two layers on `/admin`: middleware redirects requests without a session cookie, and the page itself verifies the session in the store | `src/middleware.ts`, `src/app/admin/page.tsx` |

### 2. Input validation & injection protection

- **Zod schemas on the server for every input:** booking, contact, login, fields, blocks, status changes, 2FA, and all query parameters (`src/lib/validation.ts`). The same schemas give instant feedback in the browser.
- **Phones:** Jordan mobiles (`+962 77/78/79 XXX XXXX`, also `07…`, `00962…`) or international E.164; stored normalised (`+9627…`).
- **Lengths:** name ≤ 80, notes ≤ 500, contact message ≤ 2000, field texts capped; JSON bodies capped at 2–32 KB (`413` beyond that); `Content-Type: application/json` required (`415`).
- **XSS:** all free text goes through `cleanText()` (strips tags, stray `<`/`>`, `javascript:` URLs, control and bidi-override characters). React escapes all output. `dangerouslySetInnerHTML` is used once, for static JSON-LD built from the config file (never user input), with `<` escaped and a CSP nonce.
- **SQL injection:** no SQL is built anywhere today. The Supabase migration uses only parameterised functions and RLS.
- **Dates and slots:** checked on the server for a real calendar date (e.g. `2026-02-31` is rejected), not in the past (Asia/Amman time), at most 30 days ahead, on the hourly grid, inside opening hours, and an allowed duration.
- Admin image URLs must be `https://` or an uploaded `/api/uploads/<random>.webp`.

### 3. Booking integrity

- **Login required to book:** `POST /api/bookings` returns `401 LOGIN_REQUIRED` unless the request carries a valid **customer** session. The check runs on the server, so calling the API directly doesn't get around it. Staff/admin sessions, forged cookies and expired sessions are all refused. Every booking is linked to the account that made it (`customerId`), shows in that account's **My bookings**, and is audited as `customer:<id>`.
  - Guests can still browse fields and see free times. Instead of the booking form, the booking box shows **Log in to book** / **Create a free account**.
  - After login or sign-up the customer is sent back to the same field with the same date and time selected, via `?next=`. `next` only accepts `/fields/<id>` with an optional date and time (`src/lib/safe-next.ts`), so it can't be used as an open redirect to another site.
  - Bookings are rate limited **per account** as well as per IP: 5 per 10 min and 20 per day each.
- **No double booking:** the "is it free?" check and the insert run inside a lock: an in-process queue plus an atomic cross-process lock file (`src/lib/db/json-store.ts`). Tested with 20 simultaneous requests (exactly 1 succeeds). The Supabase schema adds a PostgreSQL **exclusion constraint** so overlaps are impossible at the database level.
- **Prices are computed only on the server** from the stored field price. Any `totalPrice` sent by a browser is discarded by Zod.
- **Unguessable references:** `HZ-` + 8 characters from a crypto RNG (~40 bits, non-sequential).
- **IDOR protection:** the confirmation page needs the reference **and** a secret 256-bit token that only the customer receives (in their confirmation link). Only the token's SHA-256 is stored, it's compared in constant time, and a wrong reference or token both show the same "not found" page. The page is `no-store`, `noindex` and `no-referrer`. Staff APIs never return the token hash.
- Restoring a cancelled booking can't double-book either.

### 4. Spam & abuse protection

| Limit (per IP unless noted) | Value |
| --- | --- |
| Booking attempts | 5 / 10 min and 20 / day |
| Contact form | 3 / 10 min |
| Login | 10 / 15 min (+ account lockout) |
| Availability / public reads | 120 / min |
| Staff/admin APIs | 300 / min per user |
| Uploads | 30 / 10 min per admin |
| Bookings per phone number | 2 per day, 4 upcoming in total (configurable) |

- Rate limits use Upstash Redis when configured (shared by all servers), otherwise memory (`src/lib/security/rate-limit.ts`).
- **Cloudflare Turnstile** on the booking and contact forms, verified server-side; enforced whenever `TURNSTILE_SECRET_KEY` is set.
- **Honeypot** field on both forms. Bookings that fill it are rejected; contact submissions get a fake "success".

### 5. Security headers & HTTPS

Set in `next.config.ts` and `src/middleware.ts`:

- `Content-Security-Policy`: a fresh **nonce** on every request with `'strict-dynamic'`. Allowed: own origin, Google Maps embed, Cloudflare Turnstile. Also `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests`.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (production)
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: camera, microphone, geolocation, payment, USB, sensors and topics all disabled
- `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy: same-origin`; `X-Powered-By` removed
- HTTP → HTTPS 308 redirect in production (Vercel also does this)
- Pages with personal data (`/admin`, `/booking`) are `Cache-Control: no-store` and `noindex`.

### 6. CSRF & API security

- `SameSite=Strict` session cookie.
- **Origin check in middleware** for every POST/PUT/PATCH/DELETE to `/api/*`: a foreign `Origin`, or `Sec-Fetch-Site: cross-site`, gets `403`.
- **CORS:** no `Access-Control-Allow-Origin` is ever sent, and cross-origin preflights get `403`.
- **Generic errors:** every route is wrapped by `route()`, which logs the details server-side and returns "Something went wrong" (no stack traces, paths or internals). Validation errors return translation keys only.

### 7. Secrets & configuration

- All secrets are environment variables (see below). `.env.example` contains placeholders only.
- `.gitignore` excludes `.env*` (except the example), `data/` (database + uploads), and key files.
- The only `NEXT_PUBLIC_*` variables are the site URL and the Turnstile **site** key, both public by design.
- Production fails closed: 2FA and IP hashing refuse to run without `AUTH_SECRET`, and missing protections are logged as config warnings at startup.
- Secret scan: no keys or passwords found in the code; the project wasn't a git repository yet, so there's no history to leak.

### 8. File uploads (admin field images)

- Admin only, max **5 MB**, rate limited.
- Type is detected from the **file's bytes** (JPEG / PNG / WebP magic numbers); the extension and declared MIME type are ignored.
- Every image is **re-encoded to WebP with sharp**. That removes all EXIF/GPS/camera metadata, neutralises polyglot files, applies orientation and caps dimensions at 2000 px and decompression at 40 MP.
- Saved under a **random 128-bit name**, outside `/public` (`data/uploads`). Served by `/api/uploads/<name>`, which only accepts `^[a-f0-9]{32}\.webp$` (no path traversal), with `nosniff` and a sandbox CSP.

### 9. Database security

- **Production: PostgreSQL / Supabase** (`DATABASE_URL`, schema `supabase/migrations/001_hajzi_schema.sql`):
  - Only the Next.js server connects, over TLS. The connection string lives only in server env vars.
  - **RLS is on for every table, with no policies or grants for `anon`/`authenticated`,** so Supabase's public REST API exposes nothing (tested).
  - Every query is parameterised.
  - Double booking is blocked by an exclusion constraint. Booking, restoring and blocking run in database functions with per-slot and per-phone advisory locks.
  - The price is computed inside the database. Field closing times and "call to book" are enforced there too.
  - Uploaded photos and rate-limit counters are stored in the database, so they're shared by every server instance.
- **Local development: JSON store**, written with `0600` permissions, atomic writes and a lock file, stored outside the web root.
- **Backups:** see the checklist. Supabase Pro has daily backups and point-in-time recovery; for the JSON store, back up `data/` daily.

### 10. Customer data privacy

- Only name, phone and booking details are collected (players and notes are optional).
- Phone numbers never appear on public pages, in availability responses, or on the confirmation page.
- **Staff lists show masked numbers** (`+962 79 *** 4521`); "Show" fetches the full number from a separate endpoint and **each reveal is written to the audit log**.
- `/privacy` page (EN/AR) explains what is collected, why, who sees it, retention, cookies and rights.
- **Retention:** bookings older than `BOOKING_RETENTION_MONTHS` (default 12) are anonymised automatically; audit logs and contact messages are deleted (`src/lib/retention.ts`).

### 11. Dependencies

- `npm audit`: **0 vulnerabilities**. Fixed postcss (high, bundled inside Next) with an npm `overrides` entry, and moved Zod to v4.6.7+ (a v3 memory-exhaustion advisory).
- No unused dependencies. Added: `zod`, `bcryptjs`, `sharp`, and `tsx` (dev, for tests/scripts).
- `.github/dependabot.yml` gives weekly grouped updates; `.github/workflows/security.yml` runs typecheck, tests and `npm audit` on every push.
- Next 16 is available but is a breaking upgrade; it's planned separately (Next 15.5.x is patched).

### 12. Logging & monitoring

- **Audit log** (Admin → Activity, admin only):
  - logins, failed logins (with reason and attempt number), lockouts and logouts
  - 2FA on/off
  - booking created / cancelled / restored
  - field created / updated / deleted, slots blocked / unblocked
  - image uploads, phone reveals, retention runs
- Each entry records **who, what, when** and a keyed hash of the IP (never the raw IP).
- Logs are structured JSON. A scrubber **redacts** keys like password/token/secret/cookie/code and **masks** phone numbers and emails inside any text (`src/lib/logger.ts`).
- Error monitoring: `logError()` is the single hook; see "Decisions" for Sentry.

### Customer accounts

- **Required to book a field** (see "Booking integrity"). Browsing and checking availability work without an account. Sign up at `/account/register`; the navbar **Login** button opens `/login`, where you choose **Customer** or **Staff**.
- **Fully separate from staff:** own table, own cookie (`hajzi_customer`, HttpOnly, Secure in production, SameSite=Lax, 30 days), and sessions marked `kind: 'customer'`. Staff checks reject these sessions, so a customer login can **never** open `/admin` or any staff API (unit-tested, and verified in the browser: 401).
- Same protections as staff: bcrypt-12, minimum 8 characters with common passwords refused, 5-strike lockout (15 min), generic errors. Plus a login rate limit, 5 sign-ups per IP per hour, honeypot and Turnstile on sign-up, and every write is Origin-checked.
- **My bookings** lists only bookings made while signed in to that account (linked by account id). Bookings are **never matched by phone number**, because phone numbers aren't verified and anyone could type someone else's.
- Signed-in customers get their name and phone filled in automatically when booking.

### Staff account creation page

`/admin/setup` creates an **admin** only with the one-time `ADMIN_SETUP_CODE` from the environment. The code is compared in constant time, shares the login rate limit, and stops working after one use. Leave the variable empty in production to switch the page off.

### Role matrix

| Action | staff | admin |
| --- | :-: | :-: |
| View bookings (masked phones), reveal a phone (audited) | ✅ | ✅ |
| Cancel / restore bookings, block / unblock slots | ✅ | ✅ |
| Read contact messages | ✅ | ✅ |
| Add / edit / delete fields, upload images | ❌ 403 | ✅ |
| Read the audit log | ❌ 403 | ✅ |
| Manage own 2FA | ✅ | ✅ |

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Public URL (SEO and the CSRF origin allow-list) |
| `DATABASE_URL` | ✅ prod | PostgreSQL connection (Supabase transaction pooler). Data, photos and rate limits. See [DEPLOY.md](DEPLOY.md) |
| `AUTH_SECRET` | ✅ prod | 32+ random chars. Encrypts 2FA secrets and keys IP hashes. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` | optional | Creates the first admin when no users exist. **Hash only:** `npm run user:create -- --hash-only` |
| `SESSION_MAX_AGE_HOURS` | optional | Default 8 |
| `ADMIN_SETUP_CODE` | optional | One-time code for the `/admin/setup` "Create account" page. Leave empty to disable the page |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | ✅ prod | Cloudflare Turnstile |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | optional | Shared rate limits via Redis (not needed with `DATABASE_URL`) |
| `MAX_BOOKINGS_PER_PHONE_PER_DAY`, `MAX_ACTIVE_BOOKINGS_PER_PHONE` | optional | Defaults 2 / 4 |
| `BOOKING_RETENTION_MONTHS` | optional | Default 12 |
| `HAJZI_DATA_FILE`, `HAJZI_UPLOAD_DIR` | local only | Storage paths for the JSON store (when `DATABASE_URL` is empty) |

---

## Accounts, roles and 2FA

```bash
npm run user:create -- --email owner@yourdomain.jo --role admin --name "Owner"
npm run user:create -- --email desk@yourdomain.jo --role staff
npm run user:create -- --unlock owner@yourdomain.jo         # clear a lockout
npm run user:create -- --reset-password owner@yourdomain.jo # also logs out all sessions
npm run user:create -- --hash-only                          # bcrypt hash for ADMIN_PASSWORD_HASH
```

Passwords are typed hidden (or passed via `HAJZI_NEW_PASSWORD`). Then log in at `/admin` → **Account** → **Set up 2FA**. **All admin accounts should enable 2FA.**

---

## Testing

```bash
npm test                 # 30 unit tests: validation/XSS, phone rules, double booking (20 concurrent), IDOR tokens,
                         # price integrity, per-phone limits, bcrypt, lockout, 2FA + replay, sessions, roles, rate limits, retention
npm run build && npm start
npm run test:security    # 16 end-to-end tests against the running server (BASE_URL, default http://localhost:3000)
```

The end-to-end suite covers:

- **Headers:** CSP nonce matches the page, XFO, nosniff, Referrer-Policy, Permissions-Policy.
- **Access control:** `/admin` without a session or with a forged cookie; 401 on every admin API; staff get 403 on admin actions; session cookie flags.
- **CSRF/CORS:** foreign Origin, cross-site fetch and preflight are blocked.
- **Booking:** price tampering ignored; XSS stripped; IDOR (reference without token, or wrong token, shows nothing); SQL-injection strings stay inert; concurrent double booking (one 201, one 409); availability exposes no PII.
- **Errors and bots:** generic errors only; honeypot works.
- **Rate limits:** booking, contact and login.
- **Uploads:** fake `.jpg` rejected, EXIF removed, random names, path traversal blocked.

It needs test accounts whose credentials are in `.env.local` (`HAJZI_TEST_*`).

> ⚠️ **Never expose `npm run dev` to the internet.** React's development mode embeds debugging data, including results of server I/O, in the page. During testing it put raw database content into a dev page. Production builds strip this; the IDOR suite passes against `npm start`.

**Check headers after deployment:** open <https://securityheaders.com>, enter your domain (tick "Hide results" if you prefer) and aim for an **A or A+**. Also try <https://observatory.mozilla.org>. Once HTTPS and HSTS have been stable for a few weeks, submit the domain at <https://hstspreload.org>.

---

## Deployment security checklist

**Vercel project**
- [ ] Set every variable from the table above in **Settings → Environment Variables** (Production only for secrets; don't reuse local values).
- [ ] Generate a new `AUTH_SECRET` for production.
- [ ] Turn on **Deployment Protection** for Preview deployments, so previews aren't public.
- [ ] Turn on **Vercel Firewall / Attack Challenge Mode** if you see abuse; consider WAF rules that rate-limit `/api/bookings`.
- [ ] Turn on 2FA on the Vercel, GitHub, Cloudflare, Upstash and Supabase accounts themselves.

**Domain & HTTPS**
- [ ] Add the custom domain and redirect `www` ↔ apex. Vercel issues TLS certificates automatically.
- [ ] Confirm `http://` redirects to `https://` and HSTS is present (securityheaders.com).
- [ ] Optional: DNS CAA record allowing only Vercel's CA (Let's Encrypt).

**Data**
- [ ] **Connect a real database before taking real bookings** (Supabase migration provided). The JSON store on Vercel is temporary and per-instance.
- [ ] Database backups: Supabase Pro has daily backups and point-in-time recovery. Do a restore test once.
- [ ] Use the Supabase **service role key server-side only** (never `NEXT_PUBLIC_`).

**Abuse protection**
- [ ] Create a Turnstile widget for your domain and set both keys.
- [ ] Create an Upstash Redis database and set the REST URL/token.

**Accounts**
- [ ] Create real admin/staff accounts with `user:create` (or the `ADMIN_PASSWORD_HASH` bootstrap), then remove the bootstrap variables.
- [ ] Every admin enables 2FA. Delete the local test accounts (`admin@hajzi.test`, `staff@hajzi.test`); they only exist in your local `data/db.json`.

**Ongoing**
- [ ] Set a real `security@` address in this file.
- [ ] Merge Dependabot PRs regularly; check the GitHub Action stays green.
- [ ] Review Admin → Activity weekly for failed logins and phone reveals.

---

## Before / after summary

| Area | Before | After |
| --- | --- | --- |
| Admin login | One shared password with a **hardcoded default** (`hajzi-admin`) and a default secret | Per-user accounts, bcrypt-12, no defaults, CLI/bootstrap creation |
| Sessions | Deterministic HMAC of the password: never expires on the server, can't be revoked, `SameSite=Lax` | Random 256-bit token, hashed server-side session, revocable, `HttpOnly`/`Secure`/`SameSite=Strict`/`__Host-`, 8 h |
| Brute force | 400 ms delay only | 5-strike lockout (15 min) + IP rate limit + generic errors + optional TOTP 2FA |
| Roles | None | admin / staff, enforced in every API route |
| Confirmation page | **Anyone with a guessable 6-char `Math.random` reference** saw the customer's name and booking | 40-bit crypto reference **+ 256-bit secret token**, hashed and constant-time compared |
| Double booking | In-process lock only (broken across instances) | In-process + cross-process lock, Postgres exclusion constraint in the migration |
| Who can book | Anyone, anonymously | Only logged-in customers (server-enforced), per-account rate limits, safe return-to-field after login |
| Price | Server-computed (OK) | Unchanged, plus client fields explicitly stripped and tested |
| Validation | Hand-written, partial | Zod everywhere (bodies + query params), sanitised text, size and content-type limits, real-date check |
| Abuse | Nothing | Rate limits on all APIs, Turnstile, honeypot, per-phone caps |
| Headers | None | Nonce CSP, HSTS, XFO, nosniff, Referrer/Permissions-Policy, COOP/CORP, HTTPS redirect |
| CSRF/CORS | Lax cookie only | Strict cookie + Origin/Sec-Fetch-Site checks + no CORS grants |
| Errors | Some raw `throw` paths | Central wrapper, generic messages, details logged server-side only |
| Staff view of phones | Full numbers, no record of access | Masked; reveal-on-click, audited |
| Logs | Contact route logged full phone/email/message | Scrubbed structured logs + persistent audit trail |
| Contact form | Messages only logged (lost) | Stored for staff (Messages tab), retention applied |
| Uploads | Not available (any image URL allowed, incl. `http:`) | Validated, re-encoded, EXIF-stripped, random names, served safely; https-only URLs |
| Privacy | No policy, kept forever | `/privacy` page (EN/AR), auto-anonymisation after 12 months |
| Dependencies | 1 high (postcss), no update process | 0 vulnerabilities, Dependabot, CI audit |
| Tests | None | 40 unit + 19 end-to-end security tests |

---

## Remaining risks and decisions needed

1. **Database (critical before launch, needs your decision).** The JSON store is fine for a single server, but on Vercel it's temporary and per-instance (bookings can be lost, and double booking becomes possible across instances). **Recommended: Supabase** (free tier to start; Pro ≈ $25/month for daily backups and PITR). The schema with RLS is ready in `supabase/migrations/001_schema_rls.sql`; wiring the `DataStore` to it is the next step.
2. **Staff auth provider.** Accounts are built in (bcrypt, lockout, TOTP). With Supabase you could move staff to **Supabase Auth** (MFA, password reset emails, audit) instead. Decide when choosing the database.
3. **Turnstile** (free) and **Upstash Redis** (free tier). Accounts are needed under your name; without them, bot protection is off and rate limits aren't shared between Vercel instances.
4. **Error monitoring (Sentry).** Not installed: it needs your account/DSN, and the free tier is enough. Add `@sentry/nextjs` and call it from `logError()` in `src/lib/logger.ts` with `sendDefaultPii: false` and a `beforeSend` that reuses the existing scrubber.
5. **Password reset by email** doesn't exist yet (admins reset via the CLI). That needs an email provider (e.g. Resend), or comes free with Supabase Auth.
6. **Next.js 16 upgrade.** 15.5.x is patched today; plan the major upgrade (middleware → "proxy" rename) as a separate task.
7. **Customer self-service** (cancel via the secret link) isn't built. Customers call or WhatsApp to cancel, which avoids extra attack surface for now.
8. **`style-src 'unsafe-inline'`** remains in the CSP because the animation library sets inline styles. The risk is low (scripts are nonce-locked); removing it would require replacing Framer Motion.
9. **Self-hosting note:** rate limits trust `X-Forwarded-For` / `X-Real-IP`. Vercel and Cloudflare set these correctly; behind your own nginx, make it **overwrite** these headers.
