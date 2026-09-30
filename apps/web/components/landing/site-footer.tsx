import { Scene, Wordmark } from '@scrinode/ui';

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

export function SiteFooter() {
  return (
    <Scene
      tone="depth"
      image="/bgs/footer.jpg"
      scrim="veil"
      style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
    >
      <footer
        id="about"
        style={{
          padding: 'clamp(2.25rem, 5vw, 3.25rem) clamp(1rem, 4vw, 2.75rem) clamp(1.5rem, 3vw, 2rem)',
        }}
      >
        <div
          className="scrinode-footer-grid"
          style={{
            display: 'grid',
            gap: 'clamp(1.75rem, 4vw, 3rem)',
            maxWidth: '84rem',
            margin: '0 auto',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <Wordmark tone="light" size={36} style={{ marginBottom: '0.9rem' }} />

            <p
              style={{
                margin: '0 0 0.9rem',
                maxWidth: '22rem',
                fontSize: '0.8125rem',
                lineHeight: 1.6,
                color: 'rgba(243,240,232,0.62)',
              }}
            >
              A Bible platform first, an AI product second — built so Scripture stays the interface,
              not an input.
            </p>

            <p
              style={{
                margin: 0,
                fontSize: '0.5625rem',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'rgba(243,240,232,0.45)',
              }}
            >
              Scripture · Insight · For a Brighter Tomorrow
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading} style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: '0 0 0.85rem',
                  fontSize: '0.6875rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#d3b169',
                  fontWeight: 600,
                }}
              >
                {column.heading}
              </h2>

              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.55rem' }}>
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.ready ? (
                      <a
                        href={link.href}
                        style={{
                          fontSize: '0.8125rem',
                          color: 'rgba(243,240,232,0.74)',
                          textDecoration: 'none',
                        }}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <span
                        title={`${link.label} is not available yet`}
                        style={{ fontSize: '0.8125rem', color: 'rgba(243,240,232,0.38)' }}
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

        <div
          style={{
            maxWidth: '84rem',
            margin: 'clamp(1.75rem, 4vw, 2.5rem) auto 0',
            paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(243,240,232,0.5)' }}>
            © {COPYRIGHT_YEAR} Scrinode. All rights reserved.
          </p>

          {/*
            §21 and §22.1: the translations Scrinode serves are public domain or
            carry a commercial grant, and saying so is part of treating
            provenance as first-class rather than a footnote nobody writes.
          */}
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(243,240,232,0.42)' }}>
            Scripture quotations from public-domain and openly licensed translations.
          </p>
        </div>
      </footer>
    </Scene>
  );
}
