import type { MetadataRoute } from 'next';
import { siteUrl } from '@/config/business';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fields = await getStore().listFields();
  const now = new Date();
  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/fields`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    ...fields.map((f) => ({ url: `${siteUrl}/fields/${f.id}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.8 })),
  ];
}
