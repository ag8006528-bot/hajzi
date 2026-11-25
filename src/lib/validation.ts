/**
 * Zod schemas for EVERY input. The same schemas run in the browser (instant feedback)
 * and — authoritatively — on the server. Error messages are translation keys.
 * Unknown keys (e.g. a "totalPrice" sent by a tampered client) are stripped by Zod.
 */
import { z } from 'zod';
import { business } from '@/config/business';
import { isPast, isTooFarAhead, isValidDate, isWithinHours } from './booking';
import { cleanText, isValidPhone, normalizePhone } from './security/sanitize';
import { AMENITIES, FIELD_TYPES, type FieldInput } from './types';

export { isValidPhone, normalizePhone };

export type BookingErrorKey =
  | 'nameRequired'
  | 'nameShort'
  | 'phoneRequired'
  | 'phoneInvalid'
  | 'playersInvalid'
  | 'notesLong'
  | 'slotRequired'
  | 'slotPast'
  | 'dateInvalid';

export type BookingErrors = Partial<Record<'customerName' | 'phone' | 'players' | 'notes' | 'slot', BookingErrorKey>>;

/* ───── Building blocks ───── */

export const idSchema = z.string().regex(/^[a-z0-9-]{1,60}$/, 'invalidId');
export const uuidSchema = z.string().regex(/^[0-9a-f-]{36}$/i, 'invalidId');
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateInvalid').refine(isValidDate, 'dateInvalid');

export const phoneSchema = z
  .string('phoneRequired')
  .max(40, 'phoneInvalid')
  .transform((s) => s.trim())
  .pipe(z.string().min(1, 'phoneRequired'))
  .refine(isValidPhone, 'phoneInvalid')
  .transform(normalizePhone); // stored as E.164, e.g. +962791234567

const honeypot = z.string().max(500).optional(); // must stay empty — checked in the route
const captcha = z.string().max(2048).optional();

/* ───── Booking ───── */

export const customerSchema = z.object({
  customerName: z
    .string('nameRequired')
    .max(300, 'nameShort')
    .transform((s) => cleanText(s, 80))
    .pipe(z.string().min(1, 'nameRequired').min(3, 'nameShort')),
  phone: phoneSchema,
  players: z.number('playersInvalid').int('playersInvalid').min(1, 'playersInvalid').max(30, 'playersInvalid').optional(),
  notes: z
    .string()
    .max(500, 'notesLong')
    .transform((s) => cleanText(s, 500, { multiline: true }))
    .optional(),
});

export const bookingSchema = customerSchema
  .extend({
    fieldId: idSchema,
    date: dateSchema,
    startMinutes: z.number('slotRequired').int('slotRequired').min(0).max(2880),
    durationMinutes: z.union([z.literal(60), z.literal(90), z.literal(120)], 'slotRequired'),
    website: honeypot,
    turnstileToken: captcha,
  })
  .superRefine((v, ctx) => {
    // Server-side business rules: real slot, within opening hours, not past, not too far ahead.
    if (isTooFarAhead(v.date)) ctx.addIssue({ code: 'custom', path: ['date'], message: 'dateInvalid' });
    else if (!isWithinHours(v.startMinutes, v.durationMinutes) || v.startMinutes % 60 !== 0)
      ctx.addIssue({ code: 'custom', path: ['startMinutes'], message: 'slotRequired' });
    else if (isPast(v.date, v.startMinutes)) ctx.addIssue({ code: 'custom', path: ['startMinutes'], message: 'slotPast' });
  });
export type BookingBody = z.infer<typeof bookingSchema>;

const CUSTOMER_KEYS = new Set(['customerName', 'phone', 'players', 'notes']);
const KNOWN = new Set<string>([
  'nameRequired', 'nameShort', 'phoneRequired', 'phoneInvalid', 'playersInvalid', 'notesLong', 'slotRequired', 'slotPast', 'dateInvalid',
]);

export function toBookingErrors(error: z.ZodError): BookingErrors {
  const out: BookingErrors = {};
  for (const i of error.issues) {
    const p = String(i.path[0] ?? '');
    const key = (CUSTOMER_KEYS.has(p) ? p : 'slot') as keyof BookingErrors;
    if (out[key]) continue;
    out[key] = (KNOWN.has(i.message) ? i.message : key === 'slot' ? 'slotRequired' : 'nameRequired') as BookingErrorKey;
  }
  return out;
}

/** Client-side check of the customer form (strings straight from inputs). */
export function validateCustomer(form: { customerName: string; phone: string; players?: string | number; notes?: string }): BookingErrors {
  const r = customerSchema.safeParse({
    customerName: form.customerName,
    phone: form.phone,
    players: form.players === undefined || form.players === '' ? undefined : Number(form.players),
    notes: form.notes || undefined,
  });
  return r.success ? {} : toBookingErrors(r.error);
}

/* ───── Contact ───── */

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
export const contactSchema = z.object({
  name: z
    .string('name')
    .max(300, 'name')
    .transform((s) => cleanText(s, 80))
    .pipe(z.string().min(1, 'name')),
  contact: z
    .string('contact')
    .max(120, 'contact')
    .transform((s) => s.trim())
    .refine((c) => EMAIL.test(c) || isValidPhone(c), 'contact'),
  message: z
    .string('message')
    .max(2000, 'message')
    .transform((s) => cleanText(s, 2000, { multiline: true }))
    .pipe(z.string().min(10, 'message')),
  website: honeypot,
  turnstileToken: captcha,
});

/* ───── Admin ───── */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(1).max(200),
  totp: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

export const customerRegisterSchema = z.object({
  name: customerSchema.shape.customerName,
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().max(254).email('email'),
  password: z.string().min(1).max(200),
  website: honeypot,
  turnstileToken: captcha,
});

export const customerLoginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(1).max(200),
});

export const setupSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(1).max(200),
  code: z.string().min(1).max(100),
});

export const UPLOAD_PATH_RE = /^\/api\/uploads\/[a-f0-9]{32}\.webp$/;
/** Built-in photos shipped in public/fields/. */
export const BUNDLED_IMAGE_RE = /^\/fields\/[a-z0-9-]{1,80}\.webp$/;
const imageUrl = z
  .string()
  .max(500)
  .refine((u) => {
    if (UPLOAD_PATH_RE.test(u) || BUNDLED_IMAGE_RE.test(u)) return true;
    try {
      return new URL(u).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Images must be uploaded files or https:// URLs');

const req = (max: number, label: string) =>
  z
    .string()
    .max(max * 2)
    .transform((s) => cleanText(s, max))
    .pipe(z.string().min(1, `${label} is required`));
const opt = (max: number, multiline = false) =>
  z
    .string()
    .max(max * 2)
    .transform((s) => cleanText(s, max, { multiline }))
    .default('');

export const fieldSchema = z.object({
  name: z.object({ en: req(80, 'Name (EN)'), ar: req(80, 'Name (AR)') }),
  type: z.enum(FIELD_TYPES as [string, ...string[]]).transform((t) => t as FieldInput['type']),
  area: z.object({ en: req(80, 'Area (EN)'), ar: opt(80) }),
  address: z.object({ en: opt(200), ar: opt(200) }),
  description: z.object({ en: opt(600, true), ar: opt(600, true) }),
  coordinates: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  mapsQuery: opt(200),
  priceSource: z.object({ en: opt(160), ar: opt(160) }).optional(),
  priceEstimated: z.boolean().optional(),
  closeMinutes: z.number().int().min(60).max(2880).optional(),
  pricePerHour: z.number().min(0, 'Price must be positive').max(10_000),
  onlineBooking: z.boolean().default(true),
  phone: z
    .string()
    .max(40)
    .transform((s) => cleanText(s, 30))
    .refine(isValidPhone, 'Invalid phone number'),
  whatsapp: z
    .string()
    .max(30)
    .transform((s) => s.replace(/\D/g, ''))
    // Empty = use the field's phone number (filled in below).
    .refine((s) => s === '' || (s.length >= 8 && s.length <= 15), 'Invalid WhatsApp number'),
  size: opt(40),
  surface: z.enum(['natural', 'artificial', 'unknown']),
  lighting: z.boolean(),
  amenities: z
    .array(z.enum(AMENITIES as [string, ...string[]]))
    .max(AMENITIES.length)
    .transform((a) => Array.from(new Set(a)) as FieldInput['amenities']),
  images: z.array(imageUrl).max(8),
  featured: z.boolean(),
})
  .refine((f) => !f.onlineBooking || f.pricePerHour > 0, { path: ['pricePerHour'], message: 'Price must be positive for online booking' })
  .transform((f) => (f.whatsapp ? f : { ...f, whatsapp: normalizePhone(f.phone).replace(/\D/g, '') })) satisfies z.ZodType<FieldInput, unknown>;

/** Fields without onlineBooking set (older data) take online bookings. */
export const isBookableOnline = (f: { onlineBooking?: boolean; pricePerHour: number }) => f.onlineBooking !== false && f.pricePerHour > 0;

export const statusSchema = z.object({ status: z.enum(['confirmed', 'cancelled']) });
export const blockSchema = z.object({ fieldId: idSchema, date: dateSchema, startMinutes: z.number().int().min(0).max(2880) });

export const totpSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('setup') }),
  z.object({ action: z.literal('enable'), code: z.string().regex(/^\d{6}$/) }),
  z.object({ action: z.literal('disable'), password: z.string().min(1).max(200), code: z.string().regex(/^\d{6}$/) }),
]);

/* ───── Query strings ───── */

export const availabilityQuery = z.object({ fieldId: idSchema, date: dateSchema });
export const bookingFilterQuery = z.object({
  date: dateSchema.optional(),
  fieldId: idSchema.optional(),
  fieldType: z.enum(['5v5', '11v11']).optional(),
  status: z.enum(['confirmed', 'cancelled']).optional(),
});

/** URLSearchParams → plain object, dropping empty values. */
export const queryObject = (sp: URLSearchParams) =>
  Object.fromEntries([...sp.entries()].filter(([, v]) => v !== '').map(([k, v]) => [k, v.slice(0, 200)]));

export function defaultFieldInput(): FieldInput {
  return {
    name: { en: '', ar: '' },
    type: '5v5',
    area: { en: '', ar: '' },
    address: { en: '', ar: '' },
    description: { en: '', ar: '' },
    coordinates: { ...business.coordinates },
    pricePerHour: business.prices['5v5'],
    onlineBooking: true,
    // Each field shows its OWN owner's phone/WhatsApp; the admin types them in (HAJZI has no public phone).
    phone: '',
    whatsapp: '',
    size: '',
    surface: 'artificial',
    lighting: true,
    amenities: ['parking', 'changingRooms'],
    images: [],
    featured: false,
  };
}

/* ───── Field owner accounts ───── */

export const ownerCreateSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email('email'),
  name: z
    .string()
    .max(160)
    .transform((s) => cleanText(s, 80))
    .default(''),
  fieldIds: z.array(idSchema).min(1, 'no_fields').max(10),
});

export const passwordChangeSchema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(1).max(200),
});

/** Fields an OWNER may change on their own field (name, id, listing flags etc. stay admin-only). */
export const OWNER_EDITABLE_FIELD_KEYS = [
  'description', 'pricePerHour', 'priceEstimated', 'phone', 'whatsapp', 'size', 'surface',
  'lighting', 'amenities', 'images', 'closeMinutes', 'address',
] as const;
