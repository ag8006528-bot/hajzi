import type { Metadata } from 'next';
import { ContactView } from '@/components/contact/ContactView';
import { getServerT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return {
    title: t.meta.contactTitle,
    description: t.meta.contactDesc,
    alternates: { canonical: '/contact' },
    openGraph: { title: `${t.meta.contactTitle} | HAJZI`, description: t.meta.contactDesc },
  };
}

export default function ContactPage() {
  return <ContactView />;
}
