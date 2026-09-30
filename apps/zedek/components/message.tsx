import { ChevronIcon, DocumentIcon, ZedekIcon } from '@scrinode/ui';
import type { Citation, ZedekMessage } from '@scrinode/types';

/**
 * One message in a Conversation.
 *
 * §2.4 requires Scripture, AI synthesis and user content stay *visibly*
 * distinct, so this is not a styling preference. Three things enforce it:
 *
 *   - Every message carries a byline naming its author. A label, not only a
 *     colour or an alignment — §32 forbids signalling state by colour alone,
 *     and "who said this" is exactly such a state.
 *   - Citations render as Scripture: the reading serif, a rule down the left,
 *     the reference attributed. Never folded into the prose.
 *   - The cited text is `citation.text`, verbatim as retrieved. It is never
 *     re-generated, because the point is that a reader can compare it against
 *     the passage itself (§22.3).
 *
 * ## The structured answer
 *
 * The design shows numbered sections with headings, which is §23's response
 * structure made visible — textual observation, context, interpretations,
 * cross references. `parseSections` derives them from the message text rather
 * than requiring a second channel: the model already produces headed sections
 * because §23's system prompt asks for them, and a message that has none
 * renders as plain prose. Nothing is invented when the shape is absent.
 */
export function Message({ message }: { message: ZedekMessage }) {
  const isReader = message.role === 'user';
  const sections = isReader ? [] : parseSections(message.content);

  return (
    <article className="zdk-turn" data-role={message.role}>
      <span className="zdk-avatar" aria-hidden="true">
        {isReader ? (
          <ReaderGlyph />
        ) : (
          /* The mark, not a generic robot: this is Zedek, and the brand is the
             assurance that the answer is grounded in Scrinode's own data. */
          <ZedekIcon width={18} height={18} />
        )}
      </span>

      <div className="zdk-bubble">
        <p className="zdk-byline">
          {isReader ? 'You' : 'Zedek'}
          <time className="zdk-time" dateTime={message.createdAt.toISOString()}>
            {message.createdAt.toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </time>
        </p>

        {sections.length > 0 ? (
          <>
            {sections.lead ? <p className="zdk-prose">{sections.lead}</p> : null}
            <ol className="zdk-sections">
              {sections.map((section, index) => (
                <li className="zdk-section" key={`${section.title}-${index}`}>
                  {/* The numeral is decorative — an <ol> already numbers this
                      for a screen reader, and announcing "1" twice is noise. */}
                  <span className="zdk-section-num" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="zdk-section-title">{section.title}</h3>
                    <p className="zdk-section-body">{section.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="zdk-prose">{message.content}</p>
        )}

        {message.citations.length > 0 ? (
          <>
            <ul className="zdk-citations" aria-label="Cited Scripture">
              {message.citations.map((citation, index) => (
                <li
                  className="zdk-citation"
                  key={`${citation.retrievalUnitId ?? citation.sourceId ?? citation.label}-${index}`}
                >
                  {citation.text ? <p className="zdk-citation-text">{citation.text}</p> : null}
                  <p className="zdk-citation-ref">
                    {citation.label}
                    {citation.translation ? ` · ${citation.translation}` : ''}
                  </p>
                </li>
              ))}
            </ul>

            {/* The chips from the mockup — one per cited passage, opening the
                reader at that reference. A link, not a button: it navigates,
                so it must open in a new tab, be copied, be crawled. */}
            <ul className="zdk-refs" aria-label="Open in Scripture">
              {message.citations
                .filter((citation) => citation.kind === 'scripture' && citation.canonicalReference)
                .map((citation, index) => (
                  <li key={`${citation.canonicalReference}-${index}`}>
                    <a className="zdk-ref" href={readerHref(citation)}>
                      {citation.label}
                      <ChevronIcon width={13} height={13} aria-hidden="true" />
                    </a>
                  </li>
                ))}
            </ul>
          </>
        ) : null}
      </div>
    </article>
  );
}

/**
 * A structured artefact attached to an answer — the sermon-outline card.
 *
 * Separate from `Message` because it is a *saved* thing: §3.5 puts research
 * cards in the Library, and a card the reader can keep is not the same object
 * as the prose that introduced it.
 */
export interface OutlineCardProps {
  readonly kind: string;
  readonly title: string;
  readonly reference?: string;
  readonly points: readonly { readonly title: string; readonly reference?: string; readonly body: string }[];
}

export function OutlineCard({ kind, title, reference, points }: OutlineCardProps) {
  return (
    <section className="zdk-outline" aria-label={`${kind}: ${title}`}>
      <header className="zdk-outline-head">
        <span className="zdk-outline-icon" aria-hidden="true">
          <DocumentIcon width={19} height={19} />
        </span>
        <div>
          <p className="zdk-outline-kind">{kind}</p>
          <h3 className="zdk-outline-title">{title}</h3>
          {reference ? <p className="zdk-outline-ref">{reference}</p> : null}
        </div>
      </header>

      <ol className="zdk-sections" style={{ background: 'none', border: 0, padding: 0 }}>
        {points.map((point, index) => (
          <li className="zdk-section" key={`${point.title}-${index}`}>
            <span className="zdk-section-num" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <h4 className="zdk-section-title">
                {point.title}
                {point.reference ? (
                  <span
                    style={{
                      marginInlineStart: '0.5rem',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.75rem',
                      fontWeight: 400,
                      color: 'var(--zdk-text-dim)',
                    }}
                  >
                    ({point.reference})
                  </span>
                ) : null}
              </h4>
              <p className="zdk-section-body">{point.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A section of a structured answer. */
export interface AnswerSection {
  readonly title: string;
  readonly body: string;
}

/** Sections, plus whatever prose preceded the first heading. */
type ParsedSections = AnswerSection[] & { lead?: string };

/**
 * Splits an answer into headed sections.
 *
 * Recognises the two forms §23's structure actually produces: a markdown
 * heading (`## Context`) and a bold lead-in on its own line (`**Context**`).
 * Anything else stays prose.
 *
 * Deliberately conservative. Guessing at structure — treating the first
 * sentence of each paragraph as a heading, say — would impose an outline the
 * model did not write, which misrepresents the answer. Where there is no
 * heading there is no section, and the message renders as the paragraph it is.
 */
export function parseSections(content: string): ParsedSections {
  const lines = content.split('\n');

  const sections: AnswerSection[] = [];
  const lead: string[] = [];
  let current: { title: string; body: string[] } | undefined;

  for (const line of lines) {
    const heading = matchHeading(line);

    if (heading) {
      if (current) sections.push({ title: current.title, body: current.body.join('\n').trim() });
      current = { title: heading, body: [] };
      continue;
    }

    if (current) current.body.push(line);
    else lead.push(line);
  }

  if (current) sections.push({ title: current.title, body: current.body.join('\n').trim() });

  // A single section is not a structure — it is a paragraph with a title on
  // it, and rendering one numbered block reads as a formatting accident.
  if (sections.length < 2) return [] as ParsedSections;

  const result = sections as ParsedSections;
  const leadText = lead.join('\n').trim();
  if (leadText) result.lead = leadText;

  return result;
}

/** `## Context` or `**Context**` on its own line. Returns the title, or undefined. */
function matchHeading(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;

  const hash = /^#{2,4}\s+(.+?)\s*$/.exec(trimmed);
  if (hash?.[1]) return hash[1];

  // A bold run must be the *whole* line to be a heading. Bold inside a
  // sentence is emphasis, and treating it as a heading would shred the prose.
  const bold = /^\*\*(.+?)\*\*:?$/.exec(trimmed);
  if (bold?.[1]) return bold[1];

  return undefined;
}

/**
 * Where a citation chip points.
 *
 * Back to the reader at scrinode.com, because §3.3 is explicit that Zedek and
 * the reader are separate origins and Scripture Context cannot cross one — it
 * is passed in the URL and rebuilt on arrival.
 *
 * `NEXT_PUBLIC_READER_URL` rather than a hard-coded domain: previews and
 * development do not run on scrinode.com, and a chip that always pointed at
 * production would take a reader out of the deployment they are testing.
 */
function readerHref(citation: Citation): string {
  const base = process.env.NEXT_PUBLIC_READER_URL ?? 'https://scrinode.com';
  const reference = citation.canonicalReference ?? '';
  const params = citation.translation ? `?translation=${encodeURIComponent(citation.translation)}` : '';

  return `${base}/scripture/reference/${encodeURIComponent(reference)}${params}`;
}

/** A reader's avatar glyph. Decorative; the byline says "You". */
function ReaderGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0" strokeLinecap="round" />
    </svg>
  );
}
