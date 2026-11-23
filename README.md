# HAJZI — Football Field Reservations

HAJZI is a mobile-first, bilingual (English / العربية) site for booking football fields. Customers browse 5v5 and 11v11 pitches, see live availability, and reserve a time slot in seconds. Admins manage bookings, fields and blocked slots from `/admin`.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Framer Motion · JSON-file data layer (swappable for Supabase/PostgreSQL)

---

## Quick start

Requires **Node.js 20.9+**.

```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm run user:create -- --email you@example.com --role admin   # create your admin login (password typed hidden)
npm run dev
```

Open http://localhost:3000. Security details, all environment variables and the deployment checklist are in **[SECURITY.md](SECURITY.md)**.

| URL | Page |
| --- | --- |
| `/` | Home: hero, quick search, featured fields, how it works |
| `/fields` | All fields with filters (type, location, price). Accepts `?type=5v5&date=2026-11-23&time=19:00` |
| `/fields/[id]` | Field details, gallery, map, call/WhatsApp, booking widget |
| `/booking/[ref]?t=…` | Booking confirmation; only opens with the customer's secret link |
| `/contact` | Phone, WhatsApp, email, map, hours, contact form |
| `/privacy` | Privacy policy (EN/AR) |
| `/admin` | Staff dashboard (log in with an account from `npm run user:create`; there is no default password) |

Other scripts:

```bash
npm run build          # production build
npm start              # run the production build
npm run typecheck      # TypeScript only
npm test               # unit tests (validation, double booking, auth, 2FA, rate limits…)
npm run test:security  # end-to-end security tests against a running server
npm run user:create    # manage staff accounts (see SECURITY.md)
npm run audit          # dependency vulnerability check
```

---

## Folder structure

```
src/
├── app/                        # Routes (Next.js App Router)
│   ├── layout.tsx              # Fonts, <html lang/dir>, navbar, footer, default SEO
│   ├── page.tsx                # Home
│   ├── fields/page.tsx         # Fields listing
│   ├── fields/[id]/page.tsx    # Field details + booking
│   ├── booking/[ref]/page.tsx  # Confirmation
│   ├── contact/page.tsx
│   ├── admin/page.tsx          # Dashboard (protected)
│   ├── admin/login/page.tsx
│   ├── api/                    # REST endpoints (see "API" below)
│   ├── icon.svg                # Favicon
│   ├── opengraph-image.tsx     # Auto-generated social share image
│   ├── sitemap.ts, robots.ts
│   └── globals.css             # Tailwind + pitch theme (grass stripes, buttons, inputs)
├── components/
│   ├── layout/                 # Navbar (+ language toggle), Footer, Logo
│   ├── home/                   # Hero, SearchBar, FeaturedFields, HowItWorks
│   ├── fields/                 # FieldCard, TypeBadge, FieldsBrowser, Gallery, FieldArt, MapEmbed, FieldDetails
│   ├── booking/                # BookingWidget, Confirmation
│   ├── contact/                # ContactView (+ form)
│   ├── admin/                  # AdminDashboard, BookingsTab, FieldsTab, FieldForm, AvailabilityTab, LoginForm
│   └── ui/                     # Icons, FormField, FadeIn, pitch-line decorations
├── config/business.ts          # ⭐ Business details, hours, prices
├── data/seed.ts                # ⭐ The 4 sample fields
└── lib/
    ├── types.ts                # Field, Booking, Block types
    ├── booking.ts              # Slots, price calc, overlap check, Amman time zone helpers
    ├── validation.ts           # Phone, booking and field validation (client + server)
    ├── auth.ts                 # Placeholder admin auth (signed cookie)
    ├── db/                     # DataStore interface + JSON-file implementation
    └── i18n/                   # en.ts, ar.ts dictionaries, LanguageProvider
data/db.json                    # Created automatically on first run (gitignored)
```

---

## Changing business details, prices and fields

### Business details: `src/config/business.ts`

Everything customer-facing lives in one file. Values marked `TODO` are **placeholders** that need replacing:

| Setting | What it controls |
| --- | --- |
| `address` (en/ar) | Footer, contact page |
| `coordinates` | Contact page map + "Open in Google Maps" |
| `phone` | Click-to-call links (`tel:`) |
| `whatsapp` | WhatsApp links. Digits only, international format, e.g. `962791234567` |
| `email` | Footer, contact page |
| `hours.openMinutes` / `closeMinutes` | Which time slots can be booked. Minutes from midnight; values above 1440 mean after midnight (`26 * 60` = 2:00 AM) |
| `hours.label` | Text shown for working hours |
| `prices['5v5']`, `prices['11v11']` | Default JOD price per hour for new fields |
| `durations` | Booking lengths offered (minutes) |
| `maxDaysAhead` | How far ahead people can book |
| `social` | Instagram / Facebook / TikTok links |

To find coordinates, right-click the location in Google Maps and click the numbers to copy them.

### Fields

- **Easiest:** log in at `/admin` → **Fields** tab → add, edit or delete fields (name EN/AR, type 5v5/11v11, area, address, coordinates, price, phone, WhatsApp, size, surface, lighting, amenities, image URLs, featured flag).
- **Real listings (default seed):** `src/data/seed.ts` holds 25 **real** Amman football fields taken from public Google Maps listings (name, phone, map location, opening hours), with neighbourhoods checked against OpenStreetMap. None of them has joined HAJZI yet, so they are **call-to-book**: the page shows Call / WhatsApp instead of the booking widget, the price shows "Call for price", and the server refuses online bookings for them (`409 CALL_TO_BOOK`). Size and surface show "Ask the field" because no reliable public source states them, and they have no photos because the venues' own photos are copyrighted.
- **When a field joins:** Admin → **Fields** → ✏️: set the price, size, surface and photos, and tick **Takes online bookings**.
- **Fictional demo fields:** `src/data/demo-fields.ts` holds 4 invented, bookable fields with Unsplash photos. The unit tests use them, and so does any database created with `HAJZI_SEED=demo`.
- Run `npm run demo:reset-fields` to replace the fields in the database with the seed (users, customers and bookings are kept). Add `HAJZI_SEED=demo` to load the fictional ones instead.

### Photos

The fictional demo fields use free-licence photos from Unsplash, stored in `public/fields/` (credits in [public/fields/CREDITS.md](public/fields/CREDITS.md)). To add photos, log in as admin → **Fields** → ✏️ → **Upload image**. Only upload photos you own or have permission to use. Uploads are checked, resized and stripped of location data automatically. Fields without photos show built-in illustrated pitches.

### Text & translations

All UI text is in `src/lib/i18n/en.ts` and `src/lib/i18n/ar.ts` (same keys). The language toggle stores the choice in a cookie, and Arabic switches the whole page to RTL with the Cairo font.

### Staff accounts

Accounts have roles (`admin` or `staff`), bcrypt-hashed passwords, lockout after 5 failed attempts and optional 2FA (Admin → Account).

```bash
npm run user:create -- --email owner@yourdomain.jo --role admin
npm run user:create -- --email desk@yourdomain.jo --role staff
npm run user:create -- --unlock owner@yourdomain.jo
npm run user:create -- --reset-password owner@yourdomain.jo
```

On hosts without a terminal (e.g. Vercel), set `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` (from `npm run user:create -- --hash-only`). The first admin is created automatically while no users exist. See [SECURITY.md](SECURITY.md).

---

## How bookings work

- Slots are 1 hour within working hours; bookings can be 1, 1.5 or 2 hours.
- Availability is calculated per field and per day, from confirmed bookings plus admin-blocked slots.
- **No double booking:** the server re-validates every booking and checks for overlaps inside a write lock, so when two people submit the same slot at once, exactly one succeeds and the other gets a friendly "just booked" message. Restoring a cancelled booking is checked the same way.
- Past slots are disabled using Jordan time (`Asia/Amman`).
- Phone validation accepts Jordanian mobiles (`07X XXX XXXX`, `+9627…`, `009627…`) or any international `+` number.

### API

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/fields`, `/api/fields/:id` | Public |
| POST / PUT / DELETE | `/api/fields`, `/api/fields/:id` | Admin |
| GET | `/api/availability?fieldId=&date=` | Public (no customer data) |
| POST | `/api/bookings` | **Logged-in customers only** (401 `LOGIN_REQUIRED` otherwise; rate limited per IP and per account, Turnstile, honeypot); returns `{ ref, token, totalPrice }` |
| GET | `/api/bookings?date=&fieldId=&fieldType=&status=` | Staff/Admin (phones masked) |
| PATCH | `/api/bookings/:id` `{status}` | Staff/Admin |
| GET | `/api/bookings/:id/phone` | Staff/Admin (each reveal is audited) |
| GET / POST / DELETE | `/api/blocks` | Staff/Admin |
| POST | `/api/uploads` · GET `/api/uploads/:name` | Admin · Public |
| POST | `/api/contact` | Public (stored for staff → Admin → Messages) |
| POST | `/api/admin/login`, `/api/admin/logout`, `/api/admin/totp` | Login (rate limited, lockout) / session |
| GET | `/api/admin/audit` · `/api/admin/messages` | Admin · Staff/Admin |

All state-changing requests must come from the site's own origin (CSRF check in `src/middleware.ts`).

---

## Database

All data access goes through the `DataStore` interface in `src/lib/db/store.ts`, with two implementations:

| `DATABASE_URL` | Store | Use |
| --- | --- | --- |
| set | **PostgreSQL** (`src/lib/db/pg-store.ts`): Supabase, Neon, Vercel Postgres… | Production |
| empty | JSON file `data/db.json` (`src/lib/db/json-store.ts`) | Local development |

- **Schema:** `supabase/migrations/001_hajzi_schema.sql`, applied by `npm run db:setup` (safe to re-run).
- **Double booking:** impossible at the database level, through an exclusion constraint plus advisory locks for admin blocks and per-phone limits.
- **Shared state:** with a database, uploaded photos and rate limits are stored there too, so every server instance shares them.
- **Tests:** `tests/unit/pg-store.test.mts` runs the Postgres store against a real Postgres engine (PGlite). The end-to-end security suite has also been run against the production build connected to Postgres.

---

## Deploying

Step-by-step guide for Supabase + Vercel: **[DEPLOY.md](DEPLOY.md)**.

> ⚠️ Always set `DATABASE_URL` in production. Without it, Vercel falls back to the JSON file in `/tmp`, which is temporary: **bookings would be lost**.

---

## Quality notes

- **Accessibility:** semantic landmarks, skip link, labelled form controls with `aria-invalid`/`aria-describedby` errors, keyboard-friendly slot grid and date chips, visible yellow focus rings, reduced-motion support, and AA-contrast colors.
- **SEO:** per-page titles and descriptions (localized), canonical URLs, Open Graph/Twitter tags, generated OG image, favicon, `sitemap.xml`, `robots.txt`, and JSON-LD for the business.
- **Performance:** self-hosted Google Fonts via `next/font`, SVG placeholders instead of image downloads, lazy-loaded maps, and small client bundles (~155 kB first load).
