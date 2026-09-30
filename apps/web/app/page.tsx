import { Features } from '../components/landing/features';
import { Hero } from '../components/landing/hero';
import { SiteFooter } from '../components/landing/site-footer';
import { VerseBand } from '../components/landing/verse-band';
import { Vision } from '../components/landing/vision';
import { WaitlistBand } from '../components/landing/waitlist-band';

/**
 * The home page.
 *
 * No longer a coming-soon page: Scrinode is in MVP build, and the copy claims
 * what the product does rather than what it will. The reader itself is not
 * open yet, so the waitlist remains the call to action — but the capabilities
 * described are built, and the product preview in the hero renders the real
 * §4 navigation rather than a picture of one.
 *
 * Composed entirely from @scrinode/ui primitives, so the reader can be built
 * from the same vocabulary rather than a second one.
 */
export default function Home() {
  return (
    <main id="top">
      <Hero />
      <Features />
      <VerseBand />
      <Vision />
      <WaitlistBand />
      <SiteFooter />
    </main>
  );
}
