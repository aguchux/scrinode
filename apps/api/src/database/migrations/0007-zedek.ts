import type { PoolClient } from 'pg';
import type { Migration } from '../migration.types';

/**
 * Zedek's storage — Studies, Conversations, Messages and Study memory.
 *
 * §3.3 fixes the hierarchy and §45 fixes the names:
 *
 *   Study          a project — a sermon series, a book study, a question
 *   └── Conversation   one thread within it
 *       └── Message
 *
 * A Study is a `workspace` with type `research` (§3.3), so this does not
 * introduce a parallel primitive — `studies` is a view over `workspaces` in
 * spirit, but a table here because §24 prefers narrow tables to a wide row
 * carrying a `jsonb` discriminator, and because a Study carries columns a
 * sermon workspace does not.
 *
 * Deliberate choices worth keeping:
 *
 * **`citations` is a table, not a `jsonb` column.** §24 forbids `jsonb` where a
 * table would do, and §16's citation validation has to *query* citations — "did
 * this message cite a retrieval unit that exists" is a join, not a document
 * scan. It is also what makes a citation checkable rather than asserted (§2.2).
 *
 * **Messages are rows, never an array on the conversation.** §24 is explicit,
 * and an unbounded array column cannot be paginated or indexed.
 *
 * **Study memory is a table of findings, not a transcript.** §3.3 forbids
 * replaying raw messages into a prompt: it defeats retrieval, grows without
 * bound and spends tokens re-reading what the model already concluded. Each
 * finding is short and independently traceable.
 *
 * **`ON DELETE CASCADE` throughout.** A reader deleting a Study must not leave
 * orphaned conversations holding their research — §33's ownership rules make
 * that a data-protection matter, not tidiness.
 */
export const migration0007: Migration = {
  version: 7,
  name: 'zedek',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE studies (
        id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

        -- uuid, matching users.id from migration 0003. Auth.js owns that
        -- table and quotes some of its column names (§24's stated exception),
        -- but id is lower case and needs no quoting.
        user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        title           text        NOT NULL CHECK (length(trim(title)) > 0),
        description     text,

        -- Archived studies stay readable and stop appearing in listings.
        -- A CHECK rather than application validation: §24 requires the
        -- constraint hold against every writer, including a psql session.
        status          text        NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'archived')),

        -- What the Study is about, as canonical reference ids (§10). Seeds
        -- retrieval so a conversation about Romans need not restate it.
        --
        -- An array here rather than a table: these are a handful of opaque
        -- identifiers with no attributes of their own, read and replaced whole.
        -- §24's warning is about *unbounded* arrays — messages, citations —
        -- which this is not.
        scripture_focus text[]      NOT NULL DEFAULT '{}',

        -- Subject to §22.1's availability gate at read time. Stored, not
        -- trusted: the registry decides what may be served, and a translation
        -- can lose availability after a Study was created.
        translation     text,

        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Every listing is "this reader's active studies, most recent first".
    await client.query(`
      CREATE INDEX studies_user_status_idx
        ON studies (user_id, status, updated_at DESC)
    `);

    await client.query(`
      CREATE TABLE conversations (
        id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

        -- A Conversation belongs to exactly one Study (§3.3). NOT NULL is the
        -- enforcement: a conversation with no Study has nowhere to keep what
        -- it learned, which is the point of the hierarchy.
        study_id         uuid        NOT NULL REFERENCES studies(id) ON DELETE CASCADE,

        -- Denormalised from the Study so an ownership check is one read rather
        -- than a join. §33 requires an ownership check on every access, so this
        -- is the hot path. Kept honest by a trigger-free rule: only the
        -- repository writes conversations, and it copies the Study's owner.
        user_id          uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        -- Derived from the first message when absent. Never invented by a
        -- model without the reader seeing it.
        title            text        NOT NULL CHECK (length(trim(title)) > 0),

        -- Where the reader was when this began, if they arrived from Scripture
        -- (§11). Two columns rather than jsonb: both are scalars, and §24
        -- prefers columns.
        opening_reference   text,
        opening_translation text,

        created_at       timestamptz NOT NULL DEFAULT now(),
        updated_at       timestamptz NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX conversations_study_idx
        ON conversations (study_id, updated_at DESC)
    `);

    await client.query(`
      CREATE TABLE messages (
        id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

        role            text        NOT NULL CHECK (role IN ('user', 'assistant')),
        content         text        NOT NULL,

        -- §34 tracks token usage and AI cost. Recorded per message because
        -- that is the only granularity at which an expensive conversation can
        -- be distinguished from a long one.
        --
        -- Nullable: a user message has no model and no cost.
        model_provider  text,
        model_name      text,
        input_tokens    integer     CHECK (input_tokens >= 0),
        cached_tokens   integer     CHECK (cached_tokens >= 0),
        output_tokens   integer     CHECK (output_tokens >= 0),

        -- Stored in micro-dollars as an integer. A float would accumulate
        -- rounding error across a month of sums, and per-request costs are
        -- small enough that six decimal places matter.
        cost_micro_usd  bigint      CHECK (cost_micro_usd >= 0),

        created_at      timestamptz NOT NULL DEFAULT now()
      )
    `);

    // A conversation is always read in order, oldest first.
    await client.query(`
      CREATE INDEX messages_conversation_idx
        ON messages (conversation_id, created_at)
    `);

    await client.query(`
      CREATE TABLE message_citations (
        id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id      uuid        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

        kind            text        NOT NULL
                                    CHECK (kind IN ('scripture', 'research-source',
                                                    'lexical', 'historical')),
        label           text        NOT NULL,

        -- What makes a citation checkable rather than asserted (§2.2). §16's
        -- validation rejects a Scripture citation that cannot be resolved back
        -- to a unit that was actually retrieved.
        --
        -- No FK to retrieval_units: a unit may be re-embedded or removed, and
        -- losing the audit trail of what a past answer cited would be worse
        -- than holding a stale id. Validation happens at write time.
        retrieval_unit_id text,

        canonical_reference text,
        translation       text,

        -- The cited text, verbatim as retrieved. Never paraphrased (§22.3) and
        -- never regenerated by a model — the reader compares it against the
        -- passage itself.
        text              text,

        created_at        timestamptz NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX message_citations_message_idx
        ON message_citations (message_id)
    `);

    await client.query(`
      CREATE TABLE study_findings (
        id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        study_id      uuid        NOT NULL REFERENCES studies(id) ON DELETE CASCADE,

        -- Short and self-contained. This is what goes into a prompt as the
        -- Study's memory, so length here is a token cost on every turn.
        text          text        NOT NULL CHECK (length(trim(text)) > 0),

        created_at    timestamptz NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX study_findings_study_idx
        ON study_findings (study_id, created_at DESC)
    `);

    // A finding's own citations, so §2.2 holds for remembered claims too. A
    // finding replayed into a prompt without its grounding is exactly the
    // unattributed assertion §2 forbids.
    await client.query(`
      CREATE TABLE study_finding_citations (
        id                uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
        finding_id        uuid  NOT NULL REFERENCES study_findings(id) ON DELETE CASCADE,
        kind              text  NOT NULL
                                CHECK (kind IN ('scripture', 'research-source',
                                                'lexical', 'historical')),
        label             text  NOT NULL,
        retrieval_unit_id text,
        canonical_reference text,
        translation       text,
        text              text
      )
    `);

    await client.query(`
      CREATE INDEX study_finding_citations_finding_idx
        ON study_finding_citations (finding_id)
    `);
  },

  async down(client: PoolClient): Promise<void> {
    // Reverse creation order: a child table's FK prevents dropping its parent.
    await client.query('DROP TABLE IF EXISTS study_finding_citations');
    await client.query('DROP TABLE IF EXISTS study_findings');
    await client.query('DROP TABLE IF EXISTS message_citations');
    await client.query('DROP TABLE IF EXISTS messages');
    await client.query('DROP TABLE IF EXISTS conversations');
    await client.query('DROP TABLE IF EXISTS studies');
  },
};
