import type { Citation, ZedekMessage } from '@scrinode/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Message, parseSections } from './message';

/**
 * Message rendering.
 *
 * Two things are load-bearing and neither is cosmetic:
 *
 *   - §2.4 requires Scripture, AI synthesis and user content stay visibly
 *     distinct, and a byline that only differs by colour does not satisfy §32.
 *   - `parseSections` must never impose structure the model did not write.
 *     An outline invented from prose misrepresents the answer, which is the
 *     same failure as a fabricated citation in a smaller way.
 */

function message(over: Partial<ZedekMessage> = {}): ZedekMessage {
  return {
    id: 'm1',
    conversationId: 'c1',
    role: 'assistant',
    content: 'An answer.',
    citations: [],
    createdAt: new Date(2026, 3, 10, 9, 8),
    ...over,
  };
}

const scripture: Citation = {
  kind: 'scripture',
  label: 'Romans 8:28',
  canonicalReference: 'ROM.8.28',
  translation: 'BSB',
  retrievalUnitId: 'ru-1',
  text: 'And we know that God works all things together for the good of those who love Him.',
};

describe('parseSections', () => {
  it('splits markdown headings into sections', () => {
    const sections = parseSections(
      ['## Context', 'Paul is writing about hope.', '## Key idea', 'God works all things.'].join(
        '\n',
      ),
    );

    expect(sections.map((s) => s.title)).toEqual(['Context', 'Key idea']);
    expect(sections[0]?.body).toBe('Paul is writing about hope.');
  });

  it('splits bold lead-ins on their own line', () => {
    const sections = parseSections(
      ['**Context**', 'Paul is writing about hope.', '**Key idea**', 'God works all things.'].join(
        '\n',
      ),
    );

    expect(sections.map((s) => s.title)).toEqual(['Context', 'Key idea']);
  });

  it('keeps prose before the first heading as the lead', () => {
    const sections = parseSections(
      ['Romans 8:28 says this.', '## Context', 'Body.', '## Key idea', 'Body.'].join('\n'),
    );

    expect(sections.lead).toBe('Romans 8:28 says this.');
  });

  it('leaves plain prose alone', () => {
    // Where there is no heading there is no section. Guessing at one — treating
    // a first sentence as a title, say — would impose an outline the model did
    // not write.
    expect(parseSections('A paragraph with no headings at all in it.')).toHaveLength(0);
  });

  it('does not treat bold inside a sentence as a heading', () => {
    // Emphasis is not structure. Splitting on it would shred the prose.
    expect(parseSections('Paul says **all things**, not most things.')).toHaveLength(0);
  });

  it('does not make a structure out of a single heading', () => {
    // One numbered block reads as a formatting accident rather than an
    // outline.
    expect(parseSections(['## Context', 'Just the one section.'].join('\n'))).toHaveLength(0);
  });
});

describe('Message', () => {
  it('names the author in text, not only by colour or side', () => {
    // §32 forbids signalling state by colour alone, and "who said this" is
    // exactly such a state.
    render(<Message message={message()} />);

    expect(screen.getByText('Zedek')).toBeInTheDocument();
  });

  it('names a reader message as the reader', () => {
    render(<Message message={message({ role: 'user', content: 'Explain Romans 8:28.' })} />);

    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('renders a citation as Scripture, with its text and reference', () => {
    // The cited text is verbatim as retrieved (§22.3) — the point is that the
    // reader can compare it against the passage itself.
    render(<Message message={message({ citations: [scripture] })} />);

    expect(screen.getByText(/God works all things together/)).toBeInTheDocument();
    expect(screen.getByText(/Romans 8:28 · BSB/)).toBeInTheDocument();
  });

  it('links a Scripture citation back to the reader, carrying the translation', () => {
    // §3.3: Scripture Context cannot cross an origin, so it is passed in the
    // URL and rebuilt on arrival.
    render(<Message message={message({ citations: [scripture] })} />);

    const link = screen.getByRole('link', { name: /Romans 8:28/ });
    expect(link.getAttribute('href')).toContain('ROM.8.28');
    expect(link.getAttribute('href')).toContain('translation=BSB');
  });

  it('does not offer a chip for a non-Scripture citation', () => {
    // A lexical or historical source has no reference to open in the reader.
    render(
      <Message
        message={message({
          citations: [{ kind: 'lexical', label: 'BDAG ἀγάπη', text: 'love, esteem' }],
        })}
      />,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    // Still shown as a citation, though: it is what the answer is grounded in.
    expect(screen.getByText(/BDAG/)).toBeInTheDocument();
  });

  it('renders a structured answer as a numbered list', () => {
    render(
      <Message
        message={message({
          content: ['## Context', 'Paul writes of hope.', '## Key idea', 'God works.'].join('\n'),
        })}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Context' })).toBeInTheDocument();

    // An ordered list, so a screen reader announces "1 of 2" without the
    // decorative numerals — which are aria-hidden precisely so they are not
    // read out a second time.
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('never parses a reader message into sections', () => {
    // A reader who types a markdown heading is typing, not structuring an
    // answer.
    render(<Message message={message({ role: 'user', content: '## Is this a heading?\n## Or?' })} />);

    expect(screen.queryByRole('heading', { name: 'Is this a heading?' })).not.toBeInTheDocument();
  });
});
