import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FieldDetails } from '@/components/fields/FieldDetails';
import { hhmmToMinutes, isPast, isTooFarAhead, isValidDate, todayISO } from '@/lib/booking';
import { getCurrentCustomer } from '@/lib/auth';
import { getStore } from '@/lib/db';
import { loc } from '@/lib/i18n';
import { getServerT } from '@/lib/i18n/server';

type Params = Promise<{ id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const field = await getStore().getField(id);
  if (!field) return { title: 'Not found' };
  const { lang } = await getServerT();
  const name = loc(field.name, lang);
  const description = `${name} · ${field.type} · ${loc(field.area, lang)} — ${loc(field.description, lang)}`.slice(0, 160);
  return {
    title: `${name} (${field.type})`,
    description,
    alternates: { canonical: `/fields/${field.id}` },
    openGraph: { title: `${name} (${field.type}) | HAJZI`, description, images: field.images[0] ? [field.images[0]] : undefined },
  };
}

export default async function FieldPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const field = await getStore().getField(id);
  if (!field) notFound();

  const d = one(sp.date);
  const initialDate = isValidDate(d) && !isTooFarAhead(d) && d >= todayISO() ? d : todayISO();
  const tm = one(sp.time);
  const s = tm ? hhmmToMinutes(tm) : null;
  const initialStart = s !== null && !isPast(initialDate, s) ? s : null;

  const customer = await getCurrentCustomer();
  return (
    <FieldDetails
      field={field}
      initialDate={initialDate}
      initialStart={initialStart}
      customer={customer ? { name: customer.name, phone: customer.phone } : null}
    />
  );
}
