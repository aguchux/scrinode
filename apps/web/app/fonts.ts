import { Inter, Source_Serif_4 } from 'next/font/google';

/**
 * Scrinode's typefaces.
 *
 * §6 asks for scholarly, calm, reverent, warm and highly readable. The system
 * stacks these replace were none of those: Georgia and Segoe UI are sturdy but
 * tight and hard-edged, and they change from machine to machine, so the design
 * was never the same twice.
 *
 * **Source Serif 4** carries Scripture and headings. Adobe drew it for
 * long-form reading, and it is open where a transitional serif like Georgia is
 * closed — rounder counters, a gentler axis, more air between the strokes.
 *
 * **Inter** carries the interface. It was designed for screens at small sizes,
 * which is where a landing page spends most of its type: 11px eyebrows, 13px
 * footer links, form labels. Its numerals and capitals stay distinguishable
 * where a text face's start to blur.
 *
 * ## Both are variable fonts, and `weight` is deliberately not set
 *
 * Naming discrete weights makes next/font emit one static file per weight and
 * style — measured at 19 files and 570 KB for these two families. Omitting
 * `weight` ships the variable font instead: one file per family, every weight
 * in the range, and any weight usable rather than only the four listed.
 *
 * ## Why `next/font` rather than a stylesheet link
 *
 * - **It self-hosts.** The files are downloaded at build time and served from
 *   our own origin, so the reader's CSP (`font-src 'self'`) needs no widening
 *   and no third party learns who is reading Scripture.
 * - **It eliminates layout shift.** Next computes a size-adjusted fallback
 *   from the real font's metrics, so the swap does not move the page — the
 *   thing that makes webfonts feel worse than system fonts when done badly.
 * - **It subsets.** Only the Latin range ships, which is most of the weight.
 *
 * `display: 'swap'` means text renders immediately in the fallback and swaps
 * when the font arrives. Never `block`: a blank page while a font loads fails
 * anyone on a slow connection, and §31 targets a usable shell in under 2s.
 */

export const scriptureFont = Source_Serif_4({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-scripture-loaded',
  // Georgia is the closest metric match available everywhere, so the
  // pre-swap render is the smallest possible jump.
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

export const uiFont = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ui-loaded',
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

/** Both variables, for the `<html>` element's className. */
export const fontVariables = `${scriptureFont.variable} ${uiFont.variable}`;
