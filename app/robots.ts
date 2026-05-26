import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chisel.tekkie.com.au';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/upload/', '/upload/collection/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
