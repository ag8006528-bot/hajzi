import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SetupForm } from '@/components/admin/SetupForm';
import { activeSetupCode, getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Create account', robots: { index: false, follow: false } };

export default async function AdminSetupPage() {
  if (await getCurrentUser()) redirect('/admin');
  // Brand-new site: put the one-time first-admin code in the server logs (only the site owner can read them).
  const active = await activeSetupCode();
  // (Written directly, on purpose: the normal logger redacts anything that looks like a code.)
  if (active?.source === 'first-admin')
    console.warn(`HAJZI first admin setup code: ${active.code} (works only until the first admin account is created)`);
  return <SetupForm />;
}
