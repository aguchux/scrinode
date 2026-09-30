import type { Conversation, ZedekMessage } from '@scrinode/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Workspace } from './workspace';

/**
 * The workspace shell.
 *
 * The assertions here are about what the surface promises rather than how it
 * looks: that nothing is fabricated, that an empty thread says what Zedek is
 * for, and that the drawer returns focus where it came from.
 */

beforeEach(() => {
  // Desktop pointer, so Enter behaves as a keyboard.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('any-pointer: fine'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // jsdom does not implement element scrolling.
  Element.prototype.scrollTo = vi.fn();
});

const base = {
  studyTitle: 'Romans Study',
  conversations: [] as readonly Conversation[],
  messages: [] as readonly ZedekMessage[],
  activeConversationId: null,
  onSelectConversation: vi.fn(),
  onNewChat: vi.fn(),
};

describe('Workspace', () => {
  it('shows the empty state rather than an invented conversation', () => {
    /*
     * The guard against the most tempting shortcut in this whole task. The
     * mockup shows an answer about Romans 8:28; shipping it as seeded content
     * would put fabricated Scripture commentary in the product, which §2.2 and
     * §42 both forbid — and a reader cannot tell invented commentary from a
     * grounded one, which is exactly why.
     */
    render(<Workspace {...base} />);

    expect(screen.getByText('Ask about the text')).toBeInTheDocument();
    expect(screen.queryByText(/Romans 8:28 says/)).not.toBeInTheDocument();
  });

  it('tells the reader it will decline rather than guess', () => {
    // A reader expecting a general assistant asks general questions, gets
    // "nothing relevant" (§16), and concludes the product is broken rather
    // than that it is grounded.
    render(<Workspace {...base} />);

    expect(screen.getByText(/will say so rather than guess/)).toBeInTheDocument();
  });

  it('names the open Study in the top bar', () => {
    render(<Workspace {...base} />);

    expect(screen.getByText('Romans Study')).toBeInTheDocument();
  });

  it('disables the composer when no conversation is open', () => {
    // Otherwise a question is sent to an endpoint with no conversation id and
    // fails after the reader has typed it.
    render(<Workspace {...base} />);

    expect(screen.getByLabelText('Ask Zedek about Scripture')).toBeDisabled();
  });

  it('offers the quick actions as a labelled list', () => {
    // A row of loose buttons gives a screen-reader user no sense of how many
    // there are or where the group ends (§32).
    render(<Workspace {...base} />);

    const list = screen.getByRole('list', { name: 'Quick actions' });
    expect(list).toBeInTheDocument();
  });

  it('returns focus to the toggle when the drawer closes', () => {
    /*
     * Without this, closing the drawer drops focus to the top of the document
     * and a keyboard user has to tab back to where they were.
     *
     * Focus is deliberately moved *into* the panel first. Asserting focus on
     * the toggle straight after the opening click would pass whether or not
     * the component ever returns it — a test that cannot fail is not
     * protection.
     */
    render(<Workspace {...base} />);

    const toggle = screen.getByLabelText('Open conversations');
    fireEvent.click(toggle);

    const panel = screen.getByLabelText('Conversations');
    expect(panel).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(toggle).toHaveFocus();
  });

  it('marks the toggle as controlling the drawer', () => {
    render(<Workspace {...base} />);

    const toggle = screen.getByLabelText('Open conversations');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'zdk-rail');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
