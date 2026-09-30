'use client';

import { ZedekIcon } from '@scrinode/ui';
import type { Conversation, Study, ZedekMessage } from '@scrinode/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Composer } from './composer';
import { Message } from './message';
import { Rail } from './rail';
import { TopBar, type QuickAction } from './topbar';
import { useZedekStream } from './use-zedek-stream';

/**
 * The Zedek workspace — rail, thread, composer.
 *
 * ## What this does and does not own
 *
 * It owns *interaction*: which drawer is open, what is in the composer, where
 * the thread is scrolled. Studies, Conversations and messages are server state
 * and arrive as props from the route, which is what §26 means by keeping RTK
 * Query's data out of component state.
 *
 * Nothing here fabricates a message. The mockup shows an answer about Romans
 * 8:28; that answer is not in this file, because §2.2 forbids shipping
 * invented Scripture commentary as content. With no messages the workspace
 * renders its empty state (§44), which is what a new reader actually sees.
 */

export interface WorkspaceProps {
  /** The Study currently open. Undefined before any exists. */
  readonly activeStudy?: Pick<Study, 'id' | 'title'>;
  /** Every Study the reader may switch to, for the menu. */
  readonly studies: readonly Pick<Study, 'id' | 'title'>[];
  readonly onSelectStudy: (studyId: string) => void;
  readonly onCreateStudy: () => void;
  readonly conversations: readonly Conversation[];
  readonly messages: readonly ZedekMessage[];
  readonly activeConversationId: string | null;
  readonly onSelectConversation: (conversationId: string) => void;
  readonly onNewChat: () => void;
  readonly reader?: { readonly name: string; readonly plan?: string };
  /** Where a turn is POSTed. Defaults to the API's messages endpoint (§40). */
  readonly endpoint?: string;
}

export function Workspace({
  activeStudy,
  studies,
  onSelectStudy,
  onCreateStudy,
  conversations,
  messages,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  reader,
  endpoint,
}: WorkspaceProps) {
  const [railOpen, setRailOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const railToggle = useRef<HTMLButtonElement>(null);
  const thread = useRef<HTMLDivElement>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const { turn, send, cancel } = useZedekStream(
    endpoint ?? `${apiBase}/zedek/conversations/${activeConversationId ?? ''}/messages`,
  );

  /*
   * Focus returns to the toggle when the drawer closes.
   *
   * Without it, closing the drawer drops focus to the top of the document and
   * a keyboard user has to tab back to where they were. The toggle is hidden
   * by CSS once the rail is permanent, and `focus()` on a hidden element is a
   * no-op — which is the behaviour wanted, since there is no drawer to have
   * come back from.
   */
  const closeRail = useCallback(() => {
    setRailOpen(false);
    railToggle.current?.focus();
  }, []);

  const openRail = useCallback(() => setRailOpen(true), []);

  /*
   * Follow the stream.
   *
   * Only while the reader is already near the bottom. Scrolling someone back
   * down while they are reading an earlier answer is the most irritating
   * behaviour a chat interface has, and it is worse here: the thing they have
   * scrolled up to read is usually a citation they are checking (§1's VERIFY).
   */
  useEffect(() => {
    const el = thread.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > 160) return;

    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, turn.content]);

  const submit = useCallback(
    (content: string) => {
      const text = content.trim();
      if (!text || !activeConversationId) return;

      setDraft('');
      void send(activeConversationId, text);
    },
    [activeConversationId, send],
  );

  const runQuickAction = useCallback(
    (action: QuickAction) => {
      // Sent as a question, through the same path as anything typed. A quick
      // action is a prompt, not a second kind of request (§16).
      submit(action.prompt);
    },
    [submit],
  );

  const isEmpty = messages.length === 0 && !turn.content && !turn.streaming;

  // The open conversation, for the title in the bar. Looked up rather than
  // passed separately so the two cannot disagree about which thread is open.
  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="zdk-shell">
      {/* The inset frame from 64rem up. Below it the rail is a drawer, so the
          frame is a plain wrapper and costs nothing. */}
      <div className="zdk-frame">
        <Rail
          open={railOpen}
          onClose={closeRail}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelect={(id) => {
            onSelectConversation(id);
            // A drawer that stays open over the thread it just navigated to
            // hides the thing the reader asked for.
            closeRail();
          }}
          onNewChat={() => {
            onNewChat();
            closeRail();
          }}
          {...(reader ? { reader } : {})}
        />

        <main className="zdk-main">
          <TopBar
            {...(activeStudy ? { activeStudy } : {})}
            {...(activeConversation ? { conversationTitle: activeConversation.title } : {})}
            studies={studies}
            onSelectStudy={onSelectStudy}
            onCreateStudy={onCreateStudy}
            onOpenRail={openRail}
            onQuickAction={runQuickAction}
            busy={turn.streaming}
            railToggleRef={railToggle}
            railOpen={railOpen}
          />

          <div className="zdk-thread" ref={thread}>
            {isEmpty ? (
              <EmptyThread />
            ) : (
              <>
                {messages.map((message) => (
                  <Message key={message.id} message={message} />
                ))}

                {/* The turn in flight. Rendered from the stream rather than
                    optimistically appended to `messages`: the persisted message
                    arrives with its validated citations (§16), and showing an
                    unvalidated one first would flash a citation that is then
                    dropped. */}
                {turn.streaming || turn.content ? <StreamingTurn turn={turn} /> : null}
              </>
            )}

            {/* Politely announced, so a screen-reader user learns the answer
                failed without it interrupting what they are reading. */}
            {turn.error ? (
              <p className="zdk-error" role="status">
                {turn.error}
              </p>
            ) : null}
          </div>

          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={() => submit(draft)}
            streaming={turn.streaming}
            onCancel={cancel}
            disabled={!activeConversationId}
          />
        </main>
      </div>
    </div>
  );
}

/** The answer as it arrives. */
function StreamingTurn({ turn }: { turn: ReturnType<typeof useZedekStream>['turn'] }) {
  return (
    <article className="zdk-turn" data-role="assistant">
      <span className="zdk-avatar" aria-hidden="true">
        <ZedekIcon width={18} height={18} />
      </span>

      <div className="zdk-bubble">
        <p className="zdk-byline">Zedek</p>

        {/*
          The status. §18 fixes the permitted set and forbids exposing private
          chain-of-thought — these say which *stage* is running, never what the
          model is considering.

          `aria-live="polite"` so the stage is announced without cutting off
          whatever is being read.
        */}
        {turn.status ? (
          <p className="zdk-status" aria-live="polite">
            <span className="zdk-status-dot" aria-hidden="true" />
            {turn.status}
          </p>
        ) : null}

        {turn.content ? <p className="zdk-prose">{turn.content}</p> : null}

        {turn.citations.length > 0 ? (
          <ul className="zdk-citations" aria-label="Cited Scripture">
            {turn.citations.map((citation, index) => (
              <li className="zdk-citation" key={`${citation.retrievalUnitId ?? index}`}>
                {citation.text ? <p className="zdk-citation-text">{citation.text}</p> : null}
                <p className="zdk-citation-ref">
                  {citation.label}
                  {citation.translation ? ` · ${citation.translation}` : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

/**
 * The empty state (§44).
 *
 * It says what Zedek is *for* and what it will not do. The second half matters:
 * a reader who expects a general assistant asks general questions, gets "I
 * found nothing relevant" (§16), and concludes the product is broken rather
 * than that it is grounded.
 */
function EmptyThread() {
  return (
    <div className="zdk-empty">
      <span className="zdk-empty-mark" aria-hidden="true">
        <ZedekIcon width={22} height={22} />
      </span>
      <h2 className="zdk-empty-title">Ask about the text</h2>
      <p className="zdk-empty-body">
        Zedek answers from Scripture and your own notes, and cites what it used so you can check it.
        Ask about a passage, a word, a theme, or how two texts speak to each other. Where it finds
        nothing relevant, it will say so rather than guess.
      </p>
    </div>
  );
}
