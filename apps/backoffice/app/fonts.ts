import { Inter } from 'next/font/google';

/**
 * The backoffice's typeface.
 *
 * Inter only, and deliberately no reading serif: the backoffice is internal
 * tooling (§51) with no Scripture surface, so a second family would be weight
 * downloaded for nothing. If a Scripture preview is ever added here, it takes
 * Source Serif the way the reader does.
 *
 * `weight` is not set on purpose. Inter is a variable font, and naming
 * discrete weights makes next/font emit one static file per weight instead of
 * one file covering the whole range.
 *
 * Self-hosted by next/font, which also computes a size-adjusted fallback so
 * the swap does not move the page.
 */
export const uiFont = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ui-loaded',
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

export const fontVariables = uiFont.variable;
