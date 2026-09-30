import {
  ContextIcon,
  CrossReferenceIcon,
  InsightIcon,
  LanguagesIcon,
  SearchIcon,
  TeamIcon,
} from '@scrinode/ui';

/**
 * The capability strip beneath the hero.
 *
 * Six cards on a light surface, overlapping the hero's lower edge so the
 * sections read as one composition rather than stacked bands.
 *
 * Every claim here is something the codebase does. "Natural language search
 * across the entire Bible" is the 424,765 embedded units and §19's hybrid
 * retrieval; "cross-references" and "contextual analysis" are §15's structured
 * data. Where a capability is thinner than the sentence suggests — original
 * languages have no lexical dataset yet (§14.1) — the wording says what it
 * explores rather than promising depth that is not there.
 */

const FEATURES = [
  {
    Icon: SearchIcon,
    title: 'AI-Powered Scripture Search',
    body: 'Find what you’re looking for with natural language search across the entire Bible.',
  },
  {
    Icon: LanguagesIcon,
    title: 'Original Languages',
    body: 'Explore Hebrew, Greek, and more with clear, practical insights.',
  },
  {
    Icon: CrossReferenceIcon,
    title: 'Cross-References',
    body: 'Discover deeper connections across Scripture instantly.',
  },
  {
    Icon: ContextIcon,
    title: 'Contextual Analysis',
    body: 'Understand the big picture with historical, cultural, and literary context.',
  },
  {
    Icon: InsightIcon,
    title: 'Zedek AI',
    body: 'Your always-on study partner for questions, insights, and ministry preparation.',
  },
  {
    Icon: TeamIcon,
    title: 'Ministry Workspaces',
    body: 'Organize notes, sermons, research, and team collaboration in one place.',
  },
];

export function Features() {
  return (
    <section
      id="features"
      aria-label="What Scrinode does"
      style={{
        background: 'var(--color-background)',
        // Pulls the strip up over the hero's lower edge, as the design does.
        marginTop: '-2.5rem',
        borderRadius: '1.25rem 1.25rem 0 0',
        padding: 'clamp(2rem, 4vw, 2.75rem) clamp(1rem, 4vw, 2.75rem)',
        position: 'relative',
        zIndex: 5,
      }}
    >
      <div
        className="scrinode-feature-grid"
        style={{
          display: 'grid',
          gap: '0.9rem',
          maxWidth: '84rem',
          margin: '0 auto',
        }}
      >
        {FEATURES.map(({ Icon, title, body }) => (
          <article
            key={title}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.75rem',
              padding: '1.1rem 1rem',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.4rem',
                height: '2.4rem',
                borderRadius: '999px',
                background: '#f4ead6',
                color: '#a8842f',
                marginBottom: '0.8rem',
              }}
            >
              <Icon width={19} height={19} />
            </span>

            <h3
              style={{
                margin: '0 0 0.4rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.005em',
              }}
            >
              {title}
            </h3>

            <p
              style={{
                margin: 0,
                fontSize: '0.8125rem',
                lineHeight: 1.55,
                color: 'var(--color-text-secondary)',
              }}
            >
              {body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
