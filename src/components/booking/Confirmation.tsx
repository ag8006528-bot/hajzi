'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { formatDate, formatRange, slotToUTC } from '@/lib/booking';
import { fmt, formatPrice, loc } from '@/lib/i18n';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { Booking } from '@/lib/types';

/** Only the fields the customer's confirmation needs (no token hash, phone or notes). */
type ConfirmationBooking = Omit<Booking, 'accessTokenHash' | 'notes'>;
import { TypeBadge } from '../fields/TypeBadge';
import { CenterCircle } from '../ui/PitchDecor';
import { CalendarIcon, CheckIcon, CopyIcon, HomeIcon, WhatsAppIcon } from '../ui/icons';

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEscape = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');

export function Confirmation({ booking, coordinates }: { booking: ConfirmationBooking | null; coordinates: { lat: number; lng: number } | null }) {
  const { t, lang } = useLang();
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);

  if (!booking) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="heading text-5xl">{t.confirmation.notFound}</h1>
        <p className="mt-3 text-white/85">{t.confirmation.notFoundText}</p>
        <Link href="/" className="btn-primary mt-8">
          {t.confirmation.backHome}
        </Link>
      </div>
    );
  }

  const fieldName = loc(booking.fieldName, lang);
  const location = loc(booking.fieldAddress, lang);
  const dateLabel = formatDate(booking.date, lang);
  const timeLabel = formatRange(booking.startMinutes, booking.durationMinutes, lang);
  const cancelled = booking.status === 'cancelled';

  const addToCalendar = () => {
    const start = slotToUTC(booking.date, booking.startMinutes);
    const end = slotToUTC(booking.date, booking.startMinutes + booking.durationMinutes);
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HAJZI//Booking//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${booking.ref}@hajzi`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsEscape(`⚽ ${fieldName} (${booking.fieldType}) — HAJZI`)}`,
      `DESCRIPTION:${icsEscape(`${t.confirmation.ref}: ${booking.ref}\n${t.confirmation.total}: ${formatPrice(booking.totalPrice, lang)}`)}`,
      `LOCATION:${icsEscape(location)}`,
      ...(coordinates ? [`GEO:${coordinates.lat};${coordinates.lng}`] : []),
      'BEGIN:VALARM',
      'TRIGGER:-PT1H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Match reminder',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `hajzi-${booking.ref}.ics` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const shareText = fmt(t.confirmation.shareText, {
    field: fieldName,
    type: booking.fieldType,
    date: dateLabel,
    time: timeLabel,
    location,
    ref: booking.ref,
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(booking.ref);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const rows: [string, React.ReactNode][] = [
    [t.confirmation.field, fieldName],
    [t.confirmation.type, <TypeBadge key="b" type={booking.fieldType} className="!text-base" />],
    [t.confirmation.date, dateLabel],
    [t.confirmation.time, <span key="t">{timeLabel}</span>],
    [t.confirmation.location, location],
    [t.confirmation.name, booking.customerName],
  ];

  return (
    <div className="relative overflow-hidden">
      <CenterCircle className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[560px] -translate-x-1/2 text-white/10" />
      <div className="relative mx-auto max-w-xl px-4 py-12 sm:py-16">
        <div className="text-center">
          <motion.div
            initial={reduce ? false : { scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className={`mx-auto grid h-20 w-20 place-items-center rounded-full shadow-glow ${cancelled ? 'bg-white/80' : 'bg-card'}`}
          >
            <CheckIcon width={40} height={40} className="text-pitch-dark" strokeWidth={3} />
          </motion.div>
          <h1 className="heading mt-6 text-5xl sm:text-6xl">{cancelled ? t.confirmation.cancelled : t.confirmation.title}</h1>
          {!cancelled && <p className="mt-3 text-white/90">{t.confirmation.subtitle}</p>}
        </div>

        <motion.section
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="panel mt-8 overflow-hidden"
          aria-label={t.confirmation.ref}
        >
          {/* Ticket header */}
          <div className="relative bg-pitch-dark px-6 py-5 text-center text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">{t.confirmation.ref}</p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <p dir="ltr" className="font-display text-5xl tracking-[0.12em] text-card">
                {booking.ref}
              </p>
              <button
                type="button"
                onClick={copy}
                aria-label={t.confirmation.copy}
                className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
              >
                {copied ? <CheckIcon width={18} height={18} /> : <CopyIcon width={18} height={18} />}
              </button>
            </div>
            <p className="sr-only" aria-live="polite">
              {copied ? t.confirmation.copied : ''}
            </p>
            {/* perforation */}
            <span aria-hidden="true" className="absolute -bottom-3 -start-3 h-6 w-6 rounded-full bg-pitch" />
            <span aria-hidden="true" className="absolute -bottom-3 -end-3 h-6 w-6 rounded-full bg-pitch" />
          </div>
          <dl className="divide-y divide-ink/10 border-t-2 border-dashed border-ink/15 px-6">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-3.5">
                <dt className="text-sm text-ink/70">{k}</dt>
                <dd className="text-end font-semibold">{v}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="font-bold">{t.confirmation.total}</dt>
              <dd className="font-display text-4xl text-pitch-dark">{formatPrice(booking.totalPrice, lang)}</dd>
            </div>
          </dl>
        </motion.section>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {!cancelled && (
            <>
              <button type="button" onClick={addToCalendar} className="btn-primary">
                <CalendarIcon width={18} height={18} />
                {t.confirmation.addCalendar}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn bg-[#25D366] text-ink hover:bg-[#3ee07b]"
              >
                <WhatsAppIcon width={18} height={18} />
                {t.confirmation.shareWhatsapp}
              </a>
            </>
          )}
          <Link href="/" className="btn-outline sm:col-span-2">
            <HomeIcon width={18} height={18} />
            {t.confirmation.backHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
