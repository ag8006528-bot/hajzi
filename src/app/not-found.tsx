import Link from 'next/link';
import { getServerT } from '@/lib/i18n/server';
import { CenterCircle } from '@/components/ui/PitchDecor';

export default async function NotFound() {
  const { t } = await getServerT();
  return (
    <div className="relative overflow-hidden">
      <CenterCircle className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 text-white/10" />
      <div className="relative mx-auto max-w-xl px-4 py-28 text-center">
        <p className="mx-auto mb-6 h-20 w-14 rotate-6 rounded-md bg-card shadow-panel" aria-hidden="true" />
        <h1 className="heading text-6xl sm:text-7xl">{t.notFound.title}</h1>
        <p className="mt-3 text-lg text-white/85">{t.notFound.text}</p>
        <Link href="/" className="btn-primary mt-8">
          {t.notFound.back}
        </Link>
      </div>
    </div>
  );
}
