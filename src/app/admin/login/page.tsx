import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/LoginForm';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Admin login', robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (await getCurrentUser()) redirect('/admin');
  return <LoginForm />;
}
