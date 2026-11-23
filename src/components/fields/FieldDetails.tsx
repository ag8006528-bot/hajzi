'use client';

import Link from 'next/link';
import { mapLink, placeLink, telHref, whatsappHref } from '@/config/business';
import { fmt, formatPrice, loc } from '@/lib/i18n';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { Amenity, Field } from '@/lib/types';
import { isBookableOnline } from '@/lib/validation';
import { BookingWidget } from '../booking/BookingWidget';
import {
  ArrowIcon,
  CameraIcon,
  CarIcon,
  CoffeeIcon,
  GrassIcon,
  LightIcon,
  MapPinIcon,
  PhoneIcon,
  RulerIcon,
  ShirtIcon,
  ShowerIcon,
  UsersIcon,
  WhatsAppIcon,
} from '../ui/icons';
import { Gallery } from './Gallery';
import { MapEmbed } from './MapEmbed';
import { TypeBadge } from './TypeBadge';

const amenityIcon: Record<Amenity, typeof CarIcon> = {
  parking: CarIcon,
  changingRooms: ShirtIcon,
  showers: ShowerIcon,
  cafe: CoffeeIcon,
};

export function FieldDetails({
  field,
  initialDate,
  initialStart,
  customer,
}: {
  field: Field;
  initialDate: string;
  initialStart: number | null;
  customer: { name: string; phone: string } | null;
}) {
  const { t, lang } = useLang();
  const name = loc(field.name, lang);
  const online = isBookableOnline(field);
  const surfaceLabel = field.surface === 'natural' ? t.field.natural : field.surface === 'artificial' ? t.field.artificial : t.field.unknown;

  const specs = [
    { Icon: UsersIcon, label: t.field.typeLabel, value: fmt(t.field.players, { n: field.type === '5v5' ? 5 : 11 }) },
    { Icon: RulerIcon, label: t.field.size, value: field.size || (online ? '—' : t.field.unknown), ltr: Boolean(field.size) },
    { Icon: GrassIcon, label: t.field.surface, value: surfaceLabel },
    { Icon: LightIcon, label: t.field.lighting, value: field.lighting ? t.field.lit : online ? t.field.notLit : t.field.unknown },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <Link href="/fields" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-card">
        <ArrowIcon width={16} height={16} className="rotate-180 rtl:rotate-0" />
        {t.field.back}
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <TypeBadge type={field.type} />
            <span className="flex items-center gap-1.5 text-white/85">
              <MapPinIcon width={16} height={16} />
              {loc(field.area, lang)}
            </span>
          </div>
          <h1 className="heading mt-3 text-5xl sm:text-6xl">{name}</h1>
        </div>
        <p className="rounded-2xl bg-pitch-dark/60 px-5 py-3 backdrop-blur">
          {field.pricePerHour > 0 ? (
            <>
              {field.priceEstimated && <span className="text-2xl text-card">≈ </span>}
              <span className="font-display text-4xl text-card">{formatPrice(field.pricePerHour, lang)}</span>{' '}
              <span className="text-white/80">{t.field.perHour}</span>
              {field.priceEstimated && (
                <span className="ms-2 rounded-full bg-card px-2 py-0.5 text-xs font-bold text-ink">{t.field.approx}</span>
              )}
              {(field.priceEstimated || (field.priceSource && loc(field.priceSource, lang))) && (
                <span className="mt-1 block max-w-[280px] text-xs text-white/75">
                  {field.priceEstimated ? t.field.approxNote : fmt(t.field.priceFrom, { source: loc(field.priceSource!, lang) })}
                </span>
              )}
            </>
          ) : (
            <span className="text-xl font-bold text-card">{t.field.callForPrice}</span>
          )}
        </p>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <div className="min-w-0 space-y-8">
          <div>
            <Gallery images={field.images} name={name} type={field.type} />
            <a
              href={placeLink(field.mapsQuery || field.name.en, field.coordinates.lat, field.coordinates.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-ink shadow hover:bg-card focus:outline-none focus-visible:ring-4 focus-visible:ring-card"
            >
              <CameraIcon width={18} height={18} className="text-pitch" />
              {t.field.photosOnGoogle}
              <span className="sr-only"> ({t.field.opensNewTab})</span>
            </a>
          </div>

          {loc(field.description, lang) && <p className="text-lg leading-relaxed text-white/90">{loc(field.description, lang)}</p>}

          <section aria-labelledby="details-title" className="panel p-5 sm:p-6">
            <h2 id="details-title" className="text-xl font-bold">
              {t.field.details}
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              {specs.map(({ Icon, label, value, ltr }) => (
                <div key={label} className="rounded-xl bg-pitch/[0.07] p-3.5">
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/70">
                    <Icon width={15} height={15} className="text-pitch" />
                    {label}
                  </dt>
                  <dd className="mt-1 font-bold" dir={ltr ? 'ltr' : undefined}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {field.amenities.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-ink/70">{t.field.amenities}</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {field.amenities.map((a) => {
                    const Icon = amenityIcon[a];
                    return (
                      <li key={a} className="inline-flex items-center gap-1.5 rounded-full border border-pitch/25 bg-white px-3.5 py-2 text-sm font-semibold">
                        <Icon width={16} height={16} className="text-pitch" />
                        {t.field.amenity[a]}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <section aria-labelledby="location-title" className="space-y-4">
            <h2 id="location-title" className="heading text-3xl">
              {t.field.location}
            </h2>
            <p className="flex items-start gap-2 text-white/90">
              <MapPinIcon className="mt-0.5 shrink-0 text-card" />
              <span>{loc(field.address, lang)}</span>
            </p>
            <MapEmbed lat={field.coordinates.lat} lng={field.coordinates.lng} title={fmt(t.field.mapTitle, { name })} />
            <div className="flex flex-wrap gap-3">
              <a href={telHref(field.phone)} className="btn-primary">
                <PhoneIcon width={18} height={18} />
                {t.field.call} <span dir="ltr">{field.phone}</span>
              </a>
              <a
                href={whatsappHref(field.whatsapp, `${name} — HAJZI`)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn bg-[#25D366] text-ink hover:bg-[#3ee07b]"
              >
                <WhatsAppIcon width={18} height={18} />
                {t.field.whatsapp}
              </a>
              <a href={mapLink(field.coordinates.lat, field.coordinates.lng)} target="_blank" rel="noopener noreferrer" className="btn-outline">
                <MapPinIcon width={18} height={18} />
                {t.field.directions}
              </a>
            </div>
          </section>
        </div>

        <div className="min-w-0 lg:sticky lg:top-20">
          {online ? (
            <BookingWidget field={field} initialDate={initialDate} initialStart={initialStart} customer={customer} />
          ) : (
            <section aria-labelledby="call-title" className="panel p-5 sm:p-6">
              <span className="inline-flex rounded-full bg-card px-3 py-1 text-xs font-bold text-ink">{t.field.callToBook}</span>
              <h2 id="call-title" className="mt-3 text-2xl font-bold">
                {t.field.callToBookTitle}
              </h2>
              <p className="mt-2 text-ink/80">{t.field.callToBookText}</p>
              <div className="mt-5 grid gap-3">
                <a href={telHref(field.phone)} className="btn-primary justify-center">
                  <PhoneIcon width={18} height={18} />
                  {t.field.call} <span dir="ltr">{field.phone}</span>
                </a>
                <a
                  href={whatsappHref(field.whatsapp, `${name} — HAJZI`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn justify-center bg-[#25D366] text-ink hover:bg-[#3ee07b]"
                >
                  <WhatsAppIcon width={18} height={18} />
                  {t.field.whatsapp}
                </a>
              </div>
              <p className="mt-4 text-xs text-ink/65">{t.field.publicInfo}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
