'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { business } from '@/config/business';
import { addDays, formatTime, getSlotStarts, minutesToHHMM, todayISO } from '@/lib/booking';
import { useLang } from '@/lib/i18n/LanguageProvider';
import { SearchIcon } from '../ui/icons';

export function SearchBar() {
  const { t, lang } = useLang();
  const router = useRouter();
  const [type, setType] = useState('');
  const [date, setDate] = useState(() => todayISO());
  const [time, setTime] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (type) q.set('type', type);
    if (date) q.set('date', date);
    if (time) q.set('time', time);
    router.push(`/fields${q.size ? `?${q}` : ''}`);
  };

  return (
    <form onSubmit={submit} className="panel grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end" role="search" aria-label={t.search.title}>
      <div>
        <label htmlFor="s-type" className="label">
          {t.search.type}
        </label>
        <select id="s-type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t.search.anyType}</option>
          <option value="5v5">5v5</option>
          <option value="11v11">11v11</option>
        </select>
      </div>
      <div>
        <label htmlFor="s-date" className="label">
          {t.search.date}
        </label>
        <input
          id="s-date"
          type="date"
          className="input"
          value={date}
          min={todayISO()}
          max={addDays(todayISO(), business.maxDaysAhead)}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="s-time" className="label">
          {t.search.time}
        </label>
        <select id="s-time" className="input" value={time} onChange={(e) => setTime(e.target.value)}>
          <option value="">{t.search.anyTime}</option>
          {getSlotStarts().map((m) => (
            <option key={m} value={minutesToHHMM(m)}>
              {formatTime(m, lang)}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn-primary h-[46px] sm:col-span-2 lg:col-span-1">
        <SearchIcon width={18} height={18} />
        {t.search.submit}
      </button>
    </form>
  );
}
