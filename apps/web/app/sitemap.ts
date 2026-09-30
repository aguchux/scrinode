import type { MetadataRoute } from 'next';
import { SITE_URL } from './metadata';

/**
 * Served at `/sitemap.xml`.
 *
 * Only routes that exist. The header lists Scripture, Study, Zedek,
 * Workspaces and Library, but none of them is built — listing them here would
 * send crawlers to 404s, which costs crawl budget and teaches search engines
 * the site is unreliable. Each becomes an entry when it ships, the same
 * discipline as the nav's `ready` flag.
 *
 * `lastModified` is a build-time constant rather than `new Date()`: a sitemap
 * regenerated on every request claims everything changed on every request,
 * which crawlers learn to ignore.
 */
const LAST_MODIFIED = new Date('2026-09-30');

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL('/', SITE_URL).toString(),
      lastModified: LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: new URL('/signin', SITE_URL).toString(),
      lastModified: LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
