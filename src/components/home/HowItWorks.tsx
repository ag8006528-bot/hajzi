'use client';

import { useLang } from '@/lib/i18n/LanguageProvider';
import { FadeIn } from '../ui/FadeIn';
import { CalendarIcon, CheckIcon, MapPinIcon } from '../ui/icons';
import { SectionHeading } from '../ui/PitchDecor';

const icons = [MapPinIcon, CalendarIcon, CheckIcon];

export function HowItWorks() {
  const { t } = useLang();
  return (
    <section id="how" className="relative scroll-mt-20 py-20" aria-labelledby="how-title">
      <div className="mx-auto max-w-6xl px-4">
        <div id="how-title">
          <SectionHeading title={t.how.title} subtitle={t.how.subtitle} />
        </div>
        <ol className="relative mt-14 grid gap-6 md:grid-cols-3">
          {/* chalk line connecting the steps */}
          <span aria-hidden="true" className="absolute inset-x-[16%] top-10 hidden h-[2px] border-t-2 border-dashed border-white/40 md:block" />
          {t.how.steps.map((step, i) => {
            const Icon = icons[i];
            return (
              <li key={step.title} className="relative">
                <FadeIn delay={i * 0.1} className="flex flex-col items-center text-center">
                  <span className="relative grid h-20 w-20 place-items-center rounded-full border-[3px] border-white bg-pitch-dark shadow-lg">
                    <Icon width={30} height={30} className="text-card" />
                    <span className="absolute -end-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-card font-display text-lg text-ink">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="heading mt-5 text-3xl">{step.title}</h3>
                  <p className="mt-2 max-w-xs text-white/85">{step.text}</p>
                </FadeIn>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
