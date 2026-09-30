import {
  BookIcon,
  ChevronIcon,
  ContextIcon,
  CrossReferenceIcon,
  LanguagesIcon,
  LibraryIcon,
  SearchIcon,
  StudyIcon,
  WorkIcon,
  ZedekIcon,
} from '@scrinode/ui';

/**
 * The product preview in the hero.
 *
 * Rendered in the DOM rather than shipped as a screenshot, for three reasons
 * that all matter here:
 *
 *   1. **It stays true.** A screenshot of a mockup drifts from the product the
 *      moment either changes, and nothing catches it. This is built from the
 *      same tokens and the same §4 navigation as the reader will be.
 *   2. **It scales.** A 1,400px PNG is heavy and blurs on a wide display; this
 *      is text and vectors at any size.
 *   3. **It is readable.** A reader using a screen reader or text zoom gets
 *      real content, not an image with no alternative.
 *
 * **The Scripture shown is real.** It is John 1 in the Berean Standard Bible,
 * which §22.1 permits — the mockup showed ESV, which Scrinode has no licence
 * to serve commercially, so reproducing it here would breach §22.1 in a public
 * page. The design is unchanged; only the text and its label differ.
 *
 * Decorative as a whole: it depicts an interface rather than being one, so it
 * is hidden from assistive technology and none of its controls are focusable.
 * A tab stop into a picture of a product is a trap (§32).
 */

/** John 1:1-6, Berean Standard Bible. Public domain, commercially usable. */
const JOHN_1 = [
  { n: 1, text: 'In the beginning was the Word, and the Word was with God, and the Word was God.' },
  { n: 2, text: 'He was with God in the beginning.' },
  {
    n: 3,
    text: 'Through Him all things were made, and without Him nothing was made that has been made.',
  },
  { n: 4, text: 'In Him was life, and that life was the light of men.' },
  {
    n: 5,
    text: 'The Light shines in the darkness, and the darkness has not overcome it.',
    highlighted: true,
  },
  { n: 6, text: 'There came a man who was sent from God. His name was John.' },
];

const NAV = [
  { label: 'Home', Icon: BookIcon },
  { label: 'Scripture', Icon: BookIcon, active: true },
  { label: 'Study', Icon: StudyIcon },
  { label: 'Zedek AI', Icon: ZedekIcon },
  { label: 'Workspaces', Icon: WorkIcon },
  { label: 'Library', Icon: LibraryIcon },
];

const STUDY_ROWS = [
  { label: 'Original Language Insight', Icon: LanguagesIcon },
  { label: 'Cross-References', Icon: CrossReferenceIcon },
  { label: 'Historical & Cultural Context', Icon: ContextIcon },
  { label: 'Practical Application', Icon: BookIcon },
];

export function ProductPreview() {
  return (
    <div
      aria-hidden="true"
      style={{
        borderRadius: '0.9rem',
        overflow: 'hidden',
        background: '#ffffff',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 40px 80px -24px rgba(8,12,22,0.68), 0 0 0 1px rgba(197,162,83,0.10)',
        fontSize: '0.72rem',
        color: '#1c2430',
        // Selection would look like a broken control on a decorative image.
        userSelect: 'none',
      }}
    >
      <PreviewTopBar />

      <div style={{ display: 'flex', minHeight: '22rem' }}>
        <PreviewSidebar />
        <PreviewScripture />
        <PreviewZedek />
      </div>
    </div>
  );
}

function PreviewTopBar() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.9rem',
        padding: '0.65rem 0.9rem',
        borderBottom: '1px solid #e9e5dd',
        background: '#ffffff',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
        <img src="/mark.png" alt="" width={18} height={18} style={{ display: 'block' }} />
        <span
          style={{ fontFamily: 'var(--font-scripture)', fontSize: '0.92rem', color: '#172033' }}
        >
          Scrinode
        </span>
      </span>

      <span
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.36rem 0.7rem',
          borderRadius: '999px',
          background: '#f6f4ef',
          border: '1px solid #e9e5dd',
          color: '#8b93a1',
          fontSize: '0.68rem',
        }}
      >
        <SearchIcon width={13} height={13} />
        Search Scripture, topics, people, or ask Zedek AI…
        <span style={{ marginLeft: 'auto', fontSize: '0.6rem', letterSpacing: '0.04em' }}>⌘K</span>
      </span>

      <span
        style={{
          width: '1.5rem',
          height: '1.5rem',
          borderRadius: '999px',
          background: '#22304a',
          color: '#f7f4ec',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.6rem',
          letterSpacing: '0.02em',
        }}
      >
        JD
      </span>
    </div>
  );
}

function PreviewSidebar() {
  return (
    <div
      className="scrinode-preview-sidebar"
      style={{
        width: '8.5rem',
        flexShrink: 0,
        borderRight: '1px solid #e9e5dd',
        background: '#fbfaf7',
        padding: '0.7rem 0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.1rem',
      }}
    >
      {NAV.map(({ label, Icon, active }) => (
        <span
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.55rem',
            borderRadius: '0.4rem',
            fontSize: '0.7rem',
            color: active ? '#172033' : '#667085',
            background: active ? '#eee9df' : 'transparent',
          }}
        >
          <Icon width={14} height={14} />
          {label}
        </span>
      ))}

      <span
        style={{
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.45rem 0.55rem',
          borderRadius: '0.4rem',
          border: '1px dashed #d9d3c7',
          color: '#667085',
          fontSize: '0.66rem',
        }}
      >
        + New Workspace
      </span>
    </div>
  );
}

function PreviewScripture() {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: '0.75rem 1rem',
        background: '#fcfaf5',
        borderRight: '1px solid #e9e5dd',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.7rem' }}>
        <PreviewChip label="John 1" />
        {/*
          BSB, not the ESV the mockup showed. §22.1: every publisher treats a
          subscription as commercial use, so the ESV's non-commercial grant
          cannot be served — and a marketing page showing it would be the same
          breach as the product doing it.
        */}
        <PreviewChip label="BSB" />
      </div>

      <h3
        style={{
          fontFamily: 'var(--font-scripture)',
          fontSize: '1.05rem',
          margin: '0 0 0.1rem',
          color: '#172033',
        }}
      >
        John 1
      </h3>
      <p style={{ margin: '0 0 0.6rem', fontSize: '0.68rem', color: '#8b93a1' }}>
        The Word Became Flesh
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.38rem' }}>
        {JOHN_1.map((verse) => (
          <p
            key={verse.n}
            style={{
              margin: 0,
              display: 'flex',
              gap: '0.45rem',
              lineHeight: 1.5,
              fontSize: '0.7rem',
              ...(verse.highlighted
                ? {
                    background: '#f0e3b5',
                    borderRadius: '0.25rem',
                    padding: '0.15rem 0.3rem',
                    margin: '-0.15rem -0.3rem',
                  }
                : {}),
            }}
          >
            <span style={{ color: '#a7a3a0', fontSize: '0.58rem', paddingTop: '0.15rem' }}>
              {verse.n}
            </span>
            <span>{verse.text}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function PreviewZedek() {
  return (
    <div
      className="scrinode-preview-zedek"
      style={{
        width: '15rem',
        flexShrink: 0,
        padding: '0.75rem 0.85rem',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '0.9rem',
          fontSize: '0.66rem',
          color: '#8b93a1',
          borderBottom: '1px solid #e9e5dd',
          paddingBottom: '0.45rem',
        }}
      >
        <span style={{ color: '#172033', borderBottom: '2px solid #c5a253', paddingBottom: '0.4rem' }}>
          Zedek AI
        </span>
        <span>Study</span>
        <span>Cross-References</span>
      </div>

      <span
        style={{
          alignSelf: 'flex-end',
          maxWidth: '85%',
          padding: '0.4rem 0.6rem',
          borderRadius: '0.6rem 0.6rem 0.15rem 0.6rem',
          background: '#eef2f7',
          fontSize: '0.66rem',
          lineHeight: 1.45,
        }}
      >
        What does John 1:5 mean in its original context?
      </span>

      <div style={{ display: 'flex', gap: '0.45rem' }}>
        <img
          src="/mark.png"
          alt=""
          width={18}
          height={18}
          style={{ display: 'block', flexShrink: 0, marginTop: '0.1rem' }}
        />
        <p
          style={{
            margin: 0,
            fontSize: '0.64rem',
            lineHeight: 1.5,
            color: '#374151',
            background: '#fbfaf7',
            border: '1px solid #eee9df',
            borderRadius: '0.5rem',
            padding: '0.5rem 0.6rem',
          }}
        >
          John 1:5 turns on a single verb. The light “shines” in the present tense — continuously,
          not once — while the darkness “has not overcome” it in the aorist, a completed attempt that
          failed. The Greek κατέλαβεν carries both senses: to seize and to grasp.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: 'auto' }}>
        {STUDY_ROWS.map(({ label, Icon }) => (
          <span
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.4rem 0.55rem',
              borderRadius: '0.4rem',
              border: '1px solid #eee9df',
              fontSize: '0.64rem',
              color: '#374151',
            }}
          >
            <Icon width={13} height={13} style={{ color: '#8b93a1' }} />
            {label}
            <ChevronIcon width={12} height={12} style={{ marginLeft: 'auto', color: '#a7a3a0' }} />
          </span>
        ))}
      </div>
    </div>
  );
}

function PreviewChip({ label }: { readonly label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.22rem 0.5rem',
        borderRadius: '0.35rem',
        border: '1px solid #e9e5dd',
        background: '#ffffff',
        fontSize: '0.66rem',
        color: '#374151',
      }}
    >
      {label}
      <ChevronIcon width={11} height={11} style={{ transform: 'rotate(90deg)', color: '#a7a3a0' }} />
    </span>
  );
}
