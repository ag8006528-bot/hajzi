export type Lang = 'en' | 'ar';
export type FieldType = '5v5' | '11v11';
export type Surface = 'natural' | 'artificial' | 'unknown';
export type Amenity = 'parking' | 'changingRooms' | 'showers' | 'cafe';

export const AMENITIES: Amenity[] = ['parking', 'changingRooms', 'showers', 'cafe'];
export const FIELD_TYPES: FieldType[] = ['5v5', '11v11'];

export interface Localized {
  en: string;
  ar: string;
}

export interface Field {
  id: string;
  name: Localized;
  type: FieldType;
  area: Localized;
  address: Localized;
  description: Localized;
  coordinates: { lat: number; lng: number };
  /** Google Maps search text for the venue's own listing (photos, reviews). Defaults to "name, area". */
  mapsQuery?: string;
  /** 0 = price not known ("call for price"); only allowed when onlineBooking is false. */
  pricePerHour: number;
  /** Where a listed (not yet partner) field's price came from, e.g. "the field's Facebook page, checked 23 Nov 2026". */
  priceSource?: Localized;
  /** true = HAJZI's approximate price (no published price yet), shown as "approx." on the site. */
  priceEstimated?: boolean;
  /** Field closes earlier than the site-wide hours: minutes after midnight of the booking day (>1440 = after midnight). */
  closeMinutes?: number;
  /**
   * false = "call to book": the field is listed (e.g. a real venue that has not joined HAJZI yet)
   * but online booking is disabled and customers contact the field directly. Missing = true.
   */
  onlineBooking?: boolean;
  phone: string;
  whatsapp: string;
  size: string;
  surface: Surface;
  lighting: boolean;
  amenities: Amenity[];
  images: string[];
  featured: boolean;
  createdAt: string;
}

export type FieldInput = Omit<Field, 'id' | 'createdAt'>;

export type BookingStatus = 'confirmed' | 'cancelled';

export interface Booking {
  id: string;
  ref: string;
  fieldId: string;
  /** Snapshot so the confirmation still works if the field is edited/removed. */
  fieldName: Localized;
  fieldType: FieldType;
  fieldAddress: Localized;
  /** Business day, YYYY-MM-DD. */
  date: string;
  /** Minutes from midnight of `date` (may exceed 1440 for after-midnight slots). */
  startMinutes: number;
  durationMinutes: number;
  customerName: string;
  phone: string;
  players?: number;
  notes?: string;
  totalPrice: number;
  status: BookingStatus;
  createdAt: string;
  /** SHA-256 of the secret token in the customer's confirmation link (the token itself is never stored). */
  accessTokenHash: string;
  /** Set when personal data was removed by the retention job. */
  anonymized?: boolean;
  /** Customer account that made the booking (only set when they were signed in). */
  customerId?: string;
}

/** What admin/staff APIs return: never the token hash, phone masked unless explicitly revealed. */
export type BookingView = Omit<Booking, 'accessTokenHash'>;

/** admin: everything · staff: day-to-day bookings · owner: a field owner, ONLY their own field(s). */
export type Role = 'admin' | 'staff' | 'owner';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** bcrypt hash — plain-text passwords are never stored. */
  passwordHash: string;
  /** AES-256-GCM encrypted TOTP secret. */
  totpSecretEnc?: string;
  totpPendingEnc?: string;
  totpEnabled: boolean;
  totpLastStep?: number;
  failedAttempts: number;
  lockedUntil?: string;
  createdAt: string;
  lastLoginAt?: string;
  /** SHA-256 of the one-time setup code used to create this account (makes each code single-use). */
  setupCodeHash?: string;
  /** Field owners (role 'owner'): the field ids they manage. Every API checks it on the server. */
  fieldIds?: string[];
  /** Removed accounts can't log in (kept for the audit trail). */
  disabled?: boolean;
  /** Set when an admin created the account with a temporary password. */
  mustChangePassword?: boolean;
}

/** Safe user shape for the browser. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  totpEnabled: boolean;
  fieldIds?: string[];
  mustChangePassword?: boolean;
}

/** Customer account (separate from staff — a customer session can never open the admin area). */
export interface Customer {
  id: string;
  name: string;
  email: string;
  /** E.164, e.g. +962791234567 */
  phone: string;
  passwordHash: string;
  failedAttempts: number;
  lockedUntil?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface PublicCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface Session {
  /** SHA-256 of the random session token stored in the cookie. */
  id: string;
  /** Staff user id, or customer id when kind === 'customer'. */
  userId: string;
  /** Missing on older sessions = 'staff'. */
  kind?: 'staff' | 'customer';
  createdAt: string;
  expiresAt: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
  details?: Record<string, string | number | boolean>;
}

export interface ContactMessage {
  id: string;
  name: string;
  contact: string;
  message: string;
  createdAt: string;
}

export interface BookingInput {
  fieldId: string;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  customerName: string;
  phone: string;
  players?: number;
  notes?: string;
}

/** Admin-blocked time slot. */
export interface Block {
  id: string;
  fieldId: string;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  createdAt: string;
}

/** Public, anonymous view of occupied time. */
export interface BusyInterval {
  start: number;
  duration: number;
  kind: 'booking' | 'block';
  blockId?: string;
}
