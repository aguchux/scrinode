import { BookIcon, CompassIcon, CreateIcon, DocumentIcon, SearchIcon, SunriseIcon } from '@scrinode/ui';

/**
 * The paired band: verse of the day beside the study workflow.
 *
 * Two photographic panels side by side on desktop, stacked on narrow screens.
 * Both sit on their own image with a heavy scrim, because both carry text at
 * sizes §32 treats strictly.
 *
 * **The verse is BSB, not the ESV the mockup showed.** §22.1 is not a
 * formality: every publisher treats a subscription as commercial use, so the
 * ESV's non-commercial grant cannot be served — and printing it on a marketing
 * page is the same redistribution as serving it in the reader. Psalm 119:105
 * in the Berean Standard Bible carries the same sense in nearly the same
 * words.
 */

const STEPS = [
  {
    n: 1,
    Icon: SearchIcon,
    title: 'Search',
    body: 'Find passages or ask a question',
  },
  {
    n: 2,
    Icon: DocumentIcon,
    title: 'Explore',
    body: 'See context, original languages, and cross-references',
  },
  {
    n: 3,
    Icon: BookIcon,
    title: 'Study',
    body: 'Get AI-powered insights and practical application',
  },
  {
    n: 4,
    Icon: CreateIcon,
    title: 'Create',
    body: 'Build notes, sermons, and resources',
  },
];

export function VerseBand() {
  return (
    <section
      id="workflow"
      aria-label="Verse of the day and the study workflow"
      style={{
        background: 'var(--color-background)',
        padding: '0 clamp(1rem, 4vw, 2.75rem) clamp(1.5rem, 3vw, 2rem)',
      }}
    >
      <div
        className="scrinode-band-pair"
        style={{ display: 'grid', gap: '0.9rem', maxWidth: '84rem', margin: '0 auto' }}
      >
        <VerseOfTheDay />
        <Workflow />
      </div>
    </section>
  );
}

function VerseOfTheDay() {
  return (
    <article
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '0.9rem',
        minHeight: '13rem',
        padding: 'clamp(1.4rem, 3vw, 2rem)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundImage: [
          'linear-gradient(100deg, rgba(10,14,24,0.88) 0%, rgba(10,14,24,0.62) 52%, rgba(10,14,24,0.34) 100%)',
          'url(/bgs/verse.jpg)',
        ].join(','),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <p
        style={{
          margin: '0 0 1rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.6875rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#d3b169',
        }}
      >
        <SunriseIcon width={15} height={15} />
        Verse of the Day
      </p>

      <blockquote
        style={{
          margin: '0 0 0.9rem',
          fontFamily: 'var(--font-scripture)',
          fontStyle: 'italic',
          fontSize: 'clamp(1.35rem, 2.4vw, 1.85rem)',
          lineHeight: 1.35,
          color: '#f7f4ec',
        }}
      >
        “Your word is a lamp to my feet and a light to my path.”
      </blockquote>

      {/*
        The translation is named, not implied. §22 requires AI-assisted text be
        distinguishable from a published translation, and naming the edition is
        the same discipline: a reader must always know which text they read.
      */}
      <cite style={{ fontStyle: 'normal', fontSize: '0.8125rem', color: 'rgba(243,240,232,0.72)' }}>
        Psalm 119:105 (BSB)
      </cite>
    </article>
  );
}

function Workflow() {
  return (
    <article
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '0.9rem',
        minHeight: '13rem',
        padding: 'clamp(1.4rem, 3vw, 2rem)',
        backgroundImage: [
          'linear-gradient(95deg, rgba(10,14,24,0.90) 0%, rgba(10,14,24,0.74) 58%, rgba(10,14,24,0.42) 100%)',
          'url(/bgs/workflow.jpg)',
        ].join(','),
        backgroundSize: 'cover',
        backgroundPosition: 'center right',
      }}
    >
      <p
        style={{
          margin: '0 0 0.6rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.6875rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#d3b169',
        }}
      >
        <CompassIcon width={15} height={15} />
        A complete study workflow
      </p>

      <h2
        style={{
          margin: '0 0 0.5rem',
          fontFamily: 'var(--font-scripture)',
          fontSize: 'clamp(1.35rem, 2.4vw, 1.85rem)',
          color: '#f7f4ec',
          letterSpacing: '-0.01em',
        }}
      >
        From Reading to Revelation
      </h2>

      <p
        style={{
          margin: '0 0 1.5rem',
          maxWidth: '32rem',
          fontSize: '0.875rem',
          lineHeight: 1.6,
          color: 'rgba(243,240,232,0.78)',
        }}
      >
        Search, study, explore, and apply — all in one seamless workspace designed for deeper
        understanding and greater impact.
      </p>

      <ol
        className="scrinode-steps"
        style={{
          display: 'grid',
          gap: '1rem',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          maxWidth: '38rem',
        }}
      >
        {STEPS.map(({ n, Icon, title, body }) => (
          <li key={n} style={{ minWidth: 0 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.2rem',
                height: '2.2rem',
                borderRadius: '999px',
                background: n === 4 ? '#c5a253' : '#22304a',
                color: n === 4 ? '#1c2430' : '#f7f4ec',
                marginBottom: '0.55rem',
              }}
            >
              <Icon width={16} height={16} />
            </span>

            <p
              style={{
                margin: '0 0 0.2rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#f7f4ec',
              }}
            >
              <span style={{ color: '#d3b169', marginRight: '0.35rem' }}>{n}</span>
              {title}
            </p>

            <p
              style={{
                margin: 0,
                fontSize: '0.75rem',
                lineHeight: 1.45,
                color: 'rgba(243,240,232,0.66)',
              }}
            >
              {body}
            </p>
          </li>
        ))}
      </ol>
    </article>
  );
}
