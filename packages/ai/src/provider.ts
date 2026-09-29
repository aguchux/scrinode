import type { AIModelRole } from './roles.js';
import type { AssembledPrompt } from './prompt.js';
import type { ModelRates, TokenUsage } from './usage.js';

/**
 * The provider abstraction — AGENTS.md §17.
 *
 * Product logic depends on this and never on a vendor. §8 enforces it with a
 * lint rule: vendor AI SDKs are importable only inside this package.
 *
 * `embed` sits on the same interface as `generate` deliberately. Embeddings
 * come from a different vendor than generation (Voyage, not OpenAI), and
 * keeping them on one interface is what lets the caller stay ignorant of that.
 */

export interface GenerateInput {
  readonly role: AIModelRole;
  readonly prompt: AssembledPrompt;
  /**
   * Ceiling on the response.
   *
   * §23's structure is bounded by nature, so a cap makes that explicit rather
   * than trusting the model to stop. Also the only hard limit on output cost.
   */
  readonly maxOutputTokens: number;
  readonly temperature?: number;
  /** Aborts the request. §18 requires cancellation. */
  readonly signal?: AbortSignal;
}

export interface GenerateResult {
  readonly text: string;
  readonly usage: TokenUsage;
  /** Which concrete model served this. Recorded, never branched on. */
  readonly model: string;
  readonly costUsd: number;
}

/**
 * A fragment of a streamed response.
 *
 * Deliberately not `ZedekStreamEvent`: that is Zedek's wire protocol, carrying
 * citations and statuses this layer knows nothing about. A provider emits text
 * and, at the end, usage. Conflating the two would put §18's protocol inside
 * the vendor adapters.
 */
export type AIStreamChunk =
  | { readonly type: 'delta'; readonly text: string }
  | { readonly type: 'done'; readonly usage: TokenUsage; readonly costUsd: number };

export interface EmbedInput {
  readonly texts: readonly string[];
  /**
   * Whether these are stored documents or a search query.
   *
   * Mismatching this measurably degrades retrieval — the embedding model
   * prepends a different instruction for each. Everything ingested is a
   * document; a reader's question is a query.
   */
  readonly inputType: 'document' | 'query';
  readonly signal?: AbortSignal;
}

export interface EmbedResult {
  readonly embeddings: readonly (readonly number[])[];
  readonly totalTokens: number;
  readonly model: string;
  readonly costUsd: number;
}

export interface AIProvider {
  /** Which concrete model this provider serves for a role, for logging. */
  modelFor(role: AIModelRole): string;
  ratesFor(role: AIModelRole): ModelRates;

  generate(input: GenerateInput): Promise<GenerateResult>;
  stream(input: GenerateInput): AsyncIterable<AIStreamChunk>;
  embed(input: EmbedInput): Promise<EmbedResult>;
}

/** Raised for any provider failure. Never carries a vendor payload (§33). */
export class AIProviderError extends Error {
  /**
   * Named `detail` rather than `cause`: `Error.cause` already exists and is
   * typed `unknown`, so reusing the name would override it with a narrower
   * type and lose whatever a caller passed through the standard field.
   */
  readonly detail: { readonly status?: number; readonly retryable: boolean } | undefined;

  constructor(message: string, detail?: { readonly status?: number; readonly retryable: boolean }) {
    super(message);
    this.name = 'AIProviderError';
    this.detail = detail;
  }
}
