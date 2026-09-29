/**
 * Prompt assembly, ordered so a provider's cache can actually be used.
 *
 * This is the load-bearing type in the package, and the reason it exists
 * rather than a plain string:
 *
 * Every provider's prompt cache works on a *prefix*. A cache entry matches
 * only while the leading bytes are byte-identical to a previous request, and
 * the match stops at the first difference. So the saving is decided entirely
 * by ordering: stable content first, variable content last. Put the user's
 * question before the system prompt and the cache never hits — at roughly 4x
 * the cost, with no error and no warning.
 *
 * That is why prompts are built from ordered segments here instead of being
 * concatenated by callers. A caller cannot get the order wrong, because the
 * caller does not choose it.
 *
 * AGENTS.md §16 defines the assembly stages; this is the representation they
 * produce.
 */

/**
 * How stable a segment is across the turns of one conversation.
 *
 * Ordered least to most variable, and the numeric values are the sort key —
 * `stability` is the whole mechanism.
 */
export const enum Stability {
  /**
   * Identical for every request Scrinode ever makes: the system prompt, §23's
   * response structure, citation rules.
   */
  Fixed = 0,

  /**
   * Identical for every turn within one Study — its Scripture range, its
   * sources, its accumulated memory (§3.3).
   */
  Study = 1,

  /**
   * Stable within one conversation but not across it: earlier turns. Grows by
   * append, so a prefix of it stays cacheable.
   */
  Conversation = 2,

  /**
   * Different every request: retrieved units for this question, and the
   * question itself.
   */
  Turn = 3,
}

/** One labelled piece of a prompt. */
export interface PromptSegment {
  /** What this is, for cost attribution and debugging. Never sent. */
  readonly label: string;
  readonly stability: Stability;
  readonly text: string;
}

/**
 * A prompt ready to send.
 *
 * `segments` are in cache order. `cacheBoundary` is the index after the last
 * segment worth caching — providers charge to write a cache entry, so caching
 * a segment that changes every turn costs more than not caching it.
 */
export interface AssembledPrompt {
  readonly segments: readonly PromptSegment[];
  readonly cacheBoundary: number;
  /** The reader's question, kept separate: it is the last thing in the prompt. */
  readonly question: string;
}

/**
 * The minimum a cache entry may cover, in characters.
 *
 * Providers impose a minimum cacheable length (around 1,000 tokens for some
 * models) and reject or silently ignore anything shorter. Below it, requesting
 * a cache write pays the write premium for nothing. Four characters per token
 * is the usual English approximation.
 */
export const MIN_CACHEABLE_CHARS = 4_000;

/**
 * Assemble segments into a prompt.
 *
 * Sorting is stable within a stability tier, so callers keep control of order
 * among equally-stable segments while being unable to break the tiers.
 */
export function assemble(
  segments: readonly PromptSegment[],
  question: string,
): AssembledPrompt {
  const ordered = [...segments].sort((a, b) => a.stability - b.stability);

  return {
    segments: ordered,
    cacheBoundary: findCacheBoundary(ordered),
    question,
  };
}

/**
 * Where to stop caching.
 *
 * Everything below `Stability.Turn` is a candidate, but only if the prefix is
 * long enough to be worth a cache entry. Returning 0 means "do not cache",
 * which is the right answer for a short first turn.
 */
function findCacheBoundary(ordered: readonly PromptSegment[]): number {
  let chars = 0;
  let boundary = 0;

  for (const [index, segment] of ordered.entries()) {
    if (segment.stability >= Stability.Turn) break;

    chars += segment.text.length;
    if (chars >= MIN_CACHEABLE_CHARS) boundary = index + 1;
  }

  return boundary;
}

/** The segments a provider should mark as cacheable. */
export function cacheablePrefix(prompt: AssembledPrompt): readonly PromptSegment[] {
  return prompt.segments.slice(0, prompt.cacheBoundary);
}

/** The segments that must be sent fresh every time. */
export function variableSuffix(prompt: AssembledPrompt): readonly PromptSegment[] {
  return prompt.segments.slice(prompt.cacheBoundary);
}

/** Render to a single string, for providers with no structured cache control. */
export function render(prompt: AssembledPrompt): string {
  return [...prompt.segments.map((s) => s.text), prompt.question].join('\n\n');
}
