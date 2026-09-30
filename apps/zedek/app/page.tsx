'use client';

import type { Conversation, ZedekMessage } from '@scrinode/types';
import { useCallback, useState } from 'react';
import { Workspace } from '../components/workspace';

/**
 * Zedek's home: the research workspace.
 *
 * ## Why the workspace and not the Studies index
 *
 * §3.3 makes the Study the unit of work, and that is still true — but a Study
 * is chosen *in* the workspace, from the switcher in the top bar, the way a
 * reader would expect. Landing on a list of projects before a reader has any
 * is a wall in front of the product; landing in the room with the Study named
 * above the thread says the same thing and lets them start.
 *
 * ## There is no seeded content here
 *
 * `conversations` and `messages` are empty until the API serves them. The
 * mockup this was built to shows an answer about Romans 8:28 and a list of
 * past threads; none of that is in this file, because §2.2 forbids shipping
 * invented Scripture commentary as product content and §42 forbids fabricating
 * Bible data. The components render that shape faithfully when the data is
 * real.
 *
 * A client component because every piece of state here is interaction state:
 * which conversation is open, what is half-typed. Once `GET /zedek/studies`
 * and `GET /zedek/conversations` exist (§40), the lists come from RTK Query
 * and this keeps only the selection.
 */
export default function ZedekHome() {
  const [conversations] = useState<readonly Conversation[]>([]);
  const [messages] = useState<readonly ZedekMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const startConversation = useCallback(() => {
    // Deliberately inert until `POST /zedek/conversations` exists. Creating a
    // client-side id would produce a thread the server has never heard of, and
    // the first message sent to it would fail — a worse experience than a
    // button that has not been wired yet.
    setActiveConversationId(null);
  }, []);

  return (
    <Workspace
      studyTitle="Untitled Study"
      conversations={conversations}
      messages={messages}
      activeConversationId={activeConversationId}
      onSelectConversation={setActiveConversationId}
      onNewChat={startConversation}
    />
  );
}
