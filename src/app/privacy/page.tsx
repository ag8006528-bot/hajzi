import type { Metadata } from 'next';
import Link from 'next/link';
import { business } from '@/config/business';
import { getServerT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: t.privacy.title, description: t.privacy.intro, alternates: { canonical: '/privacy' } };
}

export default async function PrivacyPage() {
  const { t } = await getServerT();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="heading text-5xl sm:text-6xl">{t.privacy.title}</h1>
      <p className="mt-2 text-sm text-white/75">{t.privacy.updated}</p>
      <div className="panel mt-8 space-y-6 p-6 sm:p-8">
        <p className="text-lg">{t.privacy.intro}</p>
        {t.privacy.sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-xl font-bold text-pitch-dark">{s.h}</h2>
            <p className="mt-2 leading-relaxed text-ink/85">{s.p}</p>
          </section>
        ))}
        <p className="border-t border-ink/10 pt-5 text-sm text-ink/75">
          <Link href="/contact" className="font-semibold text-pitch underline">
            {t.nav.contact}
          </Link>{' '}
          · <a href={`mailto:${business.email}`} className="text-pitch underline">{business.email}</a>
        </p>
      </div>
    </div>
  );
}
