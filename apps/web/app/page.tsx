import { Closing } from '../components/landing/closing';
import { Features } from '../components/landing/features';
import { Hero } from '../components/landing/hero';
import { VerseBand } from '../components/landing/verse-band';
import { Vision } from '../components/landing/vision';

/**
 * The home page.
 *
 * No longer a coming-soon page: Scrinode is in MVP build, and the copy claims
 * what the product does rather than what it will. The reader itself is not
 * open yet, so the waitlist remains the call to action — but the capabilities
 * described are built, and the product preview in the hero renders the real
 * §4 navigation rather than a picture of one.
 *
 * `Closing` is the waitlist and the footer on one backdrop: they used to be
 * two sections with a strip of page colour between them, which read as a seam
 * rather than an ending.
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
      <Closing />
    </main>
  );
}
