import { describe, expect, it } from 'vitest';
import { FakeProvider } from './fake-provider.js';
import { MIN_CACHEABLE_CHARS, Stability, assemble, type PromptSegment } from './prompt.js';
import { cacheHitRate } from './usage.js';

const seg = (label: string, stability: Stability, chars: number): PromptSegment => ({
  label,
  stability,
  text: 'x'.repeat(chars),
});

/** A prompt shaped like a real Zedek turn: stable system + memory, fresh units. */
const turn = (question: string, units: string) =>
  assemble(
    [
      seg('system', Stability.Fixed, MIN_CACHEABLE_CHARS),
      seg('study-memory', Stability.Study, 2_000),
      { label: 'retrieved-units', stability: Stability.Turn, text: units },
    ],
    question,
  );

const generate = (provider: FakeProvider, question: string, units: string) =>
  provider.generate({ role: 'fast', prompt: turn(question, units), maxOutputTokens: 700 });

describe('FakeProvider', () => {
  it('sends the stable segments as a cacheable prefix and the units fresh', () => {
    const provider = new FakeProvider();

    void generate(provider, 'q', 'units');

    expect(provider.calls[0]?.cachedLabels).toEqual(['system', 'study-memory']);
    expect(provider.calls[0]?.freshLabels).toEqual(['retrieved-units']);
  });

  describe('across the turns of one conversation', () => {
    it('misses on the first turn and hits on the second', async () => {
      // The first request writes the entry; only the second can hit it. A test
      // asserting a hit on turn one would be asserting something impossible.
      const provider = new FakeProvider();

      await generate(provider, 'first', 'units A');
      await generate(provider, 'second', 'units B');

      expect(provider.calls.map((c) => c.cacheHit)).toEqual([false, true]);
    });

    it('costs less on the cached turn', async () => {
      // The saving, measured rather than asserted in a comment. This is the
      // number that justifies the ordering machinery in prompt.ts.
      const provider = new FakeProvider();

      const first = await generate(provider, 'first', 'units A');
      const second = await generate(provider, 'second', 'units B');

      expect(second.costUsd).toBeLessThan(first.costUsd);
    });

    it('reports a cache hit rate above two thirds once warm', async () => {
      const provider = new FakeProvider();

      await generate(provider, 'first', 'units A');
      const second = await generate(provider, 'second', 'units B');

      expect(cacheHitRate(second.usage)).toBeGreaterThan(0.66);
    });

    it('loses the cache when a variable segment is placed early', async () => {
      // The failure this package exists to prevent, demonstrated. Building the
      // prompt with the question's units marked Fixed puts changing bytes in
      // the prefix, so no two turns share one — and nothing warns you.
      const provider = new FakeProvider();

      const badTurn = (units: string) =>
        assemble(
          [
            seg('system', Stability.Fixed, MIN_CACHEABLE_CHARS),
            { label: 'retrieved-units', stability: Stability.Fixed, text: units },
          ],
          'q',
        );

      await provider.generate({
        role: 'fast',
        prompt: badTurn('units A'),
        maxOutputTokens: 700,
      });
      await provider.generate({
        role: 'fast',
        prompt: badTurn('units B'),
        maxOutputTokens: 700,
      });

      expect(provider.calls.map((c) => c.cacheHit)).toEqual([false, false]);
    });
  });

  describe('streaming', () => {
    it('yields deltas then a final usage chunk', async () => {
      const provider = new FakeProvider('two words');
      const chunks = [];

      for await (const chunk of provider.stream({
        role: 'fast',
        prompt: turn('q', 'units'),
        maxOutputTokens: 700,
      })) {
        chunks.push(chunk);
      }

      expect(chunks.filter((c) => c.type === 'delta')).toHaveLength(2);
      expect(chunks.at(-1)?.type).toBe('done');
    });

    it('stops when the signal aborts', async () => {
      // §18 requires cancellation. A stream that ignores it keeps billing
      // output tokens for a reader who has navigated away.
      const provider = new FakeProvider('one two three four');
      const controller = new AbortController();

      const iterate = async () => {
        for await (const chunk of provider.stream({
          role: 'fast',
          prompt: turn('q', 'units'),
          maxOutputTokens: 700,
          signal: controller.signal,
        })) {
          if (chunk.type === 'delta') controller.abort();
        }
      };

      await expect(iterate()).rejects.toThrow();
    });
  });

  it('embeds without a network call', async () => {
    const provider = new FakeProvider();
    const result = await provider.embed({ texts: ['a', 'bb'], inputType: 'query' });

    expect(result.embeddings).toHaveLength(2);
    expect(result.costUsd).toBe(0);
  });
});
