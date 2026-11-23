'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { business } from '@/config/business';
import {
  CLOSE,
  addDays,
  calcPrice,
  formatDate,
  formatRange,
  formatTime,
  getSlotStarts,
  isFree,
  isPast,
  minutesToHHMM,
  overlaps,
  todayISO,
} from '@/lib/booking';
import { fmt, formatPrice } from '@/lib/i18n';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { BusyInterval, Field } from '@/lib/types';
import { validateCustomer, type BookingErrors } from '@/lib/validation';
import { Honeypot, Turnstile, type TurnstileHandle } from '../ui/BotProtection';
import { FormField } from '../ui/FormField';
import { CalendarIcon, CheckIcon, LockIcon, SpinnerIcon } from '../ui/icons';

type SlotState = 'free' | 'booked' | 'short' | 'past';

export function BookingWidget({
  field,
  initialDate,
  initialStart,
  customer = null,
}: {
  field: Field;
  initialDate: string;
  initialStart: number | null;
  customer?: { name: string; phone: string } | null;
}) {
  const { t, lang } = useLang();
  const router = useRouter();
  const today = useMemo(() => todayISO(), []);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i)), [today]);
  // Some fields close earlier than the site-wide hours: only offer slots that end by closing time.
  const closeAt = Math.min(CLOSE, field.closeMinutes ?? CLOSE);
  const slots = useMemo(() => getSlotStarts().filter((s) => s + 60 <= closeAt), [closeAt]);

  const [date, setDate] = useState(initialDate);
  const [duration, setDuration] = useState<number>(60);
  const [start, setStart] = useState<number | null>(initialStart);
  const [busy, setBusy] = useState<BusyInterval[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState({ customerName: customer?.name ?? '', phone: customer?.phone ?? '', players: '', notes: '' });
  const [errors, setErrors] = useState<BookingErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const [honeypot, setHoneypot] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  // After login/sign-up the customer comes back to this field with the same date and time selected.
  const nextUrl = `/fields/${field.id}?date=${date}${start !== null ? `&time=${minutesToHHMM(start)}` : ''}`;
  const captchaRef = useRef<TurnstileHandle>(null);

  // Load availability whenever the date changes.
  useEffect(() => {
    const ac = new AbortController();
    setStatus('loading');
    fetch(`/api/availability?fieldId=${encodeURIComponent(field.id)}&date=${date}`, { signal: ac.signal, cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: { busy: BusyInterval[] }) => {
        setBusy(d.busy);
        setStatus('ready');
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setStatus('error');
      });
    return () => ac.abort();
  }, [field.id, date, reload]);

  const slotState = (s: number): SlotState => {
    if (isPast(date, s)) return 'past';
    if (busy.some((b) => overlaps(s, 60, b.start, b.duration))) return 'booked';
    if (s + duration > closeAt || !isFree(busy, s, duration)) return 'short';
    return 'free';
  };

  // Drop a selection that is no longer valid (after loading, or changing duration).
  useEffect(() => {
    if (status === 'ready' && start !== null && slotState(start) !== 'free') setStart(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, busy, duration, date]);

  const total = calcPrice(field.pricePerHour, duration);

  const update = (k: keyof typeof form, v: string) => {
    const next = { ...form, [k]: v };
    setForm(next);
    if (submitted) setErrors((e) => ({ ...validateCustomer(next), slot: e.slot }));
  };

  const pickDate = (d: string) => {
    if (d === date) return;
    setDate(d);
    setStart(null);
    setServerError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setServerError('');
    const errs: BookingErrors = validateCustomer(form);
    if (start === null) errs.slot = 'slotRequired';
    setErrors(errs);
    if (Object.keys(errs).length) {
      const order = ['slot', 'customerName', 'phone', 'players', 'notes'] as const;
      const first = order.find((k) => errs[k]);
      const el = formRef.current?.querySelector<HTMLElement>(first === 'slot' ? '#slots-heading' : `#bk-${first}`);
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId: field.id,
          date,
          startMinutes: start,
          durationMinutes: duration,
          customerName: form.customerName,
          phone: form.phone,
          players: form.players ? Number(form.players) : undefined,
          notes: form.notes || undefined,
          website: honeypot || undefined,
          turnstileToken: captchaToken || undefined,
          // Note: no price is sent — the server always calculates it.
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ref && data.token) {
        // The secret token is the customer's proof of ownership of this booking (IDOR protection).
        router.push(`/booking/${encodeURIComponent(data.ref)}?t=${encodeURIComponent(data.token)}`);
        return; // keep the loading state while navigating
      }
      if (data.code === 'LOGIN_REQUIRED') {
        // Session expired or logged out in another tab → reload shows the "log in to book" box.
        setServerError(t.booking.errors.loginRequired);
        router.refresh();
      } else if (res.status === 409) {
        setServerError(t.booking.errors.slotTaken);
        setStart(null);
        setReload((n) => n + 1);
      } else if (res.status === 400 && data.errors) {
        setErrors(data.errors);
      } else if (data.code === 'CAPTCHA') {
        setServerError(t.booking.errors.captcha);
      } else if (data.code === 'PHONE_LIMIT') {
        setServerError(t.booking.errors.phoneLimit);
      } else if (res.status === 429) {
        setServerError(t.booking.errors.rateLimited);
      } else {
        setServerError(t.booking.errors.generic);
      }
    } catch {
      setServerError(t.booking.errors.generic);
    }
    captchaRef.current?.reset(); // Turnstile tokens are single-use
    setSubmitting(false);
  };

  const err = (k: keyof BookingErrors) => (errors[k] ? t.booking.errors[errors[k]!] : undefined);

  const dayLabel = (d: string) =>
    d === today ? t.booking.today : d === addDays(today, 1) ? t.booking.tomorrow : formatDate(d, lang, { weekday: 'short', day: undefined, month: undefined, year: undefined });

  const stepTitle = (n: number, text: string, id?: string) => (
    <h3 id={id} tabIndex={id ? -1 : undefined} className="flex items-center gap-2 text-base font-bold focus:outline-none">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-pitch text-xs font-bold text-white">{n}</span>
      {text}
    </h3>
  );

  return (
    <section aria-labelledby="booking-title" className="panel overflow-hidden">
      <div className="bg-pitch-dark px-5 py-4 text-white">
        <h2 id="booking-title" className="heading text-3xl">
          {t.booking.title}
        </h2>
      </div>

      <form ref={formRef} onSubmit={submit} noValidate className="space-y-6 p-5">
        {/* 1. Date */}
        <div>
          {stepTitle(1, t.booking.date)}
          <div className="scrollbar-none -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label={t.booking.date}>
            {days.map((d) => {
              const active = d === date;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => pickDate(d)}
                  aria-pressed={active}
                  aria-label={formatDate(d, lang)}
                  className={`flex min-w-[64px] shrink-0 flex-col items-center rounded-xl border-2 px-2 py-2 transition ${
                    active ? 'border-pitch bg-pitch text-white' : 'border-ink/10 bg-white text-ink hover:border-pitch/50'
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase">{dayLabel(d)}</span>
                  <span className="font-display text-2xl leading-tight">{Number(d.slice(8))}</span>
                  <span className="text-[11px]">{formatDate(d, lang, { weekday: undefined, day: undefined, year: undefined, month: 'short' })}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <CalendarIcon width={18} height={18} className="text-pitch" />
            <label htmlFor="bk-date" className="text-sm font-semibold">
              {t.booking.otherDate}
            </label>
            <input
              id="bk-date"
              type="date"
              value={date}
              min={today}
              max={addDays(today, business.maxDaysAhead)}
              onChange={(e) => e.target.value && pickDate(e.target.value)}
              className="input !min-h-[40px] !w-auto !py-1.5 text-sm"
            />
          </div>
        </div>

        {/* 2. Duration */}
        <fieldset>
          <legend>{stepTitle(2, t.booking.duration)}</legend>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {business.durations.map((d) => (
              <label key={d} className="cursor-pointer">
                <input type="radio" name="duration" value={d} checked={duration === d} onChange={() => setDuration(d)} className="peer sr-only" />
                <span className="block rounded-xl border-2 border-ink/10 px-2 py-2.5 text-center text-sm font-bold transition hover:border-pitch/50 peer-checked:border-pitch peer-checked:bg-pitch/10 peer-checked:text-pitch-dark peer-focus-visible:ring-4 peer-focus-visible:ring-card">
                  {t.booking.durations[String(d)]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* 3. Time slots */}
        <div>
          {stepTitle(3, t.booking.time, 'slots-heading')}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/70" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border-2 border-pitch/40 bg-white" /> {t.booking.legendFree}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-ink/15" /> {t.booking.legendBooked}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-card" /> {t.booking.legendSelected}
            </span>
          </div>

          <div className="mt-3 min-h-[148px]" aria-live="polite" aria-busy={status === 'loading'}>
            {status === 'error' ? (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {t.booking.loadError}{' '}
                <button type="button" className="font-bold underline" onClick={() => setReload((n) => n + 1)}>
                  {t.booking.retry}
                </button>
              </div>
            ) : status === 'loading' ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
                <span className="sr-only">{t.booking.loading}</span>
                {slots.map((s) => (
                  <span key={s} className="h-[52px] animate-pulse rounded-xl bg-ink/[0.07]" />
                ))}
              </div>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
                {slots.map((s) => {
                  const st = slotState(s);
                  const selected = start === s;
                  const inRange = start !== null && s > start && s < start + duration;
                  const disabled = st !== 'free';
                  const sub = st === 'booked' ? t.booking.booked : st === 'past' ? t.booking.past : st === 'short' ? t.booking.unavailable : '';
                  return (
                    <li key={s}>
                      <button
                        type="button"
                        disabled={disabled}
                        aria-pressed={selected}
                        onClick={() => {
                          setStart(s);
                          setServerError('');
                          if (submitted) setErrors((e) => ({ ...e, slot: undefined }));
                        }}
                        className={`flex h-[52px] w-full flex-col items-center justify-center rounded-xl border-2 text-sm font-bold transition ${
                          selected
                            ? 'border-card bg-card text-ink shadow-glow'
                            : inRange
                              ? 'border-card/70 bg-card/40 text-ink'
                              : st === 'free'
                                ? 'border-pitch/30 bg-white text-ink hover:border-pitch hover:bg-pitch/5'
                                : st === 'booked'
                                  ? 'cursor-not-allowed border-transparent bg-ink/10 text-ink/60 line-through decoration-ink/30'
                                  : 'cursor-not-allowed border-transparent bg-ink/[0.04] text-ink/60'
                        }`}
                      >
                        <span>{formatTime(s, lang)}</span>
                        {sub && <span className="text-[10px] font-semibold no-underline">{sub}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {err('slot') && (
            <p className="field-error" role="alert">
              {err('slot')}
            </p>
          )}
        </div>

        {/* Summary */}
        <div className="rounded-2xl border-2 border-dashed border-pitch/30 bg-pitch/[0.04] p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink/70">{t.booking.summary}</h3>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink/70">{t.booking.when}</dt>
              <dd className="text-end font-semibold">
                {formatDate(date, lang, { year: undefined })}
                <AnimatePresence mode="wait">
                  {start !== null && (
                    <motion.span key={`${start}-${duration}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="block">
                      {formatRange(start, duration, lang)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink/70">{fmt(t.booking.priceCalc, { price: formatPrice(field.pricePerHour, lang), hours: duration / 60 })}</dt>
              <dd className="font-semibold">{formatPrice(total, lang)}</dd>
            </div>
          </dl>
          <div className="mt-3 flex items-baseline justify-between border-t border-pitch/20 pt-3">
            <span className="font-bold">{t.booking.total}</span>
            <motion.span key={total} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="font-display text-4xl text-pitch-dark">
              {formatPrice(total, lang)}
            </motion.span>
          </div>
          {field.priceEstimated && <p className="mt-2 text-xs font-semibold text-ink/75">≈ {t.field.approxNote}</p>}
          <p className="mt-2 text-xs text-ink/65">{t.booking.payNote}</p>
        </div>

        {!customer ? (
          /* Guests can check availability, but must log in to book (also enforced by the API). */
          <div className="rounded-2xl border-2 border-pitch/25 bg-pitch/[0.06] p-5 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-card text-ink">
              <LockIcon width={22} height={22} />
            </span>
            <h3 className="mt-3 text-lg font-bold">{t.booking.loginTitle}</h3>
            <p className="mt-1 text-sm text-ink/75">{t.booking.loginText}</p>
            <div className="mt-4 grid gap-2">
              <a href={`/account/login?next=${encodeURIComponent(nextUrl)}`} className="btn-primary w-full !min-h-[52px]">
                {t.booking.loginButton}
              </a>
              <a href={`/account/register?next=${encodeURIComponent(nextUrl)}`} className="btn-ghost w-full">
                {t.booking.registerButton}
              </a>
            </div>
          </div>
        ) : (
          <>
        {/* Customer details */}
        <fieldset className="space-y-4">
          <legend className="mb-1 text-base font-bold">{t.booking.yourDetails}</legend>
          {customer && (
            <p className="rounded-xl bg-pitch/10 p-3 text-sm font-semibold text-pitch-dark">
              {fmt(t.account.signedInNote, { name: customer.name })}
            </p>
          )}
          <FormField id="bk-customerName" label={t.booking.name} error={err('customerName')}>
            <input
              className="input"
              type="text"
              autoComplete="name"
              required
              value={form.customerName}
              onChange={(e) => update('customerName', e.target.value)}
            />
          </FormField>
          <FormField id="bk-phone" label={t.booking.phone} hint={t.booking.phoneHint} error={err('phone')}>
            <input
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              required
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </FormField>
          <FormField id="bk-players" label={t.booking.players} optional={t.booking.optional} error={err('players')}>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={30}
              value={form.players}
              onChange={(e) => update('players', e.target.value)}
            />
          </FormField>
          <FormField id="bk-notes" label={t.booking.notes} optional={t.booking.optional} error={err('notes')}>
            <textarea
              className="input min-h-[88px] resize-y"
              rows={3}
              maxLength={500}
              placeholder={t.booking.notesPlaceholder}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
            />
          </FormField>
        </fieldset>

        <Honeypot value={honeypot} onChange={setHoneypot} />
        <Turnstile ref={captchaRef} onToken={setCaptchaToken} />

        {serverError && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
            {serverError}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full !min-h-[52px] !text-base">
          {submitting ? (
            <>
              <SpinnerIcon width={18} height={18} /> {t.booking.confirming}
            </>
          ) : (
            <>
              <CheckIcon width={18} height={18} /> {t.booking.confirm} · {formatPrice(total, lang)}
            </>
          )}
        </button>
        {start === null && <p className="-mt-3 text-center text-xs text-ink/65">{t.booking.selectSlot}</p>}
          </>
        )}
      </form>
    </section>
  );
}
