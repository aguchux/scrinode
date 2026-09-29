/**
 * Token and cost accounting — AGENTS.md §34.
 *
 * §34 lists `token usage` and `AI cost` as things to track early, and this
 * exists because none of the cost work above it can be verified otherwise.
 * Whether prompt caching engaged, whether the router is sending too much to
 * `reasoning`, which queries are expensive — all of it is guesswork without
 * per-request numbers.
 *
 * Cost is computed here rather than read from a provider response because
 * most providers do not return one. A rate table is the only honest way, and
 * being explicit about it means a stale price is visible rather than assumed.
 */

/** What one request consumed. */
export interface TokenUsage {
  /** Input tokens billed at the full rate. */
  readonly inputTokens: number;

  /**
   * Input tokens served from the provider's prompt cache.
   *
   * Counted separately because they are billed at a fraction of the input
   * rate — typically a tenth. Folding them into `inputTokens` would hide the
   * single largest saving in the system, and a caching regression would then
   * look like ordinary traffic growth.
   */
  readonly cachedInputTokens: number;

  /**
   * Input tokens billed at a premium to *write* a cache entry.
   *
   * Providers charge more for the first request that populates a cache than
   * for an uncached one. Ignoring this makes caching look free on the first
   * turn of every conversation, which it is not.
   */
  readonly cacheWriteTokens: number;

  readonly outputTokens: number;
}

export const EMPTY_USAGE: TokenUsage = {
  inputTokens: 0,
  cachedInputTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
};

/**
 * Price per million tokens, in USD.
 *
 * Deliberately data rather than code: prices change, and a rate that lives in
 * a table can be updated and asserted. Every rate carries the date it was
 * read, because a silently stale price produces confidently wrong reporting.
 */
export interface ModelRates {
  readonly inputPerMillion: number;
  readonly cachedInputPerMillion: number;
  readonly cacheWritePerMillion: number;
  readonly outputPerMillion: number;
  /** ISO date these rates were last verified against the vendor's page. */
  readonly verifiedOn: string;
}

/** Cost in USD for one request. */
export function computeCost(usage: TokenUsage, rates: ModelRates): number {
  const perMillion = (tokens: number, rate: number) => (tokens / 1_000_000) * rate;

  return (
    perMillion(usage.inputTokens, rates.inputPerMillion) +
    perMillion(usage.cachedInputTokens, rates.cachedInputPerMillion) +
    perMillion(usage.cacheWriteTokens, rates.cacheWritePerMillion) +
    perMillion(usage.outputTokens, rates.outputPerMillion)
  );
}

/** Sum usage across requests, for a conversation or a reporting window. */
export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
}

/**
 * The share of input tokens served from cache, 0 to 1.
 *
 * The number to watch. If it sits near zero on multi-turn conversations, the
 * prompt is being assembled in a way the cache cannot use — which costs
 * roughly 4x and produces no error.
 */
export function cacheHitRate(usage: TokenUsage): number {
  const total = usage.inputTokens + usage.cachedInputTokens + usage.cacheWriteTokens;

  return total === 0 ? 0 : usage.cachedInputTokens / total;
}
