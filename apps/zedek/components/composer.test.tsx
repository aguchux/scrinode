import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Composer } from './composer';

/**
 * The composer.
 *
 * What is tested here is the behaviour that differs between a phone and a
 * desktop, because that is where a chat composer actually goes wrong: Enter
 * sending a half-written sentence on a phone, or an IME candidate being
 * submitted instead of accepted.
 */

/** jsdom has no matchMedia; each test declares whether a keyboard is present. */
function setPointer(fine: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('any-pointer: fine') ? fine : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('Composer', () => {
  beforeEach(() => setPointer(true));

  it('sends on Enter when a keyboard is present', () => {
    const onSubmit = vi.fn();
    render(<Composer value="What does agape mean?" onChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.keyDown(screen.getByLabelText('Ask Zedek about Scripture'), { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('breaks the line on Shift+Enter rather than sending', () => {
    const onSubmit = vi.fn();
    render(<Composer value="A question" onChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.keyDown(screen.getByLabelText('Ask Zedek about Scripture'), {
      key: 'Enter',
      shiftKey: true,
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not send on Enter on a touch device', () => {
    // The phone case. Enter is how a second sentence gets written, and there
    // is no Shift to hold — sending here would be the single most annoying
    // bug on the surface 99% of readers use.
    setPointer(false);

    const onSubmit = vi.fn();
    render(<Composer value="A question" onChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.keyDown(screen.getByLabelText('Ask Zedek about Scripture'), { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not send while an IME is composing', () => {
    // Enter accepts a candidate in a Japanese, Chinese or Korean IME. Sending
    // on it submits a half-written word — a bug invisible to anyone testing in
    // English.
    const onSubmit = vi.fn();
    render(<Composer value="愛" onChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.keyDown(screen.getByLabelText('Ask Zedek about Scripture'), {
      key: 'Enter',
      // fireEvent copies this onto the native event, which is where the
      // component reads it.
      isComposing: true,
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses to send whitespace', () => {
    const onSubmit = vi.fn();
    // Braces, not quotes. A JSX string attribute is literal, so `\n` inside
    // quotes is a backslash and an n — not whitespace, and the guard would be
    // tested against something it is right to accept.
    render(<Composer value={'   \n\t  '} onChange={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.getByLabelText('Send')).toBeDisabled();

    fireEvent.keyDown(screen.getByLabelText('Ask Zedek about Scripture'), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('offers Stop while streaming, not Send', () => {
    // §18 requires cancellation. A reader who has thought of a better question
    // should not be paying for the old answer to finish.
    const onCancel = vi.fn();
    render(
      <Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} streaming onCancel={onCancel} />,
    );

    expect(screen.queryByLabelText('Send')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Stop generating'));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('labels the field, so the accessible name survives typing', () => {
    // A placeholder disappears as soon as anything is typed, so it cannot be
    // the accessible name (§32).
    render(<Composer value="text already typed" onChange={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Ask Zedek about Scripture')).toBeInTheDocument();
  });

  it('is a textarea, so a long question wraps instead of scrolling sideways', () => {
    render(<Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Ask Zedek about Scripture').tagName).toBe('TEXTAREA');
  });
});
