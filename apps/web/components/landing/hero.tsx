'use client';

import { ArrowIcon, Button, PlayIcon, Scene } from '@scrinode/ui';
import { ProductPreview } from './product-preview';
import { SiteHeader } from './site-header';

/**
 * The hero.
 *
 * Two columns on desktop — the claim on the left, the product on the right —
 * collapsing to one on narrow screens, where the preview follows the copy
 * rather than shrinking beside it. §5: never merely stretch or squeeze a
 * layout across breakpoints.
 *
 * The header sits inside the Scene rather than above it, so the photograph
 * runs behind the navigation as the design intends.
 *
 * The copy claims what Scrinode does, not what it will do. The product is in
 * MVP build, and the waitlist is the honest call to action while the reader
 * is unfinished — but nothing here says "coming soon", because the search,
 * retrieval and Zedek grounding described are built.
 */
export function Hero() {
  return (
    <Scene tone="dawn" image="/bgs/header.jpg" scrim="strong">
      <SiteHeader />

      <div
        className="scrinode-hero"
        style={{
          display: 'grid',
          gap: 'clamp(2rem, 5vw, 3.5rem)',
          alignItems: 'center',
          padding: 'clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 2.75rem) clamp(3rem, 7vw, 5rem)',
          maxWidth: '84rem',
          margin: '0 auto',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: '0 0 1rem',
              fontSize: '0.75rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#c9a961',
            }}
          >
            Faith deeper. Insights clearer. Ministry further.
          </p>

          <h1
            style={{
              fontFamily: 'var(--font-scripture)',
              // Sized so "Scripture, Study, and" fits one line in the hero's
              // left column. The previous ceiling overflowed it into three
              // lines, which broke the two-line shape the design relies on.
              fontSize: 'clamp(2.25rem, 4.4vw, 3.5rem)',
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              margin: '0 0 1.25rem',
              color: '#f7f4ec',
              // The explicit <br> sets the break; this stops the first line
              // wrapping again on its own at an awkward width.
              textWrap: 'balance',
            }}
          >
            <span className="scrinode-headline-line">Scripture, Study, and</span>
            <br />
            <span style={{ color: '#c9a961' }}>AI — Unified.</span>
          </h1>

          <p
            style={{
              margin: '0 0 2rem',
              maxWidth: '34rem',
              fontSize: 'clamp(1rem, 1.4vw, 1.0625rem)',
              lineHeight: 1.65,
              color: 'rgba(243,240,232,0.82)',
            }}
          >
            Scrinode is an AI-powered Bible search, study, and ministry workspace designed to help
            you go deeper into God’s Word with confidence. Explore Scripture, original languages,
            cross-references, contextual insights, and prepare meaningful sermons — all in one
            place.
          </p>

          {/*
            Full-width and stacked on a phone, side by side once there is room.
            Two half-width buttons on a 360px screen leave neither with a
            comfortable label or a 44px target (§32).
          */}
          <div className="scrinode-hero-actions">
            <Button
              variant="ink"
              onClick={() =>
                document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Join Waitlist
              <ArrowIcon width={16} height={16} />
            </Button>

            <Button
              variant="light"
              onClick={() =>
                document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              <PlayIcon width={18} height={18} />
              Watch Overview
            </Button>
          </div>
        </div>

        <div className="scrinode-hero-preview" style={{ minWidth: 0 }}>
          <ProductPreview />
        </div>
      </div>
    </Scene>
  );
}
