import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { getCurrentUser, toPublicUser } from '@/lib/auth';
import { getStore } from '@/lib/db';

export const metadata: Metadata = { title: 'Admin Dashboard', robots: { index: false, follow: false } };

export default async function AdminPage() {
  // Server-side session check (middleware only checks that a cookie exists).
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  const fields = await getStore().listFields();
  return <AdminDashboard initialFields={fields} user={toPublicUser(user)} />;
}
