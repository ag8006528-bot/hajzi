/**
 * ─────────────────────────────────────────────────────────────
 *  HAJZI — BUSINESS DETAILS
 *  Edit this single file to change contact info, hours, prices.
 *  Values marked TODO are placeholders — replace them with the
 *  real business details before going live.
 * ─────────────────────────────────────────────────────────────
 */
import type { FieldType } from '@/lib/types';

export const business = {
  name: 'HAJZI',

  /** HAJZI lists fields across the whole city (no single office address). */
  address: {
    en: 'All over Amman, Jordan',
    ar: 'في جميع أنحاء عمّان، الأردن',
  },

  /** Centre of Amman: the contact map shows the whole city. */
  coordinates: { lat: 31.9539, lng: 35.9106 },
  mapZoom: 11,

  // NOT shown anywhere on the site (HAJZI's owner keeps their number private; customers call each
  // FIELD's own phone). Only used by the fictional demo fields in the automated tests.
  phone: '+962 79 000 0000',
  whatsapp: '962790000000',

  email: 'hajzifootball@gmail.com',

  /**
   * Working hours. Times are minutes from midnight of the booking day.
   * A close time above 1440 means "after midnight" (e.g. 26 * 60 = 2:00 AM next day).
   * TODO: [Working hours] — currently Daily 4:00 PM – 2:00 AM
   */
  hours: {
    openMinutes: 16 * 60, // 4:00 PM
    closeMinutes: 26 * 60, // 2:00 AM (next day)
    label: {
      en: 'Daily 4:00 PM – 2:00 AM',
      ar: 'يومياً من 4:00 مساءً حتى 2:00 صباحاً',
    },
  },

  /** IANA time zone used to decide which slots are already in the past. */
  timeZone: 'Asia/Amman',
  /** UTC offset in minutes (Jordan is UTC+3 all year). Used for calendar exports. */
  utcOffsetMinutes: 180,

  currency: { en: 'JOD', ar: 'د.أ' },

  // TODO: [PRICE] default price per hour by field type (JOD). New fields start with these.
  prices: {
    '5v5': 30,
    '11v11': 80,
  } satisfies Record<FieldType, number>,

  /** Allowed booking durations in minutes. */
  durations: [60, 90, 120] as const,

  /** How many days ahead customers can book. */
  maxDaysAhead: 30,

  social: {
    instagram: 'https://instagram.com/',
    facebook: 'https://facebook.com/',
    tiktok: 'https://tiktok.com/',
  },
} as const;

/** Public address: NEXT_PUBLIC_SITE_URL, or on Vercel the project's main domain (set automatically). */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')
).replace(/\/$/, '');

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const whatsappHref = (number: string, text?: string) =>
  `https://wa.me/${number.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
/** Google Maps embed. `query` (e.g. "Amman, Jordan") shows a whole area instead of a single pin. */
export const mapEmbedSrc = (lat: number, lng: number, zoom = 15, query?: string) =>
  `https://maps.google.com/maps?q=${encodeURIComponent(query ?? `${lat},${lng}`)}&z=${zoom}&output=embed`;
export const mapLink = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/** The venue's own Google Maps listing (photos, reviews), found by name — we link to it, we don't copy its photos. */
export const placeLink = (query: string, lat: number, lng: number) =>
  // Searching around the field's own map pin makes Google open that exact venue, not a list of similar names.
  `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${lat},${lng},18z`;
