'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatTime, getSlotStarts, overlaps, todayISO } from '@/lib/booking';
import { loc } from '@/lib/i18n';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { BusyInterval, Field } from '@/lib/types';
import { SpinnerIcon } from '../ui/icons';

export function AvailabilityTab({ fields }: { fields: Field[] }) {
  const { t, lang } = useLang();
  const [fieldId, setFieldId] = useState(fields[0]?.id ?? '');
  const [date, setDate] = useState(() => todayISO());
  const [busy, setBusy] = useState<BusyInterval[] | null>(null);
  const [working, setWorking] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!fieldId) return;
    setBusy(null);
    const res = await fetch(`/api/blocks?fieldId=${encodeURIComponent(fieldId)}&date=${date}`, { cache: 'no-store' });
    setBusy(res.ok ? (await res.json()).busy : []);
  }, [fieldId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (s: number) => {
    if (!busy) return;
    const block = busy.find((b) => b.kind === 'block' && b.start === s);
    setWorking(s);
    const res = block
      ? await fetch(`/api/blocks?id=${block.blockId}&fieldId=${encodeURIComponent(fieldId)}&date=${date}`, { method: 'DELETE' })
      : await fetch('/api/blocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldId, date, startMinutes: s }),
        });
    if (!res.ok) window.alert(t.admin.error);
    setWorking(null);
    load();
  };

  return (
    <div className="panel p-5">
      <div className="grid gap-3 sm:grid-cols-2 sm:max-w-xl">
        <div>
          <label htmlFor="av-field" className="label">
            {t.admin.filterField}
          </label>
          <select id="av-field" className="input" value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {loc(f.name, lang)} ({f.type})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="av-date" className="label">
            {t.admin.filterDate}
          </label>
          <input id="av-date" type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
      </div>
      <p className="mt-4 text-sm text-ink/70">{t.admin.availHelp}</p>

      {!busy ? (
        <div className="py-10 text-center">
          <SpinnerIcon className="mx-auto" />
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {getSlotStarts().map((s) => {
            const booked = busy.some((b) => b.kind === 'booking' && overlaps(s, 60, b.start, b.duration));
            const blocked = busy.some((b) => b.kind === 'block' && b.start === s);
            const state = booked ? t.booking.booked : blocked ? t.admin.blocked : t.admin.free;
            return (
              <li key={s}>
                <button
                  type="button"
                  disabled={booked || working !== null}
                  onClick={() => toggle(s)}
                  aria-pressed={blocked}
                  className={`flex h-14 w-full flex-col items-center justify-center rounded-xl border-2 text-sm font-bold transition disabled:cursor-not-allowed ${
                    booked
                      ? 'border-transparent bg-ink/10 text-ink/60'
                      : blocked
                        ? 'border-red-600 bg-red-50 text-red-800'
                        : 'border-pitch/30 hover:border-pitch hover:bg-pitch/5'
                  }`}
                >
                  <span>{working === s ? <SpinnerIcon width={16} height={16} /> : formatTime(s, lang)}</span>
                  <span className="text-[11px] font-semibold">{state}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
