import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '../components/providers';
import { fontVariables } from './fonts';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Scrinode Backoffice',
    template: '%s · Backoffice',
  },
  description: 'Internal operations',
  applicationName: 'Scrinode Backoffice',

  /*
   * Never indexed, never previewed, never cached by a search engine (§51).
   * `nosnippet` and `noarchive` matter here beyond `noindex`: an admin page
   * that leaked into a cache would expose operational detail even after the
   * URL stopped resolving.
   */
  robots: {
    index: false,
    follow: false,
    nocache: true,
    nosnippet: true,
    noarchive: true,
    noimageindex: true,
  },

  icons: {
    icon: [
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
