import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  routeRole,
  type AIProvider,
  type AIModelRole,
  type TokenUsage,
} from '@scrinode/ai';
import type { Citation, ZedekStreamEvent } from '@scrinode/types';
import {
  RetrievalRepository,
  type RetrievedUnit,
} from '../database/retrieval.repository';
import { ZedekRepository } from '../database/zedek.repository';
import { AI_PROVIDER } from './zedek.constants';
import { validateCitations } from './citations';
import { routeQuestion } from './intent';
import { HISTORY_TURNS, buildPrompt } from './prompt.builder';

/**
 * Zedek's orchestration — §16, end to end.
 *
 *   route intent → retrieve → build prompt → generate → validate → persist
 *
 * §19 is explicit that RAG must not be "question → vector search → chunks →
 * model", and the two stages that make the difference are the first and the
 * fifth: a question that Postgres can answer never reaches a model, and an
 * answer's citations are checked against what was actually retrieved before the
 * reader sees them.
 */

/** How many units to retrieve. Every one is input tokens on every turn. */
const RETRIEVAL_LIMIT = 8;

/**
 * Minimum similarity for a unit to enter the prompt.
 *
 * Measured against real queries rather than guessed: observed scores for good
 * answers ran 0.47-0.68, and a correct Leviticus result scored 0.47. A cutoff
 * at 0.5 would have discarded it, so this sits below that — deliberately
 * permissive, because §3.3's "say when nothing is relevant" is enforced by the
 * model being told the passages are thin, not by hiding them.
 */
const MIN_SCORE = 0.35;

/** Ceiling on a response. §23's structure is bounded; this makes it explicit. */
const MAX_OUTPUT_TOKENS = 1_200;

export interface AskInput {
  readonly conversationId: string;
  readonly userId: string;
  readonly question: string;
  /** Translations this reader may be served — resolved by the caller (§22.1). */
  readonly translations: readonly string[];
}

@Injectable()
export class ZedekService {
  private readonly logger = new Logger(ZedekService.name);

  constructor(
    private readonly repository: ZedekRepository,
    private readonly retrieval: RetrievalRepository,
    @Inject(AI_PROVIDER) private readonly provider: AIProvider,
  ) {}

  /**
   * Answer a question in a conversation, streaming §18's events.
   *
   * An async generator rather than a callback: the controller owns the SSE
   * transport and this owns the orchestration, so neither knows about the
   * other's failure modes. Cancellation propagates by the consumer stopping
   * iteration, which §18 requires.
   */
  async *ask(input: AskInput, signal?: AbortSignal): AsyncGenerator<ZedekStreamEvent> {
    // Ownership first, before any work is done or any token spent (§33).
    const conversation = await this.repository.findConversation(
      input.conversationId,
      input.userId,
    );

    if (!conversation) {
      // A missing conversation and another reader's conversation are the same
      // error deliberately: distinguishing them leaks which ids exist.
      throw new NotFoundException('Conversation not found.');
    }

    const routed = routeQuestion(input.question);

    // §15 puts AI last. A reference or a keyword search is answered from
    // Postgres by the scripture and search modules, not here — this service
    // exists for what a model answers. Telling the caller rather than silently
    // paying for generation is the point.
    if (routed.kind !== 'generative') {
      yield {
        type: 'error',
        message:
          routed.kind === 'reference'
            ? 'That looks like a Scripture reference. Open it in the reader rather than asking Zedek.'
            : 'That looks like a search. Use search to find passages, then ask Zedek about them.',
      };
      return;
    }

    yield { type: 'status', message: 'Loading Scripture...' };

    await this.repository.appendUserMessage(input.conversationId, input.question);

    // ---- Retrieval ----

    yield { type: 'tool', tool: 'searchBible', state: 'started' };

    const units = await this.retrieve(input, signal);

    yield { type: 'tool', tool: 'searchBible', state: 'completed' };

    if (units.length === 0) {
      // §3.3: when retrieval returns nothing relevant, Zedek says so. Spending
      // a generation here would produce an answer from the model's own weights,
      // which §2.2 forbids — so this does not call the provider at all.
      const message =
        'I could not find passages in your available translations that address this. ' +
        'Try rephrasing, or narrow the question to a passage you are reading.';

      yield { type: 'content', delta: message };

      const saved = await this.repository.appendAssistantMessage({
        conversationId: input.conversationId,
        content: message,
        citations: [],
        model: {
          provider: 'none',
          name: 'no-retrieval',
          inputTokens: 0,
          cachedTokens: 0,
          outputTokens: 0,
          costUsd: 0,
        },
      });

      yield { type: 'complete', messageId: saved.id };
      return;
    }

    // ---- Prompt ----

    const study = await this.loadStudy(conversation.study_id);
    const history = await this.loadHistory(input.conversationId, input.userId);

    const prompt = buildPrompt({
      question: input.question,
      units,
      ...(study ? { study } : {}),
      history,
    });

    const role: AIModelRole = routeRole(routed.intent ?? 'explain', {
      contextChars: prompt.segments.reduce((sum, s) => sum + s.text.length, 0),
    });

    // ---- Generation ----

    yield { type: 'status', message: 'Generating response...' };

    let content = '';
    let usage: TokenUsage | undefined;
    let costUsd = 0;

    for await (const chunk of this.provider.stream({
      role,
      prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      ...(signal ? { signal } : {}),
    })) {
      if (chunk.type === 'delta') {
        content += chunk.text;
        yield { type: 'content', delta: chunk.text };
        continue;
      }

      usage = chunk.usage;
      costUsd = chunk.costUsd;
    }

    // ---- Citation validation ----

    // §16 runs this before the response is delivered. The prose has already
    // streamed — the citations have not, and they are what makes a claim
    // checkable (§1's VERIFY step).
    const { valid, rejected } = validateCitations(extractCitations(content, units), units);

    if (rejected.length > 0) {
      // §34 wants this visible: a rising rejection rate is the signal that a
      // prompt or a model has started inventing references.
      this.logger.warn(
        `Rejected ${rejected.length} citation(s) in conversation ${input.conversationId}: ` +
          rejected.map((r) => r.reason).join('; '),
      );
    }

    for (const citation of valid) {
      yield { type: 'citation', citation };
    }

    // ---- Persist ----

    const saved = await this.repository.appendAssistantMessage({
      conversationId: input.conversationId,
      content,
      citations: valid.map((citation) => ({
        kind: citation.kind,
        label: citation.label,
        retrieval_unit_id: citation.retrievalUnitId ?? null,
        canonical_reference: citation.canonicalReference ?? null,
        translation: citation.translation ?? null,
        text: citation.text ?? null,
      })),
      model: {
        provider: this.provider.constructor.name,
        name: this.provider.modelFor(role),
        inputTokens: usage?.inputTokens ?? 0,
        cachedTokens: usage?.cachedInputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        costUsd,
      },
    });

    yield { type: 'complete', messageId: saved.id };
  }

  /**
   * A conversation's messages with their citations.
   *
   * Ownership-filtered in the query, so a conversation belonging to another
   * reader returns empty rather than 403 — the same reasoning as `ask`: telling
   * the two apart leaks which ids exist.
   */
  async history(conversationId: string, userId: string) {
    const rows = await this.repository.listMessages(conversationId, userId);

    return rows.map(({ message, citations }) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.created_at,
      citations: citations.map((citation) => ({
        kind: citation.kind,
        label: citation.label,
        ...(citation.retrieval_unit_id ? { retrievalUnitId: citation.retrieval_unit_id } : {}),
        ...(citation.canonical_reference
          ? { canonicalReference: citation.canonical_reference }
          : {}),
        ...(citation.translation ? { translation: citation.translation } : {}),
        ...(citation.text ? { text: citation.text } : {}),
      })),
      // Cost and token counts are deliberately not returned. §34 wants them
      // recorded and visible to operators, not to readers — a per-answer price
      // in the interface would change how people ask questions.
    }));
  }

  /**
   * Retrieve and filter units.
   *
   * The question is embedded as a *query*; stored text used *document*. Voyage
   * prepends a different instruction for each, and mismatching them measurably
   * degrades results without failing.
   */
  private async retrieve(input: AskInput, signal?: AbortSignal): Promise<RetrievedUnit[]> {
    const embedded = await this.provider.embed({
      texts: [input.question],
      inputType: 'query',
      ...(signal ? { signal } : {}),
    });

    const vector = embedded.embeddings[0];
    if (!vector) return [];

    const units = await this.retrieval.search(vector, {
      translations: input.translations,
      limit: RETRIEVAL_LIMIT,
    });

    return units.filter((unit) => unit.score >= MIN_SCORE);
  }

  /**
   * The Study's standing context — §3.3's per-Study memory.
   *
   * No ownership filter here, and that is safe rather than sloppy: the
   * conversation was ownership-checked above, and a conversation carries its
   * Study's owner, so reaching this point proves the Study is the reader's.
   */
  private async loadStudy(studyId: string) {
    const [study, findings] = await Promise.all([
      this.repository.findStudyById(studyId),
      this.repository.listFindings(studyId),
    ]);

    if (!study) return undefined;

    return {
      title: study.title,
      ...(study.description ? { description: study.description } : {}),
      scriptureFocus: study.scripture_focus,
      findings,
    };
  }

  private async loadHistory(conversationId: string, userId: string) {
    const rows = await this.repository.listMessages(conversationId, userId);

    // The window is applied by the prompt builder; taking a little more here
    // costs one query rather than several.
    return rows.slice(-(HISTORY_TURNS + 2)).map((row) => ({
      role: row.message.role,
      content: row.message.content,
    }));
  }
}

/**
 * Pull citations out of a response.
 *
 * The model cites by unit id (the prompt supplies them), so this finds those
 * references and resolves each against the units actually retrieved. It does
 * **not** trust anything else the model wrote about the passage: the label,
 * reference, translation and text all come from the retrieved row, never from
 * the response.
 *
 * That is the point. A citation assembled from the model's own words would be
 * exactly the unverifiable claim §2.2 forbids, however plausible it looked.
 */
export function extractCitations(
  content: string,
  units: readonly RetrievedUnit[],
): Citation[] {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const seen = new Set<string>();
  const citations: Citation[] = [];

  // Matches the form the prompt uses: [unit <id>].
  for (const match of content.matchAll(/\[unit\s+([A-Za-z0-9._:-]+)\]/g)) {
    const id = match[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const unit = byId.get(id);

    // An unresolvable id becomes a citation with no unit, which validation then
    // rejects. Dropping it here instead would hide a model inventing ids —
    // exactly the signal §34 wants counted.
    citations.push(
      unit
        ? {
            kind: 'scripture',
            label: unit.referenceStart ?? unit.id,
            retrievalUnitId: unit.id,
            ...(unit.referenceStart ? { canonicalReference: unit.referenceStart } : {}),
            ...(unit.translation ? { translation: unit.translation } : {}),
            text: unit.text,
          }
        : { kind: 'scripture', label: id, retrievalUnitId: id },
    );
  }

  return citations;
}
