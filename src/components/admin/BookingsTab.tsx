'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDate, formatRange } from '@/lib/booking';
import { formatPrice, loc } from '@/lib/i18n';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { BookingView as Booking, Field } from '@/lib/types';
import { TypeBadge } from '../fields/TypeBadge';
import { SpinnerIcon } from '../ui/icons';

/** Phone numbers arrive masked (+962 79 *** 4521). "Show" fetches the full number; each reveal is audited server-side. */
function PhoneCell({ booking }: { booking: Booking }) {
  const { t } = useLang();
  const [full, setFull] = useState<string | null>(null);
  if (!booking.phone) return <span>—</span>;
  if (full)
    return (
      <span className="inline-flex items-center gap-2">
        <a href={`tel:${full}`} className="font-semibold text-pitch underline-offset-2 hover:underline">
          {full}
        </a>
        <button type="button" className="text-xs text-ink/60 hover:underline" onClick={() => setFull(null)}>
          {t.admin.hide}
        </button>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono">{booking.phone}</span>
      <button
        type="button"
        className="rounded-full border border-pitch/30 px-2 py-0.5 text-xs font-semibold text-pitch hover:bg-pitch/5"
        onClick={async () => {
          const res = await fetch(`/api/bookings/${booking.id}/phone`, { cache: 'no-store' });
          if (res.ok) setFull((await res.json()).phone);
        }}
      >
        {t.admin.show}
      </button>
    </span>
  );
}

export function BookingsTab({ fields }: { fields: Field[] }) {
  const { t, lang } = useLang();
  const [filters, setFilters] = useState({ date: '', fieldId: '', fieldType: '', status: '' });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    const res = await fetch(`/api/bookings?${q}`, { cache: 'no-store' }).catch(() => null);
    if (res?.ok) setBookings((await res.json()).bookings);
    else setError(t.admin.error);
    setLoading(false);
  }, [filters, t.admin.error]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (b: Booking, status: Booking['status']) => {
    if (status === 'cancelled' && !window.confirm(t.admin.confirmCancel)) return;
    const res = await fetch(`/api/bookings/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      window.alert(d.error || t.admin.error);
    }
    load();
  };

  const confirmed = bookings.filter((b) => b.status === 'confirmed');
  const revenue = confirmed.reduce((s, b) => s + b.totalPrice, 0);
  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div>
          <label htmlFor="bf-date" className="label">
            {t.admin.filterDate}
          </label>
          <input id="bf-date" type="date" className="input" value={filters.date} onChange={set('date')} />
        </div>
        <div>
          <label htmlFor="bf-field" className="label">
            {t.admin.filterField}
          </label>
          <select id="bf-field" className="input" value={filters.fieldId} onChange={set('fieldId')}>
            <option value="">{t.admin.all}</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {loc(f.name, lang)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bf-type" className="label">
            {t.admin.filterType}
          </label>
          <select id="bf-type" className="input" value={filters.fieldType} onChange={set('fieldType')}>
            <option value="">{t.admin.all}</option>
            <option value="5v5">5v5</option>
            <option value="11v11">11v11</option>
          </select>
        </div>
        <div>
          <label htmlFor="bf-status" className="label">
            {t.admin.filterStatus}
          </label>
          <select id="bf-status" className="input" value={filters.status} onChange={set('status')}>
            <option value="">{t.admin.all}</option>
            <option value="confirmed">{t.admin.confirmed}</option>
            <option value="cancelled">{t.admin.cancelled}</option>
          </select>
        </div>
        <button type="button" className="btn-ghost" onClick={() => setFilters({ date: '', fieldId: '', fieldType: '', status: '' })}>
          {t.admin.clear}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="panel-glass p-4">
          <p className="text-sm text-white/80">{t.admin.totalBookings}</p>
          <p className="font-display text-4xl text-card">{bookings.length}</p>
        </div>
        <div className="panel-glass p-4">
          <p className="text-sm text-white/80">{t.admin.revenue}</p>
          <p className="font-display text-4xl text-card">{formatPrice(revenue, lang)}</p>
        </div>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[960px] text-start text-sm">
          <thead className="bg-pitch-dark text-white">
            <tr>
              {Object.values(t.admin.cols).map((c) => (
                <th key={c} scope="col" className="px-3 py-3 text-start font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {loading ? (
              <tr>
                <td colSpan={11} className="p-8 text-center">
                  <SpinnerIcon className="mx-auto" />
                  <span className="sr-only">{t.common.loading}</span>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-red-700">
                  {error}
                </td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-ink/70">
                  {t.admin.noBookings}
                </td>
              </tr>
            ) : (
              bookings.map((b) => (
                <tr key={b.id} className={b.status === 'cancelled' ? 'bg-ink/[0.03] text-ink/55' : 'hover:bg-pitch/5'}>
                  <td className="px-3 py-3 font-mono font-bold" dir="ltr">
                    {b.ref}
                  </td>
                  <td className="px-3 py-3 font-semibold">{loc(b.fieldName, lang)}</td>
                  <td className="px-3 py-3">
                    <TypeBadge type={b.fieldType} className="!px-2 !py-0.5 !text-sm" />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{formatDate(b.date, lang, { weekday: 'short', month: 'short' })}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {formatRange(b.startMinutes, b.durationMinutes, lang)}
                  </td>
                  <td className="px-3 py-3">
                    {b.customerName}
                    {b.notes && <span className="mt-0.5 block max-w-[200px] truncate text-xs text-ink/60" title={b.notes}>{b.notes}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3" dir="ltr">
                    <PhoneCell booking={b} />
                  </td>
                  <td className="px-3 py-3">{b.players ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold">{formatPrice(b.totalPrice, lang)}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        b.status === 'confirmed' ? 'bg-pitch/15 text-pitch-dark' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {b.status === 'confirmed' ? t.admin.confirmed : t.admin.cancelled}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {b.status === 'confirmed' ? (
                      <button type="button" onClick={() => setStatus(b, 'cancelled')} className="font-semibold text-red-700 hover:underline">
                        {t.admin.cancel}
                      </button>
                    ) : (
                      <button type="button" onClick={() => setStatus(b, 'confirmed')} className="font-semibold text-pitch hover:underline">
                        {t.admin.restore}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
