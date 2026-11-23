'use client';

import Link from 'next/link';
import { fmt, formatPrice, loc } from '@/lib/i18n';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { Field } from '@/lib/types';
import { isBookableOnline } from '@/lib/validation';
import { ArrowIcon, LightIcon, MapPinIcon } from '../ui/icons';
import { FieldArt } from './FieldArt';
import { TypeBadge } from './TypeBadge';

export function FieldCard({
  field,
  index = 0,
  availability,
  query = '',
}: {
  field: Field;
  index?: number;
  availability?: { free: boolean; timeLabel: string };
  query?: string;
}) {
  const { t, lang } = useLang();
  const name = loc(field.name, lang);
  const online = isBookableOnline(field);
  const href = `/fields/${field.id}${online ? query : ''}`;
  if (!online) availability = undefined;

  return (
    <article className="panel group relative flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-2xl focus-within:ring-4 focus-within:ring-card motion-reduce:hover:translate-y-0">
      <div className="relative aspect-[16/10] overflow-hidden bg-pitch">
        {field.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={field.images[0]}
            alt={fmt(t.field.photoAlt, { name })}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <FieldArt
            variant={index}
            type={field.type}
            label={fmt(t.field.placeholderAlt, { name })}
            className="h-full w-full transition duration-500 group-hover:scale-105"
          />
        )}
        <TypeBadge type={field.type} className="absolute start-3 top-3" />
        {availability && (
          <span
            className={`absolute bottom-3 start-3 rounded-full px-3 py-1 text-xs font-bold shadow ${
              availability.free ? 'bg-white text-pitch-dark' : 'bg-ink/85 text-white'
            }`}
          >
            {fmt(availability.free ? t.field.freeAt : t.field.bookedAt, { time: availability.timeLabel })}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-xl font-bold leading-tight">
          <Link href={href} className="after:absolute after:inset-0 focus:outline-none">
            {name}
          </Link>
        </h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink/75">
          <MapPinIcon width={16} height={16} className="shrink-0 text-pitch" />
          {loc(field.area, lang)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink/80">
          {!online && <span className="rounded-full bg-card px-2.5 py-1 text-ink">{t.field.callToBook}</span>}
          {field.surface !== 'unknown' && (
            <span className="rounded-full bg-pitch/10 px-2.5 py-1">{field.surface === 'natural' ? t.field.natural : t.field.artificial}</span>
          )}
          {field.lighting && (
            <span className="inline-flex items-center gap-1 rounded-full bg-pitch/10 px-2.5 py-1">
              <LightIcon width={13} height={13} /> {t.field.lit}
            </span>
          )}
          {field.size && <span dir="ltr" className="rounded-full bg-pitch/10 px-2.5 py-1">{field.size}</span>}
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          {field.pricePerHour > 0 ? (
            <p>
              {field.priceEstimated && <span className="text-lg font-bold text-pitch-dark">≈ </span>}
              <span className="text-2xl font-extrabold text-pitch-dark">{formatPrice(field.pricePerHour, lang)}</span>{' '}
              <span className="text-sm text-ink/70">{t.field.perHour}</span>
              {field.priceEstimated && <span className="block text-xs font-semibold text-ink/60">{t.field.approx}</span>}
            </p>
          ) : (
            <p className="text-sm font-bold text-pitch-dark">{t.field.callForPrice}</p>
          )}
          <span className="btn-dark relative z-10 !px-4 !text-sm pointer-events-none" aria-hidden="true">
            {online ? t.field.viewBook : t.field.viewDetails}
            <ArrowIcon width={16} height={16} className="rtl:rotate-180" />
          </span>
        </div>
      </div>
    </article>
  );
}
