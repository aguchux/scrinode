import type { GenerativeIntent } from '@scrinode/ai';

/**
 * §16's Intent Router.
 *
 * Two jobs, and the second is a cost control:
 *
 *   1. Decide what machinery serves a question. §14.1 routes each class
 *      differently, and using the wrong one returns worse results rather than
 *      failing.
 *   2. Decide which model role answers it, where a model is involved at all.
 *      `reasoning` costs roughly ten times `fast` (§17), so this classification
 *      is the difference between an affordable product and an unaffordable one.
 *
 * Rule-based, deliberately. Asking a model which model to use pays for an
 * inference on every request to save one, and adds latency ahead of §31's 2s
 * first-chunk target.
 *
 * **This is a router, not a parser.** §42 forbids duplicating reference
 * parsing, which `@scrinode/scripture` owns. What this decides is *which* path
 * a question takes; the reference path then parses it there.
 */

/**
 * What kind of question this is.
 *
 * `reference` and `lookup` never reach a model — they are answered from
 * Postgres, and a free answer is the cheapest kind (§15 puts AI last).
 */
export type QuestionKind =
  /** "John 3:16", "Romans 8:28-30" — parsed, never searched. */
  | 'reference'
  /** "faith without works", "agape" — full-text over translation_texts. */
  | 'lookup'
  /** Everything a model answers. Carries which generative intent it is. */
  | 'generative';

export interface Routed {
  readonly kind: QuestionKind;
  /** Present only when `kind` is 'generative'. */
  readonly intent?: GenerativeIntent;
}

/**
 * A bare Scripture reference.
 *
 * Matches a book name or abbreviation followed by numbers, with nothing else
 * of substance. Deliberately conservative: a false positive sends a real
 * question to the reference path and returns a verse instead of an answer,
 * which is worse than paying for a model. "What does John 3:16 mean" must not
 * match, and does not — the trailing words fail the anchor.
 */
const BARE_REFERENCE =
  /^\s*(?:[1-3]\s*)?[A-Za-z][A-Za-z.]*\s*\d+(?:\s*[:.]\s*\d+(?:\s*[-–]\s*\d+)?)?\s*$/;

/**
 * Words that mark a question as needing genuine reasoning.
 *
 * The test is whether answering means weighing positions against each other.
 * §23 forbids flattening contested theology into one asserted answer, and
 * presenting major interpretations fairly is exactly what a weaker model does
 * badly: it picks one and sounds certain.
 */
const REASONING_MARKERS: readonly { readonly pattern: RegExp; readonly intent: GenerativeIntent }[] =
  [
    // Comparison across texts, translations or positions.
    { pattern: /\b(compare|contrast|differ|difference between|versus|vs\.?)\b/i, intent: 'compare' },

    // Doctrine and disputed readings. "Why" is included because a why-question
    // about Scripture is almost never answerable by restatement.
    {
      pattern:
        /\b(doctrine|doctrinal|theolog\w*|predestin\w*|election|justificat\w*|sanctificat\w*|atonement|trinit\w*|eschatolog\w*|covenant|dispensation\w*|reconcile|contradict\w*|why\b)/i,
      intent: 'theological_question',
    },

    // Tracing something across the canon.
    {
      pattern: /\b(theme|motif|throughout|across|trace|develop\w* (?:through|across)|thread)\b/i,
      intent: 'trace_theme',
    },
  ];

/** Original-language questions. Served `fast`: restatement of lexical data. */
const LANGUAGE_MARKER =
  /\b(greek|hebrew|aramaic|lexeme|lemma|morpholog\w*|septuagint|transliterat\w*|original language)\b/i;

/** Summarisation. Restatement, so `fast`. */
const SUMMARY_MARKER = /\b(summar\w+|outline|overview|gist|in brief)\b/i;

/**
 * A short phrase with no question shape — a keyword or lexical search.
 *
 * Length is the signal rather than grammar: "agape", "faith without works" and
 * "resurrection" are searches; anything longer is a question. Five words is
 * above the longest realistic phrase search and below the shortest real
 * question.
 */
const LOOKUP_MAX_WORDS = 5;

const QUESTION_SHAPE = /[?]|^\s*(what|who|where|when|why|how|does|did|is|are|can|should|explain)\b/i;

export function routeQuestion(question: string): Routed {
  const text = question.trim();

  if (text.length === 0) return { kind: 'generative', intent: 'explain' };

  // A bare reference is parsed, never searched and never sent to a model.
  if (BARE_REFERENCE.test(text)) return { kind: 'reference' };

  const words = text.split(/\s+/).length;

  // A short phrase with no question shape is a search. Checked before the
  // reasoning markers so "predestination" alone is a lookup rather than a
  // reasoning request — the reader wants the passages, not an essay.
  if (words <= LOOKUP_MAX_WORDS && !QUESTION_SHAPE.test(text)) return { kind: 'lookup' };

  for (const marker of REASONING_MARKERS) {
    if (marker.pattern.test(text)) return { kind: 'generative', intent: marker.intent };
  }

  if (LANGUAGE_MARKER.test(text)) return { kind: 'generative', intent: 'original_language' };
  if (SUMMARY_MARKER.test(text)) return { kind: 'generative', intent: 'summarise' };

  // The default is `explain`, which routes to `fast`. Defaulting to `reasoning`
  // would be the safe-feeling choice and would cost ten times as much on the
  // majority of traffic.
  return { kind: 'generative', intent: 'explain' };
}
