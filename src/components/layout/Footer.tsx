'use client';

import Link from 'next/link';
import { business } from '@/config/business';
import { loc } from '@/lib/i18n';
import { useLang } from '@/lib/i18n/LanguageProvider';
import { Logo } from './Logo';
import { InstagramIcon, MailIcon, MapPinIcon } from '../ui/icons';

export function Footer() {
  const { t, lang } = useLang();
  const year = new Date().getFullYear();
  const social = [
    { href: business.social.instagram, label: 'Instagram', Icon: InstagramIcon },
  ];

  return (
    <footer className="bg-grass-dark relative overflow-hidden border-t-4 border-white/80">
      {/* goal-line arc */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 start-1/2 h-48 w-48 -translate-x-1/2 rounded-full border-2 border-white/15 rtl:translate-x-1/2" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-white/80">{t.footer.tagline}</p>
          <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-white/70">{t.footer.follow}</h2>
          <ul className="mt-3 flex gap-2">
            {social.map(({ href, label, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/30 text-white transition hover:border-card hover:bg-card hover:text-ink"
                >
                  <Icon />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">{t.footer.explore}</h2>
          <ul className="mt-4 space-y-2.5">
            {[
              ['/', t.nav.home],
              ['/fields', t.nav.fields],
              ['/contact', t.nav.contact],
              ['/privacy', t.footer.privacy],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="text-white/90 underline-offset-4 hover:text-card hover:underline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">{t.footer.contact}</h2>
          <ul className="mt-4 space-y-3 text-white/90">
            <li className="flex gap-2.5">
              <MailIcon className="mt-0.5 shrink-0 text-card" width={18} height={18} />
              <a href={`mailto:${business.email}`} className="break-all hover:text-card">
                {business.email}
              </a>
            </li>
            <li className="flex gap-2.5">
              <MapPinIcon className="mt-0.5 shrink-0 text-card" width={18} height={18} />
              <span>{loc(business.address, lang)}</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-sm text-white/70">
          © {year} HAJZI. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
