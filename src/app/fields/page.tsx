import type { Metadata } from 'next';
import { FieldsBrowser } from '@/components/fields/FieldsBrowser';
import { hhmmToMinutes, isFree, isValidDate } from '@/lib/booking';
import { getStore } from '@/lib/db';
import { getServerT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return {
    title: t.meta.fieldsTitle,
    description: t.meta.fieldsDesc,
    alternates: { canonical: '/fields' },
    openGraph: { title: `${t.meta.fieldsTitle} | HAJZI`, description: t.meta.fieldsDesc },
  };
}

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function FieldsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const store = getStore();
  const fields = await store.listFields();

  const type = one(sp.type);
  const date = one(sp.date);
  const time = one(sp.time);
  const start = time ? hhmmToMinutes(time) : null;

  // If the customer searched for a specific date+time, show whether each field is free then.
  let availability: Record<string, boolean> | undefined;
  if (isValidDate(date) && start !== null) {
    availability = {};
    for (const f of fields) availability[f.id] = isFree(await store.getBusy(f.id, date), start, 60);
  }

  return (
    <FieldsBrowser
      fields={fields}
      initialType={type === '5v5' || type === '11v11' ? type : ''}
      date={isValidDate(date) ? date : ''}
      start={start}
      availability={availability}
    />
  );
}
