'use client';

import {
  AlphaIcon,
  BookIcon,
  CrossReferenceIcon,
  DocumentIcon,
  MenuIcon,
  MoreIcon,
} from '@scrinode/ui';
import type { Study } from '@scrinode/types';
import type { ReactNode, Ref } from 'react';
import { StudyMenu } from './study-menu';

/**
 * The workspace top bar.
 *
 * ## Layout
 *
 * The conversation's title is on the left, where a reader looks first and
 * where the thread's own identity belongs. The Study switcher is a compact
 * menu on the right.
 *
 * It was the other way round, and the Study pill carried `flex: 1` — so it
 * stretched the full width of the bar, its two lines overlapped, and the title
 * had nowhere to sit. Width goes to the thing that changes with every thread,
 * not to the thing a reader switches occasionally.
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
 * The actions from the design.
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
  /** The open conversation's title. Absent before one is chosen. */
  readonly conversationTitle?: string;
  readonly activeStudy?: Pick<Study, 'id' | 'title'>;
  readonly studies: readonly Pick<Study, 'id' | 'title'>[];
  readonly onSelectStudy: (studyId: string) => void;
  readonly onCreateStudy: () => void;
  readonly onOpenRail: () => void;
  readonly onQuickAction: (action: QuickAction) => void;
  /** Disabled while a turn streams — a second question would abandon the first. */
  readonly busy?: boolean;
  /** So the caller can return focus here when the drawer closes (§32). */
  readonly railToggleRef?: Ref<HTMLButtonElement>;
  readonly railOpen?: boolean;
}

export function TopBar({
  conversationTitle,
  activeStudy,
  studies,
  onSelectStudy,
  onCreateStudy,
  onOpenRail,
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

        {/* The thread's identity. An h1 rather than a styled span: it is the
            page's heading, and a screen-reader user navigating by heading
            should land on what they are reading (§32). */}
        <h1 className="zdk-topbar-title">
          <span className="zdk-topbar-name">{conversationTitle ?? 'New conversation'}</span>
          {activeStudy ? <span className="zdk-topbar-study">{activeStudy.title}</span> : null}
        </h1>

        <StudyMenu
          {...(activeStudy ? { activeStudy } : {})}
          studies={studies}
          onSelect={onSelectStudy}
          onCreate={onCreateStudy}
        />

        {/* `zdk-topbar-more` carries only the ordering: from 64rem the Study
            switcher moves past this to the far right of the bar. */}
        <button
          type="button"
          className="zdk-rail-toggle zdk-topbar-more"
          aria-label="More options"
        >
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
