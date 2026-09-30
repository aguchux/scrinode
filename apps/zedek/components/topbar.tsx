'use client';

import {
  AlphaIcon,
  BookIcon,
  ChevronIcon,
  CrossReferenceIcon,
  DocumentIcon,
  MenuIcon,
  MoreIcon,
} from '@scrinode/ui';
import type { ReactNode, Ref } from 'react';

/**
 * The workspace top bar: which Study is open, and what can be asked of it.
 *
 * ## The quick actions are prompts, not features
 *
 * Each sends a question Zedek answers through the same orchestration as
 * anything typed (§16). They exist because the hardest part of a research
 * assistant is knowing what to ask it — a reader who opens an empty box often
 * closes it again. They are not shortcuts to different machinery.
 *
 * On a phone they scroll horizontally rather than wrapping: four pills wrapped
 * to two rows cost a third of the first screen, and the thread is what the
 * reader came for (§5).
 */

export interface QuickAction {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
  /** The question sent when it is used. Plain text, exactly as if typed. */
  readonly prompt: string;
}

/**
 * The actions from the mockup.
 *
 * Every one maps to something §3.2 or §15 already names — passage context,
 * cross references, original language — rather than inventing a capability.
 * "Sermon outline" is §3.4's sermon workspace reached from research.
 */
export const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    id: 'explain',
    label: 'Explain passage',
    icon: <BookIcon width={15} height={15} />,
    prompt: 'Explain this passage in its context.',
  },
  {
    id: 'cross-references',
    label: 'Cross references',
    icon: <CrossReferenceIcon width={15} height={15} />,
    prompt: 'What passages does this connect to, and how?',
  },
  {
    id: 'sermon',
    label: 'Sermon outline',
    icon: <DocumentIcon width={15} height={15} />,
    prompt: 'Draft a sermon outline from this passage.',
  },
  {
    id: 'original-language',
    label: 'Original language',
    icon: <AlphaIcon width={15} height={15} />,
    prompt: 'What does the original language show here that a translation cannot?',
  },
];

export interface TopBarProps {
  readonly studyTitle: string;
  readonly onOpenRail: () => void;
  readonly onChooseStudy?: () => void;
  readonly onQuickAction: (action: QuickAction) => void;
  /** Disabled while a turn streams — a second question would abandon the first. */
  readonly busy?: boolean;
  /** So the caller can return focus here when the drawer closes (§32). */
  readonly railToggleRef?: Ref<HTMLButtonElement>;
  readonly railOpen?: boolean;
}

export function TopBar({
  studyTitle,
  onOpenRail,
  onChooseStudy,
  onQuickAction,
  busy = false,
  railToggleRef,
  railOpen = false,
}: TopBarProps) {
  return (
    <>
      <div className="zdk-topbar">
        <button
          ref={railToggleRef}
          type="button"
          className="zdk-rail-toggle"
          onClick={onOpenRail}
          aria-label="Open conversations"
          aria-expanded={railOpen}
          // Names the panel this controls, so a screen reader can move to it.
          aria-controls="zdk-rail"
        >
          <MenuIcon width={19} height={19} />
        </button>

        <button type="button" className="zdk-study" onClick={onChooseStudy}>
          <span className="zdk-study-icon" aria-hidden="true">
            <BookIcon width={18} height={18} />
          </span>
          <span className="zdk-study-text">
            <span className="zdk-study-name">{studyTitle}</span>
            <span className="zdk-study-kind">Workspace</span>
          </span>
          <span aria-hidden="true" style={{ marginInlineStart: 'auto', display: 'inline-flex' }}>
            {/* Rotated to point down: a disclosure, not a navigation. */}
            <ChevronIcon width={15} height={15} style={{ transform: 'rotate(90deg)' }} />
          </span>
        </button>

        <button type="button" className="zdk-rail-toggle" aria-label="More options">
          <MoreIcon width={18} height={18} />
        </button>
      </div>

      {/* A real list, labelled. A row of loose buttons gives a screen-reader
          user no sense of how many there are or where the group ends (§32). */}
      <ul className="zdk-actions" aria-label="Quick actions">
        {/* The li is a real flex item rather than `display: contents`, which
            several browsers drop from the accessibility tree — taking with it
            the list semantics this markup exists for. */}
        {QUICK_ACTIONS.map((action) => (
          <li key={action.id} className="zdk-actions-item">
            <button
              type="button"
              className="zdk-action"
              disabled={busy}
              onClick={() => onQuickAction(action)}
            >
              <span className="zdk-action-icon" aria-hidden="true">
                {action.icon}
              </span>
              {action.label}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
