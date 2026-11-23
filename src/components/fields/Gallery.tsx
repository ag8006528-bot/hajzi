'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fmt } from '@/lib/i18n';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { FieldType } from '@/lib/types';
import { FieldArt } from './FieldArt';
import { TypeBadge } from './TypeBadge';

export function Gallery({ images, name, type }: { images: string[]; name: string; type: FieldType }) {
  const { t } = useLang();
  // Use real images when provided, otherwise 4 illustrated placeholders.
  const items = images.length ? images.map((src) => ({ src })) : [0, 1, 2, 3].map((v) => ({ variant: v }));
  const [active, setActive] = useState(0);

  const render = (i: number, cls: string) => {
    const it = items[i] as { src?: string; variant?: number };
    return it.src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={it.src} alt={fmt(t.field.photoAlt, { name })} className={`${cls} object-cover`} loading={i === 0 ? 'eager' : 'lazy'} />
    ) : (
      <FieldArt variant={it.variant} type={type} label={fmt(t.field.placeholderAlt, { name })} className={cls} />
    );
  };

  return (
    <section aria-label={t.field.gallery}>
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border-2 border-white/80 bg-pitch shadow-panel">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {render(active, 'h-full w-full')}
          </motion.div>
        </AnimatePresence>
        <TypeBadge type={type} size="lg" className="absolute start-4 top-4" />
      </div>
      {items.length > 1 && (
        <ul className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
          {items.map((_, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={fmt(t.field.showImage, { n: i + 1 })}
                aria-pressed={active === i}
                className={`block aspect-[16/10] w-full overflow-hidden rounded-lg border-2 transition ${
                  active === i ? 'border-card shadow-glow' : 'border-white/40 opacity-75 hover:opacity-100'
                }`}
              >
                <span aria-hidden="true" className="pointer-events-none block h-full w-full">
                  {render(i, 'h-full w-full')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
