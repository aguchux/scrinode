import { Scene, WaitlistForm, Wordmark } from '@scrinode/ui';

/**
 * The closing band — the waitlist and the footer, on one backdrop.
 *
 * Previously two sections: a rounded card on `/bgs/closing.jpg` sitting on the
 * page background, then a separate footer Scene on `/bgs/footer.jpg`. That put
 * a strip of pale page colour between two dark photographs and read as a seam
 * rather than an ending.
 *
 * They now share one Scene and one photograph, divided by a single rule. Two
 * consequences worth having:
 *
 *   - **One fewer image to download.** `closing.jpg` is gone, 61 KB saved on
 *     every visit.
 *   - **One scrim to satisfy §32 rather than two.** The waitlist's helper text
 *     and the footer's links are both small, so both need the image to recede
 *     the same distance; a single `veil` does that once.
 *
 * The waitlist keeps its own `id` and `aria-label`: the header button and the
 * hero both scroll to it, and a screen reader should still find "Join the
 * waitlist" as a region rather than meeting it inside "footer".
 */

/**
 * The copyright year, fixed rather than computed.
 *
 * `new Date().getFullYear()` at render time is a hydration hazard: the server
 * and the browser evaluate it separately, and across New Year in different
 * time zones they disagree — server in UTC reading 2027 while a browser in
 * UTC-5 still reads 2026. React reports that as a mismatch and does not patch
 * it up.
 *
 * It is also wrong in the other direction under static rendering, where the
 * year is baked in at build time and then never changes.
 *
 * A constant is honest about what this is: a value someone updates, once a
 * year, deliberately.
 */
const COPYRIGHT_YEAR = 2026;

/**
 * Footer columns.
 *
 * Product links are marked `ready: false` where the route does not exist, the
 * same discipline as the header: a footer full of dead links is worse than a
 * short one.
 */
const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Scripture', href: '/scripture', ready: false },
      { label: 'Study', href: '/study', ready: false },
      { label: 'Zedek AI', href: '/zedek', ready: false },
      { label: 'Workspaces', href: '/workspaces', ready: false },
      { label: 'Library', href: '/library', ready: false },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Features', href: '#features', ready: true },
      { label: 'Workflow', href: '#workflow', ready: true },
      { label: 'Join Waitlist', href: '#waitlist', ready: true },
    ],
  },
  {
    heading: 'Account',
    links: [{ label: 'Sign In', href: '/signin', ready: true }],
  },
];

export function Closing() {
  return (
    <Scene tone="depth" image="/bgs/footer.jpg" scrim="veil">
      <section id="waitlist" aria-label="Join the waitlist" className="scrinode-waitlist">
        <p className="scrinode-waitlist-eyebrow">Same word. Deeper insights. Greater impact.</p>

        <h2 className="scrinode-waitlist-heading">Be first through the door</h2>

        <p className="scrinode-waitlist-body">
          Scrinode is being built now. Join the waitlist and we’ll write to you when the reader
          opens — no newsletter, no forwarding your address to anyone.
        </p>

        <div className="scrinode-waitlist-form">
          <WaitlistForm />
        </div>
      </section>

      {/*
        The divider the design calls for. A border rather than an <hr>: an <hr>
        is a thematic break in content, and this separates two regions that are
        already distinguished semantically — a rule here is decoration, so it
        should not be announced.
      */}
      <footer id="about" className="scrinode-footer">
        <div className="scrinode-footer-grid">
          <div className="scrinode-footer-brand">
            <Wordmark tone="light" size={36} />

            <p className="scrinode-footer-tagline">
              A Bible platform first, an AI product second — built so Scripture stays the interface,
              not an input.
            </p>

            <p className="scrinode-footer-motto">Scripture · Insight · For a Brighter Tomorrow</p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="scrinode-footer-heading">{column.heading}</h2>

              <ul className="scrinode-footer-links">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.ready ? (
                      <a href={link.href} className="scrinode-footer-link">
                        {link.label}
                      </a>
                    ) : (
                      <span
                        className="scrinode-footer-link scrinode-footer-link-pending"
                        title={`${link.label} is not available yet`}
                      >
                        {link.label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="scrinode-footer-base">
          <p className="scrinode-footer-note">© {COPYRIGHT_YEAR} Scrinode. All rights reserved.</p>

          {/*
            §21 and §22.1: the translations Scrinode serves are public domain or
            carry a commercial grant, and saying so is part of treating
            provenance as first-class rather than a footnote nobody writes.
          */}
          <p className="scrinode-footer-note">
            Scripture quotations from public-domain and openly licensed translations.
          </p>
        </div>
      </footer>
    </Scene>
  );
}
