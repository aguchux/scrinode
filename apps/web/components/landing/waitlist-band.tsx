import { WaitlistForm } from '@scrinode/ui';

/**
 * The waitlist band.
 *
 * Kept as its own section with a real id, because both the header button and
 * the hero scroll to it. The product is in MVP build (§35) and the reader is
 * not open yet, so this is the honest call to action — the page claims what
 * Scrinode does, and this says when you can use it.
 *
 * Sits on the closing photograph with a heavy scrim: the form's labels and
 * helper text are small, and §32's contrast requirement is stricter below 18pt
 * than for a headline.
 */
export function WaitlistBand() {
  return (
    <section
      id="waitlist"
      aria-label="Join the waitlist"
      style={{
        padding: 'clamp(1.5rem, 3vw, 2rem) clamp(1rem, 4vw, 2.75rem) clamp(2rem, 4vw, 3rem)',
        background: 'var(--color-background)',
      }}
    >
      <div
        style={{
          maxWidth: '84rem',
          margin: '0 auto',
          borderRadius: '0.9rem',
          overflow: 'hidden',
          padding: 'clamp(2rem, 5vw, 3.25rem) clamp(1.25rem, 4vw, 3rem)',
          textAlign: 'center',
          backgroundImage: [
            'linear-gradient(180deg, rgba(10,14,24,0.86) 0%, rgba(10,14,24,0.74) 100%)',
            'url(/bgs/closing.jpg)',
          ].join(','),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <p
          style={{
            margin: '0 0 0.8rem',
            fontSize: '0.6875rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#d3b169',
          }}
        >
          Same word. Deeper insights. Greater impact.
        </p>

        <h2
          style={{
            margin: '0 auto 0.9rem',
            maxWidth: '30rem',
            fontFamily: 'var(--font-scripture)',
            fontSize: 'clamp(1.7rem, 3.4vw, 2.4rem)',
            lineHeight: 1.15,
            letterSpacing: '-0.015em',
            color: '#f7f4ec',
          }}
        >
          Be first through the door
        </h2>

        <p
          style={{
            margin: '0 auto 1.75rem',
            maxWidth: '34rem',
            fontSize: '0.9375rem',
            lineHeight: 1.6,
            color: 'rgba(243,240,232,0.78)',
          }}
        >
          Scrinode is being built now. Join the waitlist and we’ll write to you when the reader
          opens — no newsletter, no forwarding your address to anyone.
        </p>

        <div style={{ maxWidth: '30rem', margin: '0 auto' }}>
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}
