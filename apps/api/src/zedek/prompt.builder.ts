import { Stability, assemble, type AssembledPrompt, type PromptSegment } from '@scrinode/ai';
import type { RetrievedUnit } from '../database/retrieval.repository';

/**
 * §16's Context Builder and Prompt Assembly stages.
 *
 * The ordering is not this file's decision — `assemble()` sorts by stability,
 * so what matters here is assigning the right tier to each segment. Get a tier
 * wrong and the prompt cache stops hitting at roughly 4x the cost, with no
 * error (§17).
 *
 * The tiers, and why each segment sits where it does:
 *
 *   Fixed         the system prompt. Identical for every request Scrinode
 *                 ever makes, so it anchors every cache entry.
 *   Study         the Study's memory. Identical across that Study's turns.
 *   Conversation  earlier turns, append-only so a prefix survives.
 *   Turn          retrieved units — different every question by definition.
 */

/**
 * Zedek's instructions.
 *
 * A constant, not a template. Interpolating anything into it — a date, a user
 * name, a Study title — would make it differ per request and destroy the cache
 * prefix that every other saving depends on. Per-Study content goes in the
 * Study segment, which is cacheable at its own tier.
 *
 * The content encodes §2, §22 and §23 rather than restating them loosely,
 * because this text is the only thing standing between a grounded answer and
 * a confident invention.
 *
 * **Its length is load-bearing, and was wrong once.** A first draft came to
 * 1,370 characters — under `MIN_CACHEABLE_CHARS`, so `cacheBoundary` correctly
 * declined to cache it and the entire saving was lost. A test caught it. The
 * fix is not padding: it is stating the rules the first draft left implicit,
 * each of which a model does get wrong unprompted. If this ever shrinks below
 * the floor again, the prompt stops caching silently.
 */
export const SYSTEM_PROMPT = `You are Zedek, the Scripture-grounded research assistant inside Scrinode.

Scrinode is a Bible study and research workspace. Readers come to you with a passage in front of them, or a question arising from one. Your work is to help them understand, verify and build on the text — not to replace their reading of it.

You answer from the Scripture passages and sources supplied to you in this prompt. You do not answer from memory.

GROUNDING
- Every claim about what the text says must come from a supplied passage.
- If the supplied passages do not answer the question, say so plainly and stop. Do not fall back on recollection, and do not offer a general answer in place of a grounded one. A reader is better served by "the passages I have do not address this" than by something plausible.
- Never quote, paraphrase or reconstruct a verse that was not supplied, even if you are confident of its wording. Your recollection of a translation is not a source, and a reader cannot check it.
- Do not introduce a cross-reference from memory. If a related passage was not supplied, you may name the connection as something worth examining, but you may not quote or characterise what it says.

CITATIONS
- Each supplied passage carries a unit identifier. Cite by that identifier.
- A citation must name the identifier of a passage supplied in this prompt. A citation you cannot tie to one must not appear at all.
- Quote verbatim. Do not modernise spelling, adjust punctuation, smooth archaic grammar or harmonise wording across translations. The reader compares your quotation against the passage itself, and a tidied quotation fails that comparison.
- Name the translation when you quote. Different translations render the same verse differently, and a reader working in one needs to know which they are reading.

RESPONSE STRUCTURE
Follow this order, omitting any part the supplied passages do not support:
1. Textual observation — what the passage says.
2. Historical or literary context.
3. Major interpretations, where the passage is contested.
4. Cross references, drawn only from supplied passages.
5. Source notes.

Keep the parts distinguishable. A reader must be able to tell what the text states from what you have inferred from it.

CONTESTED READINGS
Where serious interpreters disagree, present the major readings and what each rests on textually. Do not choose one and present it as settled. Do not invent a denominational consensus, and do not attribute a position to a tradition unless the supplied sources do.

Where a passage has a long interpretive history, say that the question is contested before summarising it. A reader who does not know a reading is disputed cannot weigh it.

BOUNDARIES
- Distinguish what the text states, what is inferred, what is tradition, and what is application.
- You are an assistant, not a spiritual authority. You may explain what a passage has been understood to require; you may not tell a reader what they must do, believe, or decide about their own life.
- Do not assume a reader's tradition, and do not adopt one as a default voice.
- Do not reveal or narrate your own reasoning process. Give the reader your findings and the textual grounds for them.
- Where a question is historical, linguistic or factual rather than interpretive, and the supplied sources do not cover it, say so rather than supplying it yourself.`;

export interface StudyContext {
  readonly title: string;
  readonly description?: string;
  /** Canonical references the Study is about (§10). */
  readonly scriptureFocus: readonly string[];
  /** Short established statements. Never a transcript (§3.3). */
  readonly findings: readonly string[];
}

export interface PriorTurn {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface BuildInput {
  readonly question: string;
  readonly units: readonly RetrievedUnit[];
  readonly study?: StudyContext;
  readonly history?: readonly PriorTurn[];
}

/**
 * How many prior turns to carry.
 *
 * A window, not the whole conversation. §3.3 forbids replaying a transcript,
 * and the cost argument is concrete: unbounded history makes turn 30 cost five
 * times turn 5 for no better answer, because retrieval already supplies the
 * Scripture. What persists across a Study is its memory, not its dialogue.
 */
export const HISTORY_TURNS = 6;

/** Longest prior message carried, in characters. */
const MAX_TURN_CHARS = 2_000;

export function buildPrompt(input: BuildInput): AssembledPrompt {
  const segments: PromptSegment[] = [
    { label: 'system', stability: Stability.Fixed, text: SYSTEM_PROMPT },
  ];

  if (input.study) {
    const study = renderStudy(input.study);
    if (study) segments.push({ label: 'study-memory', stability: Stability.Study, text: study });
  }

  const history = renderHistory(input.history ?? []);
  if (history) {
    segments.push({ label: 'history', stability: Stability.Conversation, text: history });
  }

  segments.push({
    label: 'retrieved-units',
    stability: Stability.Turn,
    text: renderUnits(input.units),
  });

  return assemble(segments, input.question);
}

/**
 * The Study's standing context.
 *
 * Stable across the Study's turns, which is what makes it cacheable at its own
 * tier — and the reason a reader researching Romans across six conversations
 * does not pay to re-establish that each time (§3.3).
 */
function renderStudy(study: StudyContext): string {
  const lines = [`Study: ${study.title}`];

  if (study.description) lines.push(study.description);

  if (study.scriptureFocus.length > 0) {
    lines.push(`Scripture in focus: ${study.scriptureFocus.join(', ')}`);
  }

  if (study.findings.length > 0) {
    lines.push('', 'Established in this Study so far:');
    for (const finding of study.findings) lines.push(`- ${finding}`);
  }

  return lines.length > 1 ? lines.join('\n') : '';
}

function renderHistory(history: readonly PriorTurn[]): string {
  // The most recent turns, oldest first. Taking from the end keeps the window
  // current; rendering oldest-first keeps the text append-only, so a cache
  // prefix from the previous turn still matches.
  const recent = history.slice(-HISTORY_TURNS);
  if (recent.length === 0) return '';

  const lines = ['Earlier in this conversation:'];

  for (const turn of recent) {
    const speaker = turn.role === 'user' ? 'Reader' : 'Zedek';
    lines.push(`${speaker}: ${truncate(turn.content, MAX_TURN_CHARS)}`);
  }

  return lines.join('\n\n');
}

/**
 * The retrieved passages.
 *
 * Each carries its unit id, because that id is what a citation must reference
 * for §16's validation to pass. Without it the model has nothing to cite by,
 * and every Scripture citation would be rejected.
 */
function renderUnits(units: readonly RetrievedUnit[]): string {
  if (units.length === 0) {
    // Said explicitly rather than sending an empty section. §3.3 requires
    // Zedek to say when retrieval found nothing, and a silent gap invites the
    // model to fill it from memory — precisely what §2.2 forbids.
    return 'No passages were retrieved for this question. Tell the reader you have nothing to answer from.';
  }

  const lines = ['Passages retrieved for this question:', ''];

  for (const unit of units) {
    const reference = unit.referenceEnd && unit.referenceEnd !== unit.referenceStart
      ? `${unit.referenceStart}-${unit.referenceEnd}`
      : (unit.referenceStart ?? 'unknown reference');

    lines.push(`[unit ${unit.id}] ${reference} (${unit.translation ?? 'unknown'}, ${unit.unitType})`);
    lines.push(unit.text);
    lines.push('');
  }

  return lines.join('\n');
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}
