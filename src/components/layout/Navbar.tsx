'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@/lib/i18n/LanguageProvider';
import { Logo } from './Logo';
import { CloseIcon, GlobeIcon, MenuIcon, UserIcon } from '../ui/icons';

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, t, setLang, pending } = useLang();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
      aria-label={t.nav.switchLangLabel}
      lang={lang === 'en' ? 'ar' : 'en'}
      disabled={pending}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-white/40 px-3.5 text-sm font-semibold text-white transition hover:bg-white hover:text-pitch-dark disabled:opacity-60 ${className}`}
    >
      <GlobeIcon width={16} height={16} />
      {t.nav.switchLang}
    </button>
  );
}

export function Navbar({ customerName }: { customerName: string | null }) {
  const { t } = useLang();
  const account = customerName
    ? { href: '/account', label: t.nav.myAccount }
    : { href: '/login', label: t.nav.login };
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const links = [
    { href: '/', label: t.nav.home },
    { href: '/fields', label: t.nav.fields },
    { href: '/contact', label: t.nav.contact },
  ];
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        scrolled || open ? 'bg-pitch-dark/95 shadow-lg shadow-black/20 backdrop-blur' : 'bg-pitch-dark/70 backdrop-blur-sm'
      }`}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:text-ink">
        {t.nav.skip}
      </a>
      <nav aria-label={t.nav.mainNav} className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={`relative rounded-full px-4 py-2 text-[15px] font-semibold transition hover:bg-white/10 ${
                  isActive(l.href) ? 'text-card' : 'text-white'
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-3 md:flex">
          <LanguageToggle />
          <Link
            href={account.href}
            aria-current={pathname.startsWith(account.href) ? 'page' : undefined}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-white/40 px-4 text-sm font-semibold text-white transition hover:bg-white hover:text-pitch-dark"
          >
            <UserIcon width={16} height={16} />
            {account.label}
          </Link>
          <Link href="/fields" className="btn-primary !min-h-[40px] !px-5">
            {t.nav.bookNow}
          </Link>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <LanguageToggle className="!px-3" />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
            className="grid h-11 w-11 place-items-center rounded-full text-white hover:bg-white/10"
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/10 md:hidden"
          >
            <ul className="space-y-1 px-4 py-4">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={isActive(l.href) ? 'page' : undefined}
                    className={`block rounded-xl px-4 py-3 text-lg font-semibold hover:bg-white/10 ${isActive(l.href) ? 'text-card' : 'text-white'}`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={account.href}
                  className="flex items-center gap-2 rounded-xl px-4 py-3 text-lg font-semibold text-white hover:bg-white/10"
                >
                  <UserIcon width={20} height={20} />
                  {account.label}
                </Link>
              </li>
              <li className="pt-2">
                <Link href="/fields" className="btn-primary w-full">
                  {t.nav.bookNow}
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
