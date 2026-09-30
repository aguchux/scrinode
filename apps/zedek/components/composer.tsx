'use client';

import { AttachIcon, MicIcon, SendIcon } from '@scrinode/ui';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

/**
 * The composer — a multi-line, auto-growing question box.
 *
 * ## Why a textarea rather than an input
 *
 * The questions Zedek is for are not short. "Compare how Paul and James use
 * 'justified' and show me where they are answering different questions" is one
 * line of thought and three lines of text. An `<input>` scrolls it sideways,
 * so a reader cannot re-read what they are asking before they send it — and
 * re-reading the question is most of what makes a good one.
 *
 * ## Growing
 *
 * Height is set from `scrollHeight` after resetting to `auto`. Resetting first
 * is not optional: `scrollHeight` never shrinks below the element's current
 * height, so without it the box grows and never comes back down.
 *
 * `useLayoutEffect` rather than `useEffect` so the measurement and the
 * assignment happen in the same frame as the paint. With `useEffect` the
 * browser paints the old height first, which on a phone reads as the box
 * flickering on every keystroke.
 *
 * Bounds are in CSS (`min-height`/`max-height`), not here — six lines, then it
 * scrolls. A box that grows without limit eventually covers the answer it is
 * asking about.
 *
 * ## Enter
 *
 * Enter sends on a keyboard; Shift+Enter breaks the line. On a touch device
 * Enter **always** inserts a newline, because a phone keyboard's return key is
 * how people write a second sentence and there is no Shift to hold. That is
 * detected per-event from `isComposing` and a pointer query rather than
 * assumed, so a tablet with a keyboard attached behaves like a desktop.
 *
 * `isComposing` is the important half: a Japanese, Chinese or Korean IME uses
 * Enter to accept a candidate. Sending on it would submit a half-written word
 * and is a bug that only appears for people not testing in English.
 */

export interface ComposerProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  /** True while a turn streams. The button becomes Stop (§18 wants cancel). */
  readonly streaming?: boolean;
  readonly onCancel?: () => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  streaming = false,
  onCancel,
  disabled = false,
  placeholder = 'Ask Zedek about Scripture...',
}: ComposerProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textarea.current;
    if (!el) return;

    // Reset first, or scrollHeight reports the current (larger) height and the
    // box only ever grows.
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(resize, [value, resize]);

  // The viewport changes height when a phone keyboard opens, which changes how
  // many characters fit on a line and therefore the wrapped height.
  useEffect(() => {
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  const canSend = value.trim().length > 0 && !disabled;

  const submit = useCallback(() => {
    if (!canSend) return;
    onSubmit();
  }, [canSend, onSubmit]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter') return;

      // An IME is mid-composition: Enter is accepting a candidate, not sending.
      if (event.nativeEvent.isComposing) return;

      // Shift+Enter always breaks the line.
      if (event.shiftKey) return;

      // On a touch device with no attached keyboard, Enter breaks the line too.
      // `any-pointer: fine` is true when *some* pointer is precise, so a tablet
      // with a trackpad or a keyboard is treated as a desktop.
      const hasKeyboard =
        typeof window !== 'undefined' && window.matchMedia('(any-pointer: fine)').matches;

      if (!hasKeyboard) return;

      event.preventDefault();
      submit();
    },
    [submit],
  );

  const handleFormSubmit = useCallback(
    (event: FormEvent) => {
      // A real <form>, so a phone keyboard offers its "go" key and the browser
      // handles the semantics. Its default navigation is what is prevented.
      event.preventDefault();
      submit();
    },
    [submit],
  );

  return (
    <div className="zdk-composer">
      <form onSubmit={handleFormSubmit}>
        <div className="zdk-composer-box">
          {/* Present in the mockup. Disabled until uploads exist rather than
              removed, so the layout is the shipped one — but disabled, because
              a control that silently does nothing is worse than an absent one. */}
          <button
            type="button"
            className="zdk-composer-icon"
            disabled
            aria-label="Attach a file (not yet available)"
          >
            <AttachIcon width={18} height={18} />
          </button>

          {/* The label is visually hidden rather than absent: the placeholder
              disappears as soon as anything is typed, so it cannot be the
              accessible name (§32). */}
          <label className="zdk-sr" htmlFor="zdk-composer-input">
            Ask Zedek about Scripture
          </label>

          <textarea
            id="zdk-composer-input"
            ref={textarea}
            className="zdk-composer-input"
            // One row; the height is then driven by content.
            rows={1}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            // Scripture references and Greek transliteration are not words a
            // phone should be correcting or capitalising.
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck
          />

          <button
            type="button"
            className="zdk-composer-icon"
            disabled
            aria-label="Dictate (not yet available)"
          >
            <MicIcon width={18} height={18} />
          </button>

          {streaming ? (
            <button
              type="button"
              className="zdk-composer-button"
              onClick={onCancel}
              aria-label="Stop generating"
            >
              {/* A square. §18 requires cancellation, and a reader who has
                  thought of a better question should not wait for the old one. */}
              <span
                aria-hidden="true"
                style={{ width: 12, height: 12, borderRadius: 2, background: 'currentColor' }}
              />
            </button>
          ) : (
            <button
              type="submit"
              className="zdk-composer-button"
              disabled={!canSend}
              aria-label="Send"
            >
              <SendIcon width={19} height={19} />
            </button>
          )}
        </div>
      </form>

      <p className="zdk-composer-hint">
        Enter to send · Shift + Enter for a new line. Zedek cites Scripture you can check.
      </p>
    </div>
  );
}
