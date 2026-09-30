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
 * ## The cards flip, and the detail is never hover-only
 *
 * The front is a large icon and a title, centred. The description is on the
 * back, revealed on hover — but **hover is not a thing on a phone**, and §5
 * puts phones first, so the reveal is bound to three things at once:
 *
 *   - hover, for a mouse
 *   - focus, for a keyboard
 *   - tap, for touch — the card is a real `<button>`, so a tap toggles it
 *
 * Both faces are in the DOM at all times and a screen reader is given both,
 * because a description that only exists after a pointer event is a
 * description some readers never get (§32).
 *
 * The flip is a transform, and §32 requires reduced motion be honoured — under
 * `prefers-reduced-motion` the faces cross-fade instead of rotating.
 *
 * Every claim here is something the codebase does. "Natural language search
 * across the entire Bible" is the 424,765 embedded units and §19's hybrid
 * retrieval. Where a capability is thinner than the sentence suggests —
 * original languages have no lexical dataset yet (§14.1) — the wording says
 * what it explores rather than promising depth that is not there.
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
    <section id="features" aria-label="What Scrinode does" className="scrinode-features">
      <ul className="scrinode-feature-grid">
        {FEATURES.map(({ Icon, title, body }) => (
          <li key={title} className="scrinode-flip">
            {/*
              A button, not a div with a handler. It is focusable, it responds
              to Enter and Space, and a screen reader announces it as something
              that can be operated — none of which a div gives for free (§32).

              `aria-expanded` is deliberately absent: the description is always
              in the accessible tree, so nothing is being expanded. Announcing a
              state that changes nothing for a screen reader would be noise.
            */}
            <button type="button" className="scrinode-flip-button">
              <span className="scrinode-flip-inner">
                <span className="scrinode-flip-face scrinode-flip-front">
                  <span className="scrinode-flip-icon" aria-hidden="true">
                    <Icon width={30} height={30} />
                  </span>
                  <span className="scrinode-flip-title">{title}</span>
                </span>

                <span className="scrinode-flip-face scrinode-flip-back">
                  <span className="scrinode-flip-body">{body}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
