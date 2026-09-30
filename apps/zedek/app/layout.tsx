import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Providers } from '../components/providers';
import { fontVariables } from './fonts';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Zedek — Scrinode',
    template: '%s · Zedek',
  },
  description: 'Scripture-grounded AI research. Studies, conversations and citations.',
  applicationName: 'Zedek',

  /*
   * Never indexed, and no Open Graph.
   *
   * Zedek holds a reader's private research (§3.3). `noindex` keeps it out of
   * search results; the absence of og: tags is the other half — a link pasted
   * into a chat should not render a preview card describing someone's study.
   */
  robots: { index: false, follow: false, nocache: true },

  icons: {
    icon: [
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },

  appleWebApp: { capable: true, title: 'Zedek', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Text scaling is an accessibility requirement (§32), so zoom is never
  // disabled — least of all on a surface whose whole content is reading.
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Set per request by middleware.ts. next-themes needs it to run its
  // pre-paint script under a nonce-based CSP.
  const nonce = (await headers()).get('x-nonce');

  return (
    // suppressHydrationWarning is required by next-themes, which sets
    // data-theme on <html> before React hydrates.
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body>
        <Providers {...(nonce ? { nonce } : {})}>{children}</Providers>
      </body>
    </html>
  );
}
