import type { Metadata, Viewport } from 'next';
// Fonts are bundled with the site (no download from Google at build or run time).
import '@fontsource/bebas-neue/400.css';
import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/cairo/index.css';
import { siteUrl } from '@/config/business';
import { dirOf } from '@/lib/i18n';
import { getServerT } from '@/lib/i18n/server';
import { getCurrentCustomer } from '@/lib/auth';
import { LanguageProvider } from '@/lib/i18n/LanguageProvider';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await getServerT();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: t.meta.homeTitle, template: '%s | HAJZI' },
    description: t.meta.homeDesc,
    applicationName: 'HAJZI',
    keywords: ['football field booking', 'pitch reservation', '5v5', '11v11', 'Amman', 'حجز ملعب', 'ملاعب كرة قدم'],
    openGraph: {
      type: 'website',
      siteName: 'HAJZI',
      title: t.meta.homeTitle,
      description: t.meta.homeDesc,
      locale: lang === 'ar' ? 'ar_JO' : 'en_US',
      alternateLocale: lang === 'ar' ? 'en_US' : 'ar_JO',
    },
    twitter: { card: 'summary_large_image', title: t.meta.homeTitle, description: t.meta.homeDesc },
  };
}

export const viewport: Viewport = {
  themeColor: '#0F4D26',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang } = await getServerT();
  const customer = await getCurrentCustomer();
  return (
    <html lang={lang} dir={dirOf(lang)}>
      <body className="bg-grass-h flex min-h-screen flex-col">
        <LanguageProvider initialLang={lang}>
          <Navbar customerName={customer?.name ?? null} />
          <main id="main" className="flex-1" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
