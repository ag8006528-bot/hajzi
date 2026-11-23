import type { Metadata } from 'next';
import { LoginChooser } from '@/components/account/LoginChooser';
import { getServerT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: t.auth.chooseTitle, robots: { index: false, follow: true } };
}

export default function LoginPage() {
  return <LoginChooser />;
}
