'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatDate, formatTime, minutesToHHMM } from '@/lib/booking';
import { fmt, formatPrice, loc } from '@/lib/i18n';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { Field, FieldType } from '@/lib/types';
import { isBookableOnline } from '@/lib/validation';
import { CenterCircle } from '../ui/PitchDecor';
import { FieldCard } from './FieldCard';

interface Props {
  fields: Field[];
  initialType: FieldType | '';
  date: string;
  start: number | null;
  availability?: Record<string, boolean>;
}

export function FieldsBrowser({ fields, initialType, date, start, availability }: Props) {
  const { t, lang } = useLang();
  const maxAll = Math.max(10, ...fields.map((f) => f.pricePerHour));
  const [type, setType] = useState<FieldType | ''>(initialType);
  const [area, setArea] = useState('');
  const [maxPrice, setMaxPrice] = useState(maxAll);

  const areas = useMemo(() => Array.from(new Set(fields.map((f) => f.area.en))).sort(), [fields]);
  const areaLabel = (en: string) => {
    const f = fields.find((x) => x.area.en === en);
    return f ? loc(f.area, lang) : en;
  };

  const filtered = fields.filter(
    (f) => (!type || f.type === type) && (!area || f.area.en === area) && f.pricePerHour <= maxPrice,
  );
  // Fields that are free at the searched time come first.
  // "Call to book" fields have no live availability, so they go after the bookable ones.
  const rank = (f: Field) => (isBookableOnline(f) ? 1 + Number(Boolean(availability?.[f.id])) : 0);
  const sorted = [...filtered].sort((a, b) => rank(b) - rank(a));

  const query = date ? `?date=${date}${start !== null ? `&time=${minutesToHHMM(start)}` : ''}` : '';
  const reset = () => {
    setType('');
    setArea('');
    setMaxPrice(maxAll);
  };

  return (
    <>
      <section className="relative overflow-hidden border-b-2 border-white/60 bg-pitch-dark">
        <CenterCircle className="pointer-events-none absolute -end-24 -top-28 h-96 w-96 text-white/10" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h1 className="heading text-5xl sm:text-7xl">{t.fields.title}</h1>
          <p className="mt-3 max-w-xl text-white/85 sm:text-lg">{t.fields.subtitle}</p>
          {availability && start !== null && (
            <p className="mt-4 inline-block rounded-full bg-card px-4 py-1.5 text-sm font-bold text-ink">
              {fmt(t.fields.showingFor, { date: formatDate(date, lang, { year: undefined }), time: formatTime(start, lang) })}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <form
          className="panel grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[auto_1fr_1fr_auto] lg:items-end"
          aria-label={t.fields.filters}
          onSubmit={(e) => e.preventDefault()}
        >
          <fieldset>
            <legend className="label">{t.fields.type}</legend>
            <div className="inline-flex rounded-full bg-ink/5 p-1" role="radiogroup">
              {(['', '5v5', '11v11'] as const).map((v) => (
                <label key={v || 'all'} className="cursor-pointer">
                  <input type="radio" name="type" value={v} checked={type === v} onChange={() => setType(v)} className="peer sr-only" />
                  <span
                    dir="ltr"
                    className="block min-w-[64px] rounded-full px-4 py-2 text-center text-sm font-bold text-ink/80 transition peer-checked:bg-pitch peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-card"
                  >
                    {v || t.fields.all}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="f-area" className="label">
              {t.fields.location}
            </label>
            <select id="f-area" className="input" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">{t.fields.allLocations}</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {areaLabel(a)}
                </option>
              ))}
            </select>
          </div>
          <div className={fields.some((f) => f.pricePerHour > 0) ? '' : 'hidden'}>
            <label htmlFor="f-price" className="label flex justify-between">
              <span>{t.fields.maxPrice}</span>
              <span className="text-pitch">{formatPrice(maxPrice, lang)}</span>
            </label>
            <input
              id="f-price"
              type="range"
              min={0}
              max={maxAll}
              step={5}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="h-11 w-full cursor-pointer accent-pitch"
            />
          </div>
          <button type="button" onClick={reset} className="btn-ghost">
            {t.fields.reset}
          </button>
        </form>

        <p className="mt-8 text-sm font-semibold text-white/90" aria-live="polite">
          {sorted.length === 1 ? t.fields.resultsOne : fmt(t.fields.results, { n: sorted.length })}
        </p>

        {sorted.length === 0 ? (
          <div className="panel-glass mt-6 p-10 text-center">
            <p className="text-lg">{t.fields.noResults}</p>
            <button type="button" onClick={reset} className="btn-primary mt-5">
              {t.fields.reset}
            </button>
          </div>
        ) : (
          <motion.ul layout className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {sorted.map((f) => (
                <motion.li
                  key={f.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25 }}
                >
                  <FieldCard
                    field={f}
                    index={fields.indexOf(f)}
                    query={query}
                    availability={
                      availability && start !== null ? { free: availability[f.id], timeLabel: formatTime(start, lang) } : undefined
                    }
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </>
  );
}
