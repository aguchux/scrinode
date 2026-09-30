import type { Conversation } from '@scrinode/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Rail, groupByRecency, shortTime } from './rail';

/**
 * The conversation rail.
 *
 * The grouping functions are tested directly because they are where a date bug
 * hides: "Today" that quietly means "the last 24 hours" is wrong for a reader
 * at 8am and right in every test written at midday.
 */

function conversation(id: string, updatedAt: Date, title = `Thread ${id}`): Conversation {
  return {
    id,
    studyId: 'study-1',
    userId: 'user-1',
    title,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('groupByRecency', () => {
  // A fixed "now": Friday 10 April 2026, 09:00.
  const now = new Date(2026, 3, 10, 9, 0, 0);

  it('files this morning under Today', () => {
    const groups = groupByRecency([conversation('a', new Date(2026, 3, 10, 7, 32))], now);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe('Today');
  });

  it('files last night under Previous 7 days, not Today', () => {
    // 23:00 yesterday is ten hours ago. A rolling 24-hour window would call it
    // "Today", which is wrong to every reader looking at it.
    const groups = groupByRecency([conversation('a', new Date(2026, 3, 9, 23, 0))], now);

    expect(groups[0]?.label).toBe('Previous 7 days');
  });

  it('files a month ago under Earlier', () => {
    const groups = groupByRecency([conversation('a', new Date(2026, 2, 8, 12, 0))], now);

    expect(groups[0]?.label).toBe('Earlier');
  });

  it('orders newest first inside a group', () => {
    const groups = groupByRecency(
      [
        conversation('older', new Date(2026, 3, 10, 7, 0)),
        conversation('newer', new Date(2026, 3, 10, 8, 30)),
      ],
      now,
    );

    expect(groups[0]?.items.map((c) => c.id)).toEqual(['newer', 'older']);
  });

  it('omits a group with nothing in it', () => {
    // An empty heading over nothing is noise.
    const groups = groupByRecency([conversation('a', new Date(2026, 3, 10, 7, 0))], now);

    expect(groups.map((g) => g.label)).toEqual(['Today']);
  });
});

describe('shortTime', () => {
  const now = new Date(2026, 3, 10, 9, 0, 0);

  it('gives a clock time for today', () => {
    // Which of this morning's threads it was.
    expect(shortTime(new Date(2026, 3, 10, 7, 32), now)).toMatch(/7[:.]32/);
  });

  it('gives a date for anything older', () => {
    expect(shortTime(new Date(2026, 3, 2, 7, 32), now)).not.toMatch(/7[:.]32/);
  });
});

describe('Rail', () => {
  const base = {
    conversations: [conversation('a', new Date(), 'Romans 8:28 Context')],
    activeConversationId: null,
    onSelect: vi.fn(),
    onNewChat: vi.fn(),
  };

  it('is hidden from the accessibility tree while closed', () => {
    // `visibility: hidden` is what keeps a keyboard user out of a drawer they
    // cannot see. A transform alone would leave it tabbable (§32).
    render(<Rail {...base} open={false} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Conversations')).toHaveAttribute('data-open', 'false');
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Rail {...base} open onClose={onClose} />);

    // On the document, because focus is usually in the thread behind the
    // drawer — a handler on the panel would never see the key.
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not listen for Escape while closed', () => {
    // Otherwise a closed drawer swallows Escape from a dialog added later.
    const onClose = vi.fn();
    render(<Rail {...base} open={false} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the scrim is used', () => {
    const onClose = vi.fn();
    render(<Rail {...base} open onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Close menu', { selector: '.zdk-rail-scrim' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders no scrim while closed, so it is not in the tab order', () => {
    render(<Rail {...base} open={false} onClose={vi.fn()} />);

    expect(document.querySelector('.zdk-rail-scrim')).toBeNull();
  });

  it('moves focus into the panel when it opens', () => {
    // Otherwise a keyboard user opens a drawer and stays focused behind it.
    const { rerender } = render(<Rail {...base} open={false} onClose={vi.fn()} />);
    rerender(<Rail {...base} open onClose={vi.fn()} />);

    expect(screen.getByLabelText('Conversations')).toHaveFocus();
  });

  it('marks the open conversation with aria-current, not colour alone', () => {
    render(<Rail {...base} open activeConversationId="a" onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Romans 8:28 Context/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('filters conversations by the search field', () => {
    render(
      <Rail
        {...base}
        conversations={[
          conversation('a', new Date(), 'Romans 8:28 Context'),
          conversation('b', new Date(), 'Greek word study: agape'),
        ]}
        open
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Search conversations'), {
      target: { value: 'agape' },
    });

    expect(screen.queryByText('Romans 8:28 Context')).not.toBeInTheDocument();
    expect(screen.getByText('Greek word study: agape')).toBeInTheDocument();
  });

  it('says so when a search matches nothing', () => {
    // §44: an empty state is part of the feature, and a list that simply
    // vanishes reads as a fault.
    render(<Rail {...base} open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Search conversations'), {
      target: { value: 'nothing matches this' },
    });

    expect(screen.getByText('No conversations match')).toBeInTheDocument();
  });
});
