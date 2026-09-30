import type { Metadata } from 'next';

/**
 * The reader's metadata — SEO, Open Graph, icons.
 *
 * Kept out of `layout.tsx` because there is enough of it to obscure the
 * layout, and because the values here are product copy that someone may want
 * to change without reading React.
 */

/**
 * The origin this deployment serves from.
 *
 * Open Graph and Twitter require **absolute** URLs — a relative `/og.png` is
 * silently ignored by every scraper, so a card either shows nothing or shows
 * whatever the platform guesses. `metadataBase` is what turns the relative
 * paths below into absolute ones.
 *
 * Resolution order, and each step matters:
 *
 *   1. `NEXT_PUBLIC_SITE_URL` — set it explicitly in production.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel provides this, and it names
 *      the *production* domain even when read from a preview build. Using
 *      `VERCEL_URL` instead would point every preview's cards at that
 *      preview's throwaway hostname.
 *   3. localhost, for development.
 *
 * Never a bare guess at scrinode.com: a wrong absolute URL is worse than a
 * missing one, because it points scrapers at content that is not there.
 */
function resolveSiteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);

  return new URL('http://localhost:3000');
}

export const SITE_URL = resolveSiteUrl();

/** One sentence, under 160 characters so search results do not truncate it. */
const DESCRIPTION =
  'AI-powered Bible search, study, and ministry workspace. Explore Scripture, original languages, cross-references and context — with answers grounded in the text.';

export const metadata: Metadata = {
  metadataBase: SITE_URL,

  title: {
    // The home page's own title. `template` applies to every other route, so
    // /scripture becomes "Scripture · Scrinode" without repeating the brand
    // in each file.
    default: 'Scrinode — Scripture, Study, and AI, Unified',
    template: '%s · Scrinode',
  },

  description: DESCRIPTION,

  applicationName: 'Scrinode',

  // Terms a reader would actually type. Search engines ignore the keywords
  // meta, but some internal tools and link previewers still read it.
  keywords: [
    'Bible study',
    'Bible search',
    'Scripture research',
    'sermon preparation',
    'biblical Greek',
    'biblical Hebrew',
    'cross references',
    'ministry workspace',
  ],

  authors: [{ name: 'Scrinode' }],
  creator: 'Scrinode',
  publisher: 'Scrinode',

  // The home page is the canonical entry. Without this, a page reached with
  // tracking parameters is indexed as a separate URL.
  alternates: { canonical: '/' },

  openGraph: {
    type: 'website',
    siteName: 'Scrinode',
    title: 'Scrinode — Scripture, Study, and AI, Unified',
    description: DESCRIPTION,
    url: '/',
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image.jpg',
        width: 1200,
        height: 630,
        // Read aloud by screen readers on some platforms, so it describes the
        // image rather than repeating the title (§32).
        alt: 'Scrinode — a Bible reader with Zedek AI answering a question about John 1:5',
      },
    ],
  },

  twitter: {
    // The large card. `summary` crops to a square and loses the layout.
    card: 'summary_large_image',
    title: 'Scrinode — Scripture, Study, and AI, Unified',
    description: DESCRIPTION,
    images: ['/opengraph-image.jpg'],
  },

  icons: {
    icon: [
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    // iOS composites this onto the home screen, so it is opaque on the brand
    // ink. A transparent PNG renders as a black square there.
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },

  manifest: '/manifest.webmanifest',

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Let Google show a full text snippet and a large image preview rather
      // than the conservative defaults.
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },

  // Tells iOS Safari to tint the status bar rather than leaving it white
  // against the dark hero.
  appleWebApp: {
    capable: true,
    title: 'Scrinode',
    statusBarStyle: 'black-translucent',
  },

  formatDetection: {
    // Stops iOS turning verse references like "1 Cor 13" into phone links.
    telephone: false,
  },
};
