'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { CLOSE, OPEN, formatTime } from '@/lib/booking';
import { useLang } from '@/lib/i18n/LanguageProvider';
import { LogoMark } from '../layout/Logo';
import { PitchOutline } from '../ui/PitchDecor';
import { ArrowIcon } from '../ui/icons';
import { SearchBar } from './SearchBar';

export function Hero({ fieldCount }: { fieldCount: number }) {
  const { t, lang } = useLang();
  const reduce = useReducedMotion();
  const anim = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] } };

  return (
    <section className="bg-grass relative overflow-hidden" aria-labelledby="hero-title">
      <PitchOutline className="pointer-events-none absolute inset-0 h-full w-full text-white/[0.18]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-pitch-dark/50 via-transparent to-pitch-dark/60" />

      <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 sm:pt-20 lg:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div {...anim(0)} className="mb-5 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-pitch-dark/50 px-4 py-1.5 text-sm font-semibold backdrop-blur">
              <LogoMark className="h-5 w-5" />
              {t.hero.eyebrow}
            </span>
          </motion.div>
          <motion.h1 {...anim(0.08)} id="hero-title" className="heading text-balance text-[3.4rem] sm:text-7xl lg:text-8xl">
            {t.hero.title}
          </motion.h1>
          <motion.p {...anim(0.16)} className="mx-auto mt-5 max-w-xl text-base text-white/90 sm:text-lg">
            {t.hero.subtitle}
          </motion.p>
          <motion.div {...anim(0.24)} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/fields" className="btn-primary w-full !px-8 !text-base sm:w-auto">
              {t.hero.cta}
              <ArrowIcon width={18} height={18} className="rtl:rotate-180" />
            </Link>
            <a href="#how" className="btn-outline w-full sm:w-auto">
              {t.hero.secondary}
            </a>
          </motion.div>
        </div>

        <motion.div {...anim(0.32)} className="mx-auto mt-12 max-w-4xl">
          <SearchBar />
        </motion.div>

        <motion.dl {...anim(0.4)} className="mx-auto mt-10 grid max-w-3xl grid-cols-3 gap-3 text-center">
          {[
            [String(fieldCount), t.hero.statFields],
            [`${formatTime(OPEN, lang)} – ${formatTime(CLOSE, lang)}`, t.hero.statHours],
            [t.hero.statInstantValue, t.hero.statInstant],
          ].map(([value, label]) => (
            <div key={label} className="flex flex-col rounded-xl border border-white/15 bg-pitch-dark/40 px-2 py-3 backdrop-blur-sm">
              <dt className="order-2 text-xs text-white/80 sm:text-sm">{label}</dt>
              <dd dir="auto" className="order-1 font-display text-xl leading-tight text-card sm:text-3xl">
                {value}
              </dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}
