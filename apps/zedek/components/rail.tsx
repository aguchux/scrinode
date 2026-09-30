'use client';

import { ChatIcon, CloseIcon, PlusIcon, SearchIcon, SettingsIcon, Wordmark } from '@scrinode/ui';
import type { Conversation } from '@scrinode/types';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * The conversation rail.
 *
 * Off-canvas on a phone, permanent from 64rem — and the switch is entirely in
 * CSS (`.zdk-rail` at the 64rem breakpoint). Nothing here measures the
 * viewport, because a JS breakpoint renders the wrong layout on the first
 * paint and then corrects it, which is visible.
 *
 * `data-open` drives the transform. The panel is `visibility: hidden` while
 * closed, which is what keeps it out of the tab order — a transform alone
 * leaves a keyboard user tabbing into a drawer they cannot see (§32).
 */

export interface RailProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly conversations: readonly Conversation[];
  readonly activeConversationId: string | null;
  readonly onSelect: (conversationId: string) => void;
  readonly onNewChat: () => void;
  /** Shown in the footer. Absent until the session is wired. */
  readonly reader?: { readonly name: string; readonly plan?: string };
}

export function Rail({
  open,
  onClose,
  conversations,
  activeConversationId,
  onSelect,
  onNewChat,
  reader,
}: RailProps) {
  const [query, setQuery] = useState('');
  const panel = useRef<HTMLElement>(null);

  /*
   * Escape closes.
   *
   * Bound to the document rather than the panel: the reader may well have
   * focus in the thread behind an open drawer, and a handler on the panel
   * would never see the key.
   *
   * Only while open, so a closed drawer is not holding a listener that
   * swallows Escape from a dialog someone adds later.
   */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  /*
   * Focus moves into the panel when it opens.
   *
   * Without this a keyboard or screen-reader user opens a drawer and stays
   * focused on a toggle behind a scrim, with no way to reach what appeared
   * except by tabbing through the whole page.
   *
   * Returning focus to the toggle on close is the caller's job — it owns the
   * toggle element — and `Workspace` does it.
   */
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
  }, [open]);

  /*
   * Search filters what is already loaded.
   *
   * Client-side deliberately: the rail holds a page of recent conversations,
   * and filtering that list is instant where a request is not. Searching *all*
   * of a reader's research is a different feature and belongs to the API,
   * which can search message bodies rather than only titles.
   */
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(needle));
  }, [conversations, query]);

  const groups = useMemo(() => groupByRecency(filtered), [filtered]);

  return (
    <>
      {/*
        The scrim. A <button> rather than a div with onClick, so it is a real
        control: dismissing a drawer by tapping outside is an action, and a
        keyboard user gets it too.

        Rendered only while open — a permanently mounted full-screen button
        would sit in the tab order of every page.
      */}
      {open ? (
        <button type="button" className="zdk-rail-scrim" onClick={onClose} aria-label="Close menu" />
      ) : null}

      <nav
        id="zdk-rail"
        ref={panel}
        className="zdk-rail"
        data-open={open ? 'true' : 'false'}
        aria-label="Conversations"
        // Focusable programmatically but not by Tab: focus lands here when the
        // drawer opens, and from there Tab walks its contents normally.
        tabIndex={-1}
      >
        <div className="zdk-rail-head">
          <span className="zdk-brand">
            <Wordmark markOnly size={38} />
            <span className="zdk-brand-text">
              <span className="zdk-brand-name">Scrinode</span>
              <span className="zdk-brand-sub">Zedek</span>
            </span>
          </span>

          {/* Only meaningful while the drawer is a drawer; CSS hides it once
              the rail is permanent, alongside the hamburger that opened it. */}
          <button
            type="button"
            className="zdk-rail-toggle"
            onClick={onClose}
            aria-label="Close menu"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <button type="button" className="zdk-newchat" onClick={onNewChat}>
          <PlusIcon width={17} height={17} />
          New chat
        </button>

        <div className="zdk-search">
          <span className="zdk-search-icon" aria-hidden="true">
            <SearchIcon width={16} height={16} />
          </span>
          {/* type="search" gives a phone keyboard its search key and a clear
              affordance the browser draws for free. */}
          <label className="zdk-sr" htmlFor="zdk-rail-search">
            Search conversations
          </label>
          <input
            id="zdk-rail-search"
            className="zdk-search-input"
            type="search"
            value={query}
            placeholder="Search conversations..."
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="zdk-rail-body">
          {groups.length === 0 ? (
            <p className="zdk-group-label" role="status">
              {query ? 'No conversations match' : 'No conversations yet'}
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.label}>
                <h2 className="zdk-group-label">{group.label}</h2>
                <ul className="zdk-convo-list">
                  {group.items.map((conversation) => (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        className="zdk-convo"
                        // The state a screen reader needs. The gold background
                        // is the sighted half; neither is alone (§32).
                        aria-current={conversation.id === activeConversationId ? 'true' : undefined}
                        onClick={() => onSelect(conversation.id)}
                      >
                        <ChatIcon width={15} height={15} aria-hidden="true" />
                        <span className="zdk-convo-title">{conversation.title}</span>
                        <span className="zdk-convo-time">{shortTime(conversation.updatedAt)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <div className="zdk-rail-foot">
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2.25rem',
              height: '2.25rem',
              flexShrink: 0,
              borderRadius: '50%',
              border: '1px solid var(--zdk-line)',
              background: 'var(--zdk-panel-raised)',
              color: 'var(--zdk-gold)',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}
          >
            {initials(reader?.name)}
          </span>

          <span style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
            <span
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {reader?.name ?? 'Signed out'}
            </span>
            {reader?.plan ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--zdk-text-dim)' }}>
                {reader.plan}
              </span>
            ) : null}
          </span>

          <button type="button" className="zdk-composer-icon" aria-label="Settings">
            <SettingsIcon width={18} height={18} />
          </button>
        </div>
      </nav>
    </>
  );
}

/** A conversation group in the rail. */
interface Group {
  readonly label: string;
  readonly items: readonly Conversation[];
}

/**
 * Groups conversations the way the mockup does: Today, Previous 7 days, then
 * older.
 *
 * Boundaries are calendar days, not elapsed hours. Something from 11pm
 * yesterday is "yesterday" to a reader at 8am even though it is nine hours
 * ago, and a rolling 24-hour window would file it under "Today".
 */
export function groupByRecency(conversations: readonly Conversation[], now: Date = new Date()): Group[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 86_400_000;

  const today: Conversation[] = [];
  const week: Conversation[] = [];
  const older: Conversation[] = [];

  for (const conversation of conversations) {
    const at = conversation.updatedAt.getTime();

    if (at >= startOfToday) today.push(conversation);
    else if (at >= startOfToday - 6 * dayMs) week.push(conversation);
    else older.push(conversation);
  }

  // Newest first within each group.
  const sort = (items: Conversation[]) =>
    [...items].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return [
    { label: 'Today', items: sort(today) },
    { label: 'Previous 7 days', items: sort(week) },
    { label: 'Earlier', items: sort(older) },
    // An empty heading over nothing is noise.
  ].filter((group) => group.items.length > 0);
}

/**
 * A time for the rail: a clock time today, a date before that.
 *
 * Matches the mockup, and is what a reader can actually use — "9:08 AM" tells
 * you which of this morning's threads it was; "Apr 10" tells you it is old.
 */
export function shortTime(at: Date, now: Date = new Date()): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return at.getTime() >= startOfToday
    ? at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Up to two initials, for the account avatar. */
function initials(name: string | undefined): string {
  if (!name) return '·';

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';

  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';

  return (first + last).toUpperCase();
}
