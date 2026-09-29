import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './database.constants';
import { BaseRepository } from './repository.base';

/**
 * Studies, Conversations and Messages.
 *
 * **Every read takes a `userId` and filters on it.** §33 requires an ownership
 * check on every access, and doing it in the query rather than after the fetch
 * is what makes it unforgettable: a caller cannot receive someone else's Study
 * and neglect to check. A missing row and an unowned row are indistinguishable
 * to the caller by design — telling them apart would leak which ids exist.
 *
 * Writes that span tables go through one transaction, so a persisted message
 * never exists without its citations (§16 makes the citations the grounding;
 * a message without them is an unattributed assertion).
 */

export interface StudyRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: 'active' | 'archived';
  scripture_focus: string[];
  translation: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationRow {
  id: string;
  study_id: string;
  user_id: string;
  title: string;
  opening_reference: string | null;
  opening_translation: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  model_provider: string | null;
  model_name: string | null;
  input_tokens: number | null;
  cached_tokens: number | null;
  output_tokens: number | null;
  cost_micro_usd: string | null;
  created_at: Date;
}

export interface CitationRow {
  message_id: string;
  kind: 'scripture' | 'research-source' | 'lexical' | 'historical';
  label: string;
  retrieval_unit_id: string | null;
  canonical_reference: string | null;
  translation: string | null;
  text: string | null;
}

/** What a completed assistant turn records. §25: persist messages, not tokens. */
export interface AssistantTurn {
  readonly conversationId: string;
  readonly content: string;
  readonly citations: readonly Omit<CitationRow, 'message_id'>[];
  readonly model: {
    readonly provider: string;
    readonly name: string;
    readonly inputTokens: number;
    readonly cachedTokens: number;
    readonly outputTokens: number;
    readonly costUsd: number;
  };
}

@Injectable()
export class ZedekRepository extends BaseRepository {
  constructor(@Inject(PG_POOL) pool: Pool) {
    super(pool, 'studies');
  }

  // ---- Studies ----

  async createStudy(input: {
    userId: string;
    title: string;
    description?: string;
    scriptureFocus?: readonly string[];
    translation?: string;
  }): Promise<StudyRow> {
    const row = await this.queryOne<StudyRow>(
      `INSERT INTO studies (user_id, title, description, scripture_focus, translation)
            VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
      [
        input.userId,
        input.title,
        input.description ?? null,
        [...(input.scriptureFocus ?? [])],
        input.translation ?? null,
      ],
    );

    // INSERT ... RETURNING always yields a row or throws, so this is
    // unreachable — but the type says otherwise and a cast would hide a real
    // failure behind a null later.
    if (!row) throw new Error('Insert returned no row.');

    return row;
  }

  async findStudy(id: string, userId: string): Promise<StudyRow | null> {
    return this.queryOne<StudyRow>(`SELECT * FROM studies WHERE id = $1 AND user_id = $2`, [
      id,
      userId,
    ]);
  }

  /**
   * A Study by id, without an ownership filter.
   *
   * Used only where ownership is already established — a conversation carries
   * its Study's owner, so a conversation that passed `findConversation` proves
   * the Study is the reader's. Every caller-facing path uses `findStudy`, which
   * filters.
   */
  async findStudyById(id: string): Promise<StudyRow | null> {
    return this.queryOne<StudyRow>(`SELECT * FROM studies WHERE id = $1`, [id]);
  }

  async listStudies(userId: string, limit = 50): Promise<StudyRow[]> {
    return this.queryMany<StudyRow>(
      `SELECT * FROM studies
        WHERE user_id = $1 AND status = 'active'
        ORDER BY updated_at DESC
        LIMIT $2`,
      [userId, limit],
    );
  }

  /**
   * A Study's findings, most recent first.
   *
   * Capped, because these go into every prompt for that Study: an uncapped
   * memory is an unbounded token cost on every turn, which is the linear
   * growth §3.3 exists to avoid.
   */
  async listFindings(studyId: string, limit = 20): Promise<string[]> {
    const rows = await this.queryMany<{ text: string }>(
      `SELECT text FROM study_findings
        WHERE study_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [studyId, limit],
    );

    return rows.map((row) => row.text);
  }

  // ---- Conversations ----

  /**
   * Create a conversation inside a Study.
   *
   * Returns null when the Study is not the caller's: the ownership check is the
   * insert's own SELECT, so a conversation can never be attached to a Study the
   * caller does not own, even if a service forgot to check first.
   */
  async createConversation(input: {
    studyId: string;
    userId: string;
    title: string;
    openingReference?: string;
    openingTranslation?: string;
  }): Promise<ConversationRow | null> {
    return this.queryOne<ConversationRow>(
      `INSERT INTO conversations
              (study_id, user_id, title, opening_reference, opening_translation)
       SELECT id, user_id, $3, $4, $5
         FROM studies
        WHERE id = $1 AND user_id = $2
    RETURNING *`,
      [
        input.studyId,
        input.userId,
        input.title,
        input.openingReference ?? null,
        input.openingTranslation ?? null,
      ],
    );
  }

  async findConversation(id: string, userId: string): Promise<ConversationRow | null> {
    return this.queryOne<ConversationRow>(
      `SELECT * FROM conversations WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
  }

  async listConversations(studyId: string, userId: string): Promise<ConversationRow[]> {
    return this.queryMany<ConversationRow>(
      `SELECT * FROM conversations
        WHERE study_id = $1 AND user_id = $2
        ORDER BY updated_at DESC`,
      [studyId, userId],
    );
  }

  // ---- Messages ----

  /**
   * A conversation's messages, oldest first, with their citations.
   *
   * Two queries rather than a join: a join would repeat the message content
   * once per citation, and an answer's text is the largest column here.
   */
  async listMessages(
    conversationId: string,
    userId: string,
  ): Promise<{ message: MessageRow; citations: CitationRow[] }[]> {
    const messages = await this.queryMany<MessageRow>(
      `SELECT m.* FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE m.conversation_id = $1 AND c.user_id = $2
        ORDER BY m.created_at`,
      [conversationId, userId],
    );

    if (messages.length === 0) return [];

    const citations = await this.queryMany<CitationRow>(
      `SELECT message_id, kind, label, retrieval_unit_id,
              canonical_reference, translation, text
         FROM message_citations
        WHERE message_id = ANY($1)`,
      [messages.map((m) => m.id)],
    );

    const byMessage = new Map<string, CitationRow[]>();
    for (const citation of citations) {
      const list = byMessage.get(citation.message_id) ?? [];
      list.push(citation);
      byMessage.set(citation.message_id, list);
    }

    return messages.map((message) => ({
      message,
      citations: byMessage.get(message.id) ?? [],
    }));
  }

  /** Append a reader's message. Ownership is the caller's to have checked. */
  async appendUserMessage(conversationId: string, content: string): Promise<MessageRow> {
    const row = await this.queryOne<MessageRow>(
      `INSERT INTO messages (conversation_id, role, content)
            VALUES ($1, 'user', $2)
         RETURNING *`,
      [conversationId, content],
    );

    if (!row) throw new Error('Insert returned no row.');

    return row;
  }

  /**
   * Persist a completed assistant turn with its citations and cost.
   *
   * One transaction: a message without its citations is an unattributed claim
   * (§2.4), and a cost recorded without its message cannot be attributed at all
   * (§34). Either both land or neither does.
   *
   * Also bumps the conversation and its Study, so listings order by real
   * activity rather than creation.
   */
  async appendAssistantMessage(turn: AssistantTurn): Promise<MessageRow> {
    return this.transaction(async (client) => {
      const { rows } = await client.query<MessageRow>(
        `INSERT INTO messages
                (conversation_id, role, content, model_provider, model_name,
                 input_tokens, cached_tokens, output_tokens, cost_micro_usd)
              VALUES ($1, 'assistant', $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
        [
          turn.conversationId,
          turn.content,
          turn.model.provider,
          turn.model.name,
          turn.model.inputTokens,
          turn.model.cachedTokens,
          turn.model.outputTokens,
          // Micro-dollars as an integer: a float would accumulate rounding
          // error across a month of sums, and per-request costs are small
          // enough that six decimal places matter.
          Math.round(turn.model.costUsd * 1_000_000),
        ],
      );

      const message = rows[0];
      if (!message) throw new Error('Insert returned no row.');

      for (const citation of turn.citations) {
        await client.query(
          `INSERT INTO message_citations
                  (message_id, kind, label, retrieval_unit_id,
                   canonical_reference, translation, text)
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            message.id,
            citation.kind,
            citation.label,
            citation.retrieval_unit_id,
            citation.canonical_reference,
            citation.translation,
            citation.text,
          ],
        );
      }

      await client.query(
        `UPDATE conversations SET updated_at = now() WHERE id = $1`,
        [turn.conversationId],
      );

      await client.query(
        `UPDATE studies SET updated_at = now()
          WHERE id = (SELECT study_id FROM conversations WHERE id = $1)`,
        [turn.conversationId],
      );

      return message;
    });
  }
}
