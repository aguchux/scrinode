'use client';

import { BookIcon, ChevronIcon, PlusIcon } from '@scrinode/ui';
import type { Study } from '@scrinode/types';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

/**
 * The Study switcher.
 *
 * A compact control on the right of the bar, sized to its content. It was
 * previously stretched across the whole bar by `flex: 1`, which left the
 * conversation title nowhere to go and overlapped its two lines — switching
 * Study is an occasional act, and the width belongs to the thread's title.
 *
 * ## It is a menu, which is a real obligation
 *
 * A div that opens on click is not a menu. This one:
 *
 *   - closes on Escape, on outside click, and on choosing something
 *   - returns focus to the button on close, so a keyboard user is not dropped
 *     at the top of the document
 *   - moves through items with the arrow keys, and Home/End jump to the ends
 *   - reports its state with `aria-expanded` and names the panel it controls
 *
 * The last item creates rather than selects, so it sits below a rule. A create
 * flush among choices is easy to hit while scanning for one.
 */

export interface StudyMenuProps {
  /** The Study currently open. Undefined before any exists. */
  readonly activeStudy?: Pick<Study, 'id' | 'title'>;
  readonly studies: readonly Pick<Study, 'id' | 'title'>[];
  readonly onSelect: (studyId: string) => void;
  readonly onCreate: () => void;
}

export function StudyMenu({ activeStudy, studies, onSelect, onCreate }: StudyMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  const close = useCallback(
    (returnFocus = true) => {
      setOpen(false);
      if (returnFocus) button.current?.focus();
    },
    [],
  );

  /*
   * Escape closes, and an outside click closes.
   *
   * `pointerdown` rather than `click`: a click fires after the press, so a
   * reader pressing on something behind the menu would see the menu still open
   * under their finger for the length of the press.
   *
   * Both listeners exist only while open, so a closed menu is not swallowing
   * Escape from a dialog someone adds later.
   */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (root.current?.contains(event.target as Node)) return;
      // No focus return: the reader is already moving somewhere else, and
      // pulling focus back would fight them.
      close(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  /** Focus lands on the first item when the menu opens. */
  useEffect(() => {
    if (!open) return;
    items.current[0]?.focus();
  }, [open]);

  /** Arrow keys walk the items; Home and End jump to the ends. */
  const onItemKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const list = items.current.filter(Boolean) as HTMLButtonElement[];
    if (list.length === 0) return;

    const move = (next: number) => {
      event.preventDefault();
      // Wraps, so Down from the last item reaches the first — including the
      // "New Workspace" action, which is the last item.
      list[(next + list.length) % list.length]?.focus();
    };

    switch (event.key) {
      case 'ArrowDown':
        return move(index + 1);
      case 'ArrowUp':
        return move(index - 1);
      case 'Home':
        return move(0);
      case 'End':
        return move(list.length - 1);
      default:
        return;
    }
  }, []);

  const label = activeStudy?.title ?? 'No Study';

  return (
    <div className="zdk-studymenu" ref={root}>
      <button
        ref={button}
        type="button"
        className="zdk-study"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="zdk-study-icon" aria-hidden="true">
          <BookIcon width={17} height={17} />
        </span>
        {/* The visible text is the Study's name; the accessible name must also
            say what the control does, or it reads as just a title (§32). */}
        {/* The trailing space is load-bearing and must be an explicit entity:
            adjacent elements concatenate with no separator, and JSX strips
            whitespace before a newline — so a plain "Study: " here yields the
            accessible name "Study:Romans Study". */}
        <span className="zdk-sr">Study:&nbsp;</span>
        <span className="zdk-study-name">{label}</span>
        <span className="zdk-study-chevron" aria-hidden="true">
          <ChevronIcon width={14} height={14} />
        </span>
      </button>

      {open ? (
        <ul className="zdk-studymenu-panel" id={panelId} role="menu" aria-label="Studies">
          {studies.length === 0 ? (
            <li>
              <p
                className="zdk-group-label"
                style={{ margin: '0.5rem 0.2rem', textTransform: 'none', letterSpacing: 0 }}
              >
                No workspaces yet
              </p>
            </li>
          ) : (
            studies.map((study, index) => (
              <li key={study.id} role="none">
                <button
                  ref={(el) => {
                    items.current[index] = el;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={study.id === activeStudy?.id}
                  aria-current={study.id === activeStudy?.id ? 'true' : undefined}
                  className="zdk-studymenu-item"
                  onKeyDown={(event) => onItemKeyDown(event, index)}
                  onClick={() => {
                    onSelect(study.id);
                    close();
                  }}
                >
                  <span className="zdk-study-icon" aria-hidden="true">
                    <BookIcon width={15} height={15} />
                  </span>
                  <span className="zdk-studymenu-label">{study.title}</span>
                  {study.id === activeStudy?.id ? (
                    <span className="zdk-studymenu-tick" aria-hidden="true">
                      <TickIcon />
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}

          {/* The call to action, last and below a rule. It creates rather than
              selects, so it is not a `menuitemradio` among the choices. */}
          <li className="zdk-studymenu-cta" role="none">
            <button
              ref={(el) => {
                items.current[studies.length] = el;
              }}
              type="button"
              role="menuitem"
              className="zdk-studymenu-item"
              onKeyDown={(event) => onItemKeyDown(event, studies.length)}
              onClick={() => {
                onCreate();
                close();
              }}
            >
              <span className="zdk-study-icon" aria-hidden="true">
                <PlusIcon width={15} height={15} />
              </span>
              <span className="zdk-studymenu-label">New Workspace</span>
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

/** A tick, for the Study that is open. Decorative; aria-checked carries it. */
function TickIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
