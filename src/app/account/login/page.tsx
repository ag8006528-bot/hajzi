import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CustomerAuthForm } from '@/components/account/CustomerAuthForm';
import { getCurrentCustomer } from '@/lib/auth';
import { safeNext } from '@/lib/safe-next';

export const metadata: Metadata = { title: 'Customer login', robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomerLoginPage({ searchParams }: { searchParams: SP }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentCustomer()) redirect(next);
  return <CustomerAuthForm mode="login" next={next} />;
}
