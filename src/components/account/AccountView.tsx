'use client';

import Link from 'next/link';
import { formatDate, formatRange, isPast } from '@/lib/booking';
import { fmt, formatPrice, loc } from '@/lib/i18n';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { FieldType, Localized, PublicCustomer } from '@/lib/types';
import { TypeBadge } from '../fields/TypeBadge';
import { ArrowIcon, MailIcon, PhoneIcon } from '../ui/icons';

export interface AccountBooking {
  id: string;
  ref: string;
  fieldId: string;
  fieldName: Localized;
  fieldType: FieldType;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  totalPrice: number;
  status: 'confirmed' | 'cancelled';
}

export function AccountView({ customer, bookings }: { customer: PublicCustomer; bookings: AccountBooking[] }) {
  const { t, lang } = useLang();

  const logout = async () => {
    await fetch('/api/account/logout', { method: 'POST' });
    window.location.assign('/'); // full reload so the navbar shows "Login" again
  };

  const upcoming = bookings.filter((b) => !isPast(b.date, b.startMinutes)).sort((a, b) => (a.date + a.startMinutes).localeCompare(b.date + b.startMinutes));
  const past = bookings.filter((b) => isPast(b.date, b.startMinutes));

  const list = (items: AccountBooking[], title: string) =>
    items.length > 0 && (
      <section className="mt-8">
        <h2 className="heading text-3xl">{title}</h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {items.map((b) => (
            <li key={b.id} className={`panel p-5 ${b.status === 'cancelled' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <TypeBadge type={b.fieldType} className="!px-2 !py-0.5 !text-sm" />
                  <h3 className="mt-2 text-lg font-bold">{loc(b.fieldName, lang)}</h3>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    b.status === 'confirmed' ? 'bg-pitch/15 text-pitch-dark' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {b.status === 'confirmed' ? t.admin.confirmed : t.admin.cancelled}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink/80">{formatDate(b.date, lang)}</p>
              <p className="text-sm font-semibold">{formatRange(b.startMinutes, b.durationMinutes, lang)}</p>
              <div className="mt-3 flex items-center justify-between border-t border-ink/10 pt-3 text-sm">
                <span className="font-mono text-ink/70" dir="ltr">
                  {b.ref}
                </span>
                <span className="font-bold text-pitch-dark">{formatPrice(b.totalPrice, lang)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-card">{t.account.title}</p>
          <h1 className="heading mt-1 text-4xl sm:text-5xl">{fmt(t.account.hello, { name: customer.name })}</h1>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/85" dir="ltr">
            <span className="inline-flex items-center gap-1.5">
              <MailIcon width={15} height={15} /> {customer.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PhoneIcon width={15} height={15} /> {customer.phone}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/fields" className="btn-primary !min-h-[40px]">
            {t.account.bookNow}
            <ArrowIcon width={16} height={16} className="rtl:rotate-180" />
          </Link>
          <button type="button" onClick={logout} className="btn-outline !min-h-[40px]">
            {t.account.logout}
          </button>
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="panel-glass mt-10 p-10 text-center">
          <p className="text-lg">{t.account.none}</p>
          <Link href="/fields" className="btn-primary mt-5">
            {t.account.bookNow}
          </Link>
        </div>
      ) : (
        <>
          {list(upcoming, t.account.upcoming)}
          {list(past, t.account.past)}
        </>
      )}
    </div>
  );
}
