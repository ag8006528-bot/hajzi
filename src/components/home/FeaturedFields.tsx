'use client';

import Link from 'next/link';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { Field } from '@/lib/types';
import { FieldCard } from '../fields/FieldCard';
import { FadeIn } from '../ui/FadeIn';
import { ArrowIcon } from '../ui/icons';
import { SectionHeading } from '../ui/PitchDecor';

export function FeaturedFields({ fields }: { fields: Field[] }) {
  const { t } = useLang();
  return (
    <section className="py-20" aria-labelledby="featured-title">
      <div className="mx-auto max-w-6xl px-4">
        <div id="featured-title">
          <SectionHeading title={t.featured.title} subtitle={t.featured.subtitle} />
        </div>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f, i) => (
            <li key={f.id}>
              <FadeIn delay={i * 0.08} className="h-full">
                <FieldCard field={f} index={i} />
              </FadeIn>
            </li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <Link href="/fields" className="btn-outline">
            {t.featured.viewAll}
            <ArrowIcon width={18} height={18} className="rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function CtaBand() {
  const { t } = useLang();
  return (
    <section className="px-4 pb-20" aria-labelledby="cta-title">
      <FadeIn className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border-2 border-white/70 bg-pitch-dark px-6 py-12 text-center shadow-panel sm:px-12">
        {/* penalty box + arc */}
        <span aria-hidden="true" className="absolute -bottom-px start-1/2 h-16 w-64 -translate-x-1/2 border-2 border-b-0 border-white/25 rtl:translate-x-1/2" />
        <span aria-hidden="true" className="absolute -top-20 start-1/2 h-40 w-40 -translate-x-1/2 rounded-full border-2 border-white/25 rtl:translate-x-1/2" />
        <h2 id="cta-title" className="heading relative text-4xl sm:text-6xl">
          {t.cta.title}
        </h2>
        <p className="relative mx-auto mt-3 max-w-lg text-white/85">{t.cta.text}</p>
        <Link href="/fields" className="btn-primary relative mt-7 !px-8">
          {t.cta.button}
          <ArrowIcon width={18} height={18} className="rtl:rotate-180" />
        </Link>
      </FadeIn>
    </section>
  );
}
