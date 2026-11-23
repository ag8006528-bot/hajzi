import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Hero } from '@/components/home/Hero';
import { CtaBand, FeaturedFields } from '@/components/home/FeaturedFields';
import { HowItWorks } from '@/components/home/HowItWorks';
import { HalfwayDivider } from '@/components/ui/PitchDecor';
import { business, siteUrl } from '@/config/business';
import { getStore } from '@/lib/db';
import { getServerT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: { absolute: t.meta.homeTitle }, description: t.meta.homeDesc, alternates: { canonical: '/' } };
}

export default async function HomePage() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const fields = await getStore().listFields();
  const featured = fields.filter((f) => f.featured).slice(0, 6);
  const show = featured.length ? featured : fields.slice(0, 3);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: business.name,
    url: siteUrl,
    telephone: business.phone,
    email: business.email,
    address: business.address.en,
    geo: { '@type': 'GeoCoordinates', latitude: business.coordinates.lat, longitude: business.coordinates.lng },
  };

  return (
    <>
      {/* Static business config only (never user input); "<" escaped so the JSON can't close the tag. */}
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning // browsers hide nonce attributes from the DOM, which React reports as a mismatch
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <Hero fieldCount={fields.length} />
      <FeaturedFields fields={show} />
      <HalfwayDivider />
      <HowItWorks />
      <CtaBand />
    </>
  );
}
