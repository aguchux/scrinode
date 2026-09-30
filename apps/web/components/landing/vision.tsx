'use client';

import { ArrowIcon, Button, DocumentIcon, LanguagesIcon, SearchIcon, SparkIcon } from '@scrinode/ui';

/**
 * The dark capability band — "Everything You Need to Go Deeper".
 *
 * Restates the four things Scrinode is for, in the product's own language
 * (§45) rather than feature marketing. The four map to the domains a reader
 * moves through in §1's arc: search, language, AI, and ministry work.
 *
 * The heading and the button sit in the same row as the cards on desktop, as
 * the design has them — an unusual arrangement that reads as one statement
 * rather than a title above a grid.
 */

const CAPABILITIES = [
  {
    Icon: SearchIcon,
    title: 'Smart Bible Search',
    body: 'Find passages, themes, people, and topics with natural language.',
  },
  {
    Icon: LanguagesIcon,
    title: 'Original Language Tools',
    body: 'Explore Hebrew, Greek, and Strong’s with clear explanations.',
  },
  {
    Icon: SparkIcon,
    title: 'AI Insights with Zedek',
    body: 'Get trustworthy, Bible-grounded answers and deeper understanding.',
  },
  {
    Icon: DocumentIcon,
    title: 'Sermon & Ministry Workspace',
    body: 'Prepare messages, organize research, and collaborate.',
  },
];

export function Vision() {
  return (
    <section
      id="vision"
      aria-label="Everything you need to go deeper"
      style={{
        background: 'var(--color-background)',
        padding: '0 clamp(1rem, 4vw, 2.75rem) clamp(1.5rem, 3vw, 2rem)',
      }}
    >
      <div
        style={{
          maxWidth: '84rem',
          margin: '0 auto',
          borderRadius: '0.9rem',
          background: 'linear-gradient(135deg, #131b2b 0%, #172033 46%, #1d2942 100%)',
          padding: 'clamp(1.5rem, 3.5vw, 2.25rem)',
        }}
      >
        <div
          className="scrinode-vision"
          style={{ display: 'grid', gap: 'clamp(1.5rem, 3vw, 2.25rem)', alignItems: 'center' }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: '0 0 0.7rem',
                fontSize: '0.6875rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#d3b169',
              }}
            >
              Built for study. Designed for ministry.
            </p>

            <h2
              style={{
                margin: '0 0 1.25rem',
                fontFamily: 'var(--font-scripture)',
                fontSize: 'clamp(1.6rem, 3vw, 2.15rem)',
                lineHeight: 1.15,
                letterSpacing: '-0.015em',
                color: '#f7f4ec',
              }}
            >
              Everything You Need
              <br />
              to Go Deeper
            </h2>

            <Button
              variant="outline"
              size="sm"
              style={{ color: '#f7f4ec', borderColor: 'rgba(247,244,236,0.28)' }}
              onClick={() =>
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Explore All Features
              <ArrowIcon width={15} height={15} />
            </Button>
          </div>

          <div
            className="scrinode-capability-grid"
            style={{ display: 'grid', gap: '0.75rem', minWidth: 0 }}
          >
            {CAPABILITIES.map(({ Icon, title, body }) => (
              <article
                key={title}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(247,244,236,0.10)',
                  borderRadius: '0.65rem',
                  padding: '0.95rem 0.9rem',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '2.1rem',
                    height: '2.1rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(197,162,83,0.16)',
                    color: '#d3b169',
                    marginBottom: '0.65rem',
                  }}
                >
                  <Icon width={17} height={17} />
                </span>

                <h3
                  style={{
                    margin: '0 0 0.3rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#f7f4ec',
                  }}
                >
                  {title}
                </h3>

                <p
                  style={{
                    margin: 0,
                    fontSize: '0.78125rem',
                    lineHeight: 1.5,
                    color: 'rgba(243,240,232,0.64)',
                  }}
                >
                  {body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
