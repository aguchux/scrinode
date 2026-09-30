import type { Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Providers } from '../components/providers';
import { fontVariables } from './fonts';
import '../styles/globals.css';

export { metadata } from './metadata';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Scrinode is mobile-first and text scaling is an accessibility
  // requirement (AGENTS.md §32), so zoom is never disabled.
  maximumScale: 5,
  // Tints the browser chrome to match the page rather than leaving a white
  // bar above a dark hero. Two entries so each theme gets the surface it
  // actually renders (§6).
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f7f3' },
    { media: '(prefers-color-scheme: dark)', color: '#10151f' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Set per request by src/middleware.ts. next-themes needs it to run its
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
