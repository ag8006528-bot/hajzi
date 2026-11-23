/**
 * Pure booking helpers shared by client and server (no Node APIs here).
 */
import { business } from '@/config/business';
import type { BusyInterval, Lang } from './types';

export const SLOT_MINUTES = 60;
export const OPEN = business.hours.openMinutes;
export const CLOSE = business.hours.closeMinutes;

/** All 1-hour slot start times within working hours. */
export function getSlotStarts(): number[] {
  const out: number[] = [];
  for (let m = OPEN; m + SLOT_MINUTES <= CLOSE; m += SLOT_MINUTES) out.push(m);
  return out;
}

export function overlaps(aStart: number, aDur: number, bStart: number, bDur: number) {
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

export function isWithinHours(start: number, duration: number) {
  return start >= OPEN && start + duration <= CLOSE && (start - OPEN) % 30 === 0;
}

export function isAllowedDuration(d: number) {
  return (business.durations as readonly number[]).includes(d);
}

export function calcPrice(pricePerHour: number, durationMinutes: number) {
  return Math.round(pricePerHour * (durationMinutes / 60) * 100) / 100;
}

export function isFree(busy: BusyInterval[], start: number, duration: number) {
  return !busy.some((b) => overlaps(start, duration, b.start, b.duration));
}

/* ─────────── Time & dates (Asia/Amman) ─────────── */

export function formatTime(minutes: number, lang: Lang) {
  const total = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const pm = h24 >= 12;
  const suffix = lang === 'ar' ? (pm ? 'م' : 'ص') : pm ? 'PM' : 'AM';
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

export function formatRange(start: number, duration: number, lang: Lang) {
  return `${formatTime(start, lang)} – ${formatTime(start + duration, lang)}`;
}

/** "HH:MM" (24h) <-> minutes within the business day. */
export function hhmmToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  let mins = Number(m[1]) * 60 + Number(m[2]);
  if (mins < OPEN && mins + 1440 < CLOSE + 1) mins += 1440; // after-midnight slot
  return mins;
}
export function minutesToHHMM(minutes: number) {
  const t = minutes % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Real calendar date only (rejects 2026-02-31, which JS would silently roll over to March). */
export const isValidDate = (d: string) => {
  if (!DATE_RE.test(d)) return false;
  const t = Date.parse(`${d}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d;
};

function zonedParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: business.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function todayISO() {
  return zonedParts().date;
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);

/** True if a slot on a business day has already started (Amman time). */
export function isPast(date: string, startMinutes: number) {
  const now = zonedParts();
  return dayNumber(date) * 1440 + startMinutes <= dayNumber(now.date) * 1440 + now.minutes;
}

export function isTooFarAhead(date: string) {
  return dayNumber(date) - dayNumber(todayISO()) > business.maxDaysAhead;
}

export function formatDate(date: string, lang: Lang, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
    ...opts,
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Absolute UTC Date for a slot (used for calendar exports). */
export function slotToUTC(date: string, minutes: number) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, minutes - business.utcOffsetMinutes));
}
