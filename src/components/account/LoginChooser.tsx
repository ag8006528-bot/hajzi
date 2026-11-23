'use client';

import Link from 'next/link';
import { useLang } from '@/lib/i18n/LanguageProvider';
import { ArrowIcon, LockIcon, UsersIcon } from '../ui/icons';

export function LoginChooser() {
  const { t } = useLang();
  const options = [
    { href: '/account/login', title: t.auth.customer, desc: t.auth.customerDesc, Icon: UsersIcon, accent: 'bg-card text-ink' },
    { href: '/admin/login', title: t.auth.staff, desc: t.auth.staffDesc, Icon: LockIcon, accent: 'bg-pitch text-card' },
  ];
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:py-20">
      <div className="text-center">
        <h1 className="heading text-5xl sm:text-6xl">{t.auth.chooseTitle}</h1>
        <p className="mt-3 text-white/85 sm:text-lg">{t.auth.chooseSubtitle}</p>
      </div>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2">
        {options.map(({ href, title, desc, Icon, accent }) => (
          <li key={href}>
            <Link
              href={href}
              className="panel group flex h-full flex-col items-center p-7 text-center transition hover:-translate-y-1 hover:shadow-2xl motion-reduce:hover:translate-y-0"
            >
              <span className={`grid h-16 w-16 place-items-center rounded-full ${accent}`}>
                <Icon width={28} height={28} />
              </span>
              <span className="mt-4 text-2xl font-bold">{title}</span>
              <span className="mt-2 text-sm text-ink/70">{desc}</span>
              <span className="btn-dark mt-6 !min-h-[40px]">
                {t.auth.signIn}
                <ArrowIcon width={16} height={16} className="rtl:rotate-180" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
