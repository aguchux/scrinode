import type { MetadataRoute } from 'next';
import { SITE_URL } from './metadata';

/**
 * Served at `/robots.txt`.
 *
 * Allows the reader, disallows the two paths that should never be indexed:
 * the auth routes, which produce an endless set of callback URLs, and any
 * future admin path. §51 puts the backoffice on its own origin with its own
 * noindex, so this is defence in depth rather than the primary control.
 *
 * The sitemap is named absolutely because crawlers require it — a relative
 * path there is ignored.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: new URL('/sitemap.xml', SITE_URL).toString(),
  };
}
