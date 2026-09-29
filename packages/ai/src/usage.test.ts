import { describe, expect, it } from 'vitest';
import {
  EMPTY_USAGE,
  addUsage,
  cacheHitRate,
  computeCost,
  type ModelRates,
  type TokenUsage,
} from './usage.js';

const RATES: ModelRates = {
  inputPerMillion: 3,
  cachedInputPerMillion: 0.3,
  cacheWritePerMillion: 3.75,
  outputPerMillion: 15,
  verifiedOn: '2026-09-29',
};

const usage = (partial: Partial<TokenUsage>): TokenUsage => ({ ...EMPTY_USAGE, ...partial });

describe('cost accounting', () => {
  it('bills each token class at its own rate', () => {
    const cost = computeCost(
      usage({ inputTokens: 1_000_000, cachedInputTokens: 1_000_000, outputTokens: 1_000_000 }),
      RATES,
    );

    expect(cost).toBeCloseTo(3 + 0.3 + 15, 6);
  });

  it('charges a premium for writing a cache entry', () => {
    // A first turn costs *more* than an uncached one. Ignoring this makes
    // caching look free at the start of every conversation, which it is not,
    // and would overstate the saving on short conversations.
    const write = computeCost(usage({ cacheWriteTokens: 1_000_000 }), RATES);
    const plain = computeCost(usage({ inputTokens: 1_000_000 }), RATES);

    expect(write).toBeGreaterThan(plain);
  });

  it('makes a cached turn cheaper than an uncached one', () => {
    // The claim the whole design rests on, asserted rather than assumed.
    const uncached = computeCost(usage({ inputTokens: 5_000, outputTokens: 700 }), RATES);
    const cached = computeCost(
      usage({ inputTokens: 500, cachedInputTokens: 4_500, outputTokens: 700 }),
      RATES,
    );

    expect(cached).toBeLessThan(uncached);
  });

  it('sums usage across requests', () => {
    const total = addUsage(
      usage({ inputTokens: 10, outputTokens: 5 }),
      usage({ inputTokens: 3, cachedInputTokens: 7, outputTokens: 1 }),
    );

    expect(total).toEqual({
      inputTokens: 13,
      cachedInputTokens: 7,
      cacheWriteTokens: 0,
      outputTokens: 6,
    });
  });
});

describe('cacheHitRate', () => {
  it('counts cached tokens against all input, not against output', () => {
    // Output must not dilute the rate: a long answer would otherwise make
    // caching look broken.
    const rate = cacheHitRate(
      usage({ inputTokens: 250, cachedInputTokens: 750, outputTokens: 10_000 }),
    );

    expect(rate).toBeCloseTo(0.75, 6);
  });

  it('counts a cache write as a miss', () => {
    // It is one: the entry did not exist, and full price was paid for it.
    expect(cacheHitRate(usage({ cacheWriteTokens: 1_000 }))).toBe(0);
  });

  it('returns zero rather than dividing by zero when nothing was sent', () => {
    expect(cacheHitRate(EMPTY_USAGE)).toBe(0);
  });
});
