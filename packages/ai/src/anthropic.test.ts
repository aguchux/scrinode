import { describe, expect, it, vi } from 'vitest';
import { AnthropicProvider, systemBlocks, userContent } from './anthropic.js';
import { MIN_CACHEABLE_CHARS, Stability, assemble, type PromptSegment } from './prompt.js';

const seg = (label: string, stability: Stability, chars: number): PromptSegment => ({
  label,
  stability,
  text: `${label}:${'x'.repeat(chars)}`,
});

/** A prompt shaped like a real Zedek turn. */
const turn = (question = 'What does Romans 8:28 mean?') =>
  assemble(
    [
      seg('system', Stability.Fixed, MIN_CACHEABLE_CHARS),
      seg('study-memory', Stability.Study, 2_000),
      seg('retrieved-units', Stability.Turn, 500),
    ],
    question,
  );

/** A response with the usage shape the adapter reads. */
const reply = (usage: Record<string, number> = {}) =>
  new Response(
    JSON.stringify({
      content: [{ type: 'text', text: 'An answer.' }],
      usage: { input_tokens: 100, output_tokens: 50, ...usage },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const bodyOf = (fetchImpl: ReturnType<typeof vi.fn>): Record<string, unknown> =>
  JSON.parse((fetchImpl.mock.calls[0]?.[1] as { body: string }).body);

describe('AnthropicProvider', () => {
  describe('cache control on the wire', () => {
    it('marks the last cacheable system block and no other', () => {
      // Anthropic caches up to and including the marked block, so one marker is
      // correct. Marking every block requests several entries and pays several
      // write premiums for one prefix.
      const blocks = systemBlocks(turn());

      expect(blocks).toHaveLength(2);
      expect(blocks[0]?.cache_control).toBeUndefined();
      expect(blocks[1]?.cache_control).toEqual({ type: 'ephemeral' });
    });

    it('sends no system blocks when the prefix is too short to cache', () => {
      // Below the provider minimum, a cache write costs more than it saves.
      const short = assemble([seg('system', Stability.Fixed, 50)], 'q');

      expect(systemBlocks(short)).toEqual([]);
    });

    it('keeps turn-variable content out of the cached blocks', () => {
      // The failure this whole package exists to prevent: retrieved units in
      // the cached prefix means no two turns share a prefix, so nothing ever
      // hits — at roughly 4x cost and with no error.
      const texts = systemBlocks(turn()).map((b) => b.text);

      expect(texts.some((t) => t.startsWith('retrieved-units'))).toBe(false);
    });

    it('puts the question last in the user turn', () => {
      const content = userContent(turn('the question'));

      expect(content.endsWith('the question')).toBe(true);
      expect(content).toContain('retrieved-units');
    });

    it('includes the marker in the request body actually sent', () => {
      // systemBlocks() being right is not enough — the request must carry it.
      const fetchImpl = vi.fn().mockResolvedValue(reply());
      const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl });

      void provider.generate({ role: 'fast', prompt: turn(), maxOutputTokens: 700 });

      const system = bodyOf(fetchImpl).system as { cache_control?: unknown }[];
      expect(system.filter((b) => b.cache_control !== undefined)).toHaveLength(1);
    });
  });

  describe('request shape', () => {
    it('sends the role-appropriate model and the output cap', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(reply());
      const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl });

      await provider.generate({ role: 'fast', prompt: turn(), maxOutputTokens: 700 });

      const body = bodyOf(fetchImpl);
      expect(body.model).toBe(provider.modelFor('fast'));
      expect(body.max_tokens).toBe(700);
    });

    it('sends the API version header', async () => {
      // Anthropic rejects a request without it.
      const fetchImpl = vi.fn().mockResolvedValue(reply());
      const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl });

      await provider.generate({ role: 'fast', prompt: turn(), maxOutputTokens: 700 });

      const headers = (fetchImpl.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers;
      expect(headers['anthropic-version']).toBe('2023-06-01');
      expect(headers['x-api-key']).toBe('k');
    });

    it('omits temperature rather than sending undefined', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(reply());
      const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl });

      await provider.generate({ role: 'fast', prompt: turn(), maxOutputTokens: 700 });

      expect('temperature' in bodyOf(fetchImpl)).toBe(false);
    });

    it('uses reasoning and fast models that differ', () => {
      // If these collapse to one model the routing in router.ts saves nothing,
      // and the ~10x assumption behind it is silently false.
      const provider = new AnthropicProvider({ apiKey: 'k' });

      expect(provider.modelFor('reasoning')).not.toBe(provider.modelFor('fast'));
    });
  });

  describe('usage accounting', () => {
    it('reads cache reads and writes into their own classes', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        reply({ cache_read_input_tokens: 4_500, cache_creation_input_tokens: 0 }),
      );
      const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl });

      const result = await provider.generate({
        role: 'fast',
        prompt: turn(),
        maxOutputTokens: 700,
      });

      expect(result.usage.cachedInputTokens).toBe(4_500);
      expect(result.usage.cacheWriteTokens).toBe(0);
    });

    it('costs less for a cache read than for the same tokens uncached', async () => {
      // The saving, measured against real published rates rather than asserted.
      const cachedFetch = vi.fn().mockResolvedValue(
        reply({ input_tokens: 500, cache_read_input_tokens: 4_500 }),
      );
      const plainFetch = vi.fn().mockResolvedValue(reply({ input_tokens: 5_000 }));

      const cached = await new AnthropicProvider({ apiKey: 'k', fetchImpl: cachedFetch }).generate({
        role: 'fast',
        prompt: turn(),
        maxOutputTokens: 700,
      });
      const plain = await new AnthropicProvider({ apiKey: 'k', fetchImpl: plainFetch }).generate({
        role: 'fast',
        prompt: turn(),
        maxOutputTokens: 700,
      });

      expect(cached.costUsd).toBeLessThan(plain.costUsd);
    });
  });

  describe('failures', () => {
    it('refuses to embed rather than silently using another model', async () => {
      // The stored index is voyage-4. A query embedded elsewhere is not
      // comparable to it, and the search would return nonsense rather than
      // error — so this must fail loudly.
      const provider = new AnthropicProvider({ apiKey: 'k' });

      await expect(provider.embed({ texts: ['a'], inputType: 'query' })).rejects.toThrow(/Voyage/);
    });

    it('rejects a request for a model Anthropic does not serve', () => {
      const provider = new AnthropicProvider({ apiKey: 'k' });

      expect(() => provider.modelFor('embedding')).toThrow(/no embedding model/);
    });

    it('does not leak the vendor error body to the caller', async () => {
      // A provider error body can echo the prompt, and prompts carry the
      // reader's own notes (§33).
      const secret = 'PROMPT CONTENTS: the user private note';
      const fetchImpl = vi.fn().mockResolvedValue(new Response(secret, { status: 400 }));
      const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl });

      await expect(
        provider.generate({ role: 'fast', prompt: turn(), maxOutputTokens: 700 }),
      ).rejects.toThrow(/rejected the request/);

      await expect(
        provider.generate({ role: 'fast', prompt: turn(), maxOutputTokens: 700 }),
      ).rejects.not.toThrow(new RegExp(secret));
    });
  });
});
