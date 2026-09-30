import type { MetadataRoute } from 'next';

/**
 * The web app manifest.
 *
 * Served at `/manifest.webmanifest`. It is what lets a reader add Scrinode to
 * a home screen and have it open as an application rather than a browser tab —
 * which matters here more than on most sites, because §5 says nearly all
 * Scrinode's readers are on phones and tablets.
 *
 * A route rather than a static JSON file so the colours stay in one place: if
 * §6's palette moves, this moves with it instead of drifting.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Scrinode — Scripture, Study, and AI',
    short_name: 'Scrinode',
    description:
      'AI-powered Bible search, study, and ministry workspace. Explore Scripture, original languages, cross-references and context.',

    start_url: '/',
    display: 'standalone',

    // §6's brand ink and page background. `background_color` is the splash
    // screen while the app boots; `theme_color` tints the OS chrome.
    background_color: '#f8f7f3',
    theme_color: '#172033',

    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // A separate file, not the same one relabelled. A launcher crops a
      // maskable icon to a circle or squircle, so its content must sit inside
      // the middle 80% — the transparent icons above would be clipped. This
      // one puts the mark at ~56% of the canvas on opaque brand ink.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],

    categories: ['books', 'education', 'productivity'],
    lang: 'en',
    dir: 'ltr',
  };
}
