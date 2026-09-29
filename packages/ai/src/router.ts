import type { AIModelRole } from './roles.js';

/**
 * Which model role serves a question — AGENTS.md §16's Intent Router.
 *
 * This is a cost control as much as a quality one. `reasoning` costs roughly
 * ten times `fast`, and most of what a reader asks is not a reasoning problem:
 * "what does this verse say" is retrieval plus restatement. Routing everything
 * to `reasoning` is the single most expensive default available.
 *
 * Deliberately rule-based rather than model-classified. Asking a model which
 * model to use pays for an inference on every request to save one, and adds
 * latency ahead of §31's 2s first-chunk target.
 */

/**
 * The intent classes §14 enumerates.
 *
 * Only the classes that reach a model appear here. `reference_query`,
 * `keyword_query` and `phrase_query` are answered from Postgres and never
 * reach this router at all — §15 puts AI last, and a free answer is the
 * cheapest kind.
 */
export type GenerativeIntent =
  | 'explain'
  | 'compare'
  | 'theological_question'
  | 'trace_theme'
  | 'original_language'
  | 'summarise';

/**
 * Intents that need genuine reasoning.
 *
 * The test is whether an answer requires weighing positions against each
 * other. §23 forbids flattening contested theology into one asserted answer,
 * and presenting major interpretations fairly is exactly what a weaker model
 * does badly — it picks one and sounds confident.
 */
const NEEDS_REASONING: readonly GenerativeIntent[] = [
  'theological_question',
  'compare',
  'trace_theme',
];

export interface RouteOptions {
  /**
   * How much retrieved context the prompt carries, in characters.
   *
   * Past a threshold the choice stops being about difficulty: a model whose
   * context window cannot hold the prompt cannot answer at any quality.
   */
  readonly contextChars?: number;
}

/**
 * Characters above which `long-context` is required regardless of intent.
 *
 * Set from what §19's retrieval actually produces: eight units plus study
 * memory and history runs to roughly 20k characters, so this leaves headroom
 * before a genuinely large prompt forces the issue.
 */
export const LONG_CONTEXT_CHARS = 80_000;

export function routeRole(intent: GenerativeIntent, options: RouteOptions = {}): AIModelRole {
  if ((options.contextChars ?? 0) >= LONG_CONTEXT_CHARS) return 'long-context';

  return NEEDS_REASONING.includes(intent) ? 'reasoning' : 'fast';
}
