import { describe, expect, it } from 'vitest';
import {
  MIN_CACHEABLE_CHARS,
  Stability,
  assemble,
  cacheablePrefix,
  render,
  variableSuffix,
  type PromptSegment,
} from './prompt.js';

const segment = (
  label: string,
  stability: Stability,
  chars = 100,
): PromptSegment => ({ label, stability, text: 'x'.repeat(chars) });

/** Long enough that the prefix clears the provider minimum on its own. */
const big = (label: string, stability: Stability) =>
  segment(label, stability, MIN_CACHEABLE_CHARS);

describe('prompt assembly', () => {
  it('orders segments stable-first regardless of the order given', () => {
    // The whole saving depends on this. A provider's cache matches on a
    // prefix, so a variable segment placed early truncates every cache entry
    // after it — at roughly 4x cost, with no error to notice.
    const prompt = assemble(
      [
        segment('retrieved-units', Stability.Turn),
        segment('system', Stability.Fixed),
        segment('history', Stability.Conversation),
        segment('study-memory', Stability.Study),
      ],
      'What does Romans 8:28 mean?',
    );

    expect(prompt.segments.map((s) => s.label)).toEqual([
      'system',
      'study-memory',
      'history',
      'retrieved-units',
    ]);
  });

  it('keeps the caller ordering among equally stable segments', () => {
    // Sort must be stable: two Fixed segments have a meaningful order the
    // caller chose, and reordering them would change the rendered prompt.
    const prompt = assemble(
      [
        segment('system-a', Stability.Fixed),
        segment('system-b', Stability.Fixed),
        segment('system-c', Stability.Fixed),
      ],
      'q',
    );

    expect(prompt.segments.map((s) => s.label)).toEqual(['system-a', 'system-b', 'system-c']);
  });

  it('never places the question anywhere but last', () => {
    const prompt = assemble([segment('system', Stability.Fixed)], 'the question');

    expect(render(prompt).endsWith('the question')).toBe(true);
  });

  describe('cache boundary', () => {
    it('excludes turn-variable segments from the cacheable prefix', () => {
      const prompt = assemble(
        [big('system', Stability.Fixed), segment('retrieved-units', Stability.Turn)],
        'q',
      );

      expect(cacheablePrefix(prompt).map((s) => s.label)).toEqual(['system']);
      expect(variableSuffix(prompt).map((s) => s.label)).toEqual(['retrieved-units']);
    });

    it('declines to cache a prefix below the provider minimum', () => {
      // Providers charge a premium to write a cache entry. Caching 200
      // characters pays that premium for a saving that cannot repay it, and
      // some providers ignore the request entirely.
      const prompt = assemble(
        [segment('system', Stability.Fixed, 100), segment('memory', Stability.Study, 100)],
        'q',
      );

      expect(prompt.cacheBoundary).toBe(0);
      expect(cacheablePrefix(prompt)).toEqual([]);
    });

    it('caches the whole stable run once it clears the minimum', () => {
      const prompt = assemble(
        [
          big('system', Stability.Fixed),
          big('study-memory', Stability.Study),
          segment('retrieved', Stability.Turn),
        ],
        'q',
      );

      expect(cacheablePrefix(prompt).map((s) => s.label)).toEqual(['system', 'study-memory']);
    });

    it('stops at the first turn-variable segment even if stable ones follow', () => {
      // Defends against a caller hand-building the array. Ordering is applied
      // first, so this cannot happen through assemble() — but cacheBoundary is
      // a public contract and a wrong answer here would silently cost money.
      const prompt = assemble(
        [
          big('system', Stability.Fixed),
          segment('retrieved', Stability.Turn),
          big('late-memory', Stability.Study),
        ],
        'q',
      );

      expect(cacheablePrefix(prompt).map((s) => s.label)).toEqual(['system', 'late-memory']);
      expect(variableSuffix(prompt).map((s) => s.label)).toEqual(['retrieved']);
    });
  });
});
