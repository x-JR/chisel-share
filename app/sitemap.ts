import type { MetadataRoute } from 'next';
import { getAllSchematicIdsForSitemap, getAllCollectionIdsForSitemap } from '@/lib/db';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chiselshare.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [schematics, collections] = await Promise.all([
    getAllSchematicIdsForSitemap(),
    getAllCollectionIdsForSitemap(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/how-to`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];

  const schematicPages: MetadataRoute.Sitemap = schematics.map((s) => ({
    url: `${siteUrl}/view/${s.id}`,
    lastModified: new Date(s.uploaded_at * 1000),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const collectionPages: MetadataRoute.Sitemap = collections.map((c) => ({
    url: `${siteUrl}/view/collection/${c.id}`,
    lastModified: new Date(c.created_at * 1000),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticPages, ...schematicPages, ...collectionPages];
}
