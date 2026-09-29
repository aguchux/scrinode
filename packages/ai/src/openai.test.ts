import { describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from './openai.js';
import { MIN_CACHEABLE_CHARS, Stability, assemble, type PromptSegment } from './prompt.js';

const seg = (label: string, stability: Stability, chars: number): PromptSegment => ({
  label,
  stability,
  text: `${label}:${'x'.repeat(chars)}`,
});

const turn = (question = 'What does Romans 8:28 mean?') =>
  assemble(
    [
      seg('system', Stability.Fixed, MIN_CACHEABLE_CHARS),
      seg('study-memory', Stability.Study, 2_000),
      seg('retrieved-units', Stability.Turn, 500),
    ],
    question,
  );

const reply = (usage: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: 'An answer.' } }],
      usage: { prompt_tokens: 5_000, completion_tokens: 700, ...usage },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const bodyOf = (fetchImpl: ReturnType<typeof vi.fn>): Record<string, unknown> =>
  JSON.parse((fetchImpl.mock.calls[0]?.[1] as { body: string }).body);

describe('OpenAIProvider', () => {
  describe('prefix ordering', () => {
    it('sends the cacheable prefix as a leading system message', async () => {
      // OpenAI matches leading tokens with no marker to place, so position is
      // the only mechanism. The system message must come first.
      const fetchImpl = vi.fn().mockResolvedValue(reply());
      const provider = new OpenAIProvider({ apiKey: 'k', fetchImpl });

      await provider.generate({ role: 'fast', prompt: turn(), maxOutputTokens: 700 });

      const messages = bodyOf(fetchImpl).messages as { role: string; content: string }[];
      expect(messages[0]?.role).toBe('system');
      expect(messages[0]?.content.startsWith('system:')).toBe(true);
    });

    it('keeps turn-variable content out of the leading message', async () => {
      // Retrieved units in the prefix means no two turns share leading tokens,
      // so nothing ever caches — at roughly 4x cost and with nothing to notice.
      const fetchImpl = vi.fn().mockResolvedValue(reply());
      const provider = new OpenAIProvider({ apiKey: 'k', fetchImpl });

      await provider.generate({ role: 'fast', prompt: turn(), maxOutputTokens: 700 });

      const messages = bodyOf(fetchImpl).messages as { role: string; content: string }[];
      expect(messages[0]?.content).not.toContain('retrieved-units');
      expect(messages[1]?.content).toContain('retrieved-units');
    });

    it('puts the question last in the final message', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(reply());
      const provider = new OpenAIProvider({ apiKey: 'k', fetchImpl });

      await provider.generate({ role: 'fast', prompt: turn('the question'), maxOutputTokens: 700 });

      const messages = bodyOf(fetchImpl).messages as { content: string }[];
      expect(messages.at(-1)?.content.endsWith('the question')).toBe(true);
    });

    it('sends only a user message when the prefix is too short to cache', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(reply());
      const provider = new OpenAIProvider({ apiKey: 'k', fetchImpl });

      await provider.generate({
        role: 'fast',
        prompt: assemble([seg('system', Stability.Fixed, 50)], 'q'),
        maxOutputTokens: 700,
      });

      const messages = bodyOf(fetchImpl).messages as { role: string }[];
      expect(messages).toHaveLength(1);
      expect(messages[0]?.role).toBe('user');
    });
  });

  describe('usage accounting', () => {
    it('subtracts cached tokens from the reported prompt total', async () => {
      // prompt_tokens is the TOTAL, cached included. Reading it as uncached
      // input double-counts the cached portion and would report a cached turn
      // as more expensive than an uncached one — the opposite of the truth.
      const fetchImpl = vi.fn().mockResolvedValue(
        reply({ prompt_tokens: 5_000, prompt_tokens_details: { cached_tokens: 4_500 } }),
      );
      const provider = new OpenAIProvider({ apiKey: 'k', fetchImpl });

      const result = await provider.generate({
        role: 'fast',
        prompt: turn(),
        maxOutputTokens: 700,
      });

      expect(result.usage.inputTokens).toBe(500);
      expect(result.usage.cachedInputTokens).toBe(4_500);
    });

    it('attributes no cache-write tokens', async () => {
      // OpenAI charges no premium to populate a cache entry, unlike Anthropic.
      // Inventing a write cost here would overstate the first turn.
      const fetchImpl = vi.fn().mockResolvedValue(reply());
      const provider = new OpenAIProvider({ apiKey: 'k', fetchImpl });

      const result = await provider.generate({
        role: 'fast',
        prompt: turn(),
        maxOutputTokens: 700,
      });

      expect(result.usage.cacheWriteTokens).toBe(0);
    });

    it('never reports negative input when cached exceeds the total', async () => {
      // Defensive: a vendor reporting inconsistent counts must not produce a
      // negative cost that quietly offsets other requests in a daily total.
      const fetchImpl = vi.fn().mockResolvedValue(
        reply({ prompt_tokens: 100, prompt_tokens_details: { cached_tokens: 500 } }),
      );
      const provider = new OpenAIProvider({ apiKey: 'k', fetchImpl });

      const result = await provider.generate({
        role: 'fast',
        prompt: turn(),
        maxOutputTokens: 700,
      });

      expect(result.usage.inputTokens).toBe(0);
      expect(result.costUsd).toBeGreaterThanOrEqual(0);
    });

    it('costs less for a cached turn than an uncached one', async () => {
      const cachedFetch = vi.fn().mockResolvedValue(
        reply({ prompt_tokens: 5_000, prompt_tokens_details: { cached_tokens: 4_500 } }),
      );
      const plainFetch = vi.fn().mockResolvedValue(reply({ prompt_tokens: 5_000 }));

      const cached = await new OpenAIProvider({ apiKey: 'k', fetchImpl: cachedFetch }).generate({
        role: 'fast',
        prompt: turn(),
        maxOutputTokens: 700,
      });
      const plain = await new OpenAIProvider({ apiKey: 'k', fetchImpl: plainFetch }).generate({
        role: 'fast',
        prompt: turn(),
        maxOutputTokens: 700,
      });

      expect(cached.costUsd).toBeLessThan(plain.costUsd);
    });
  });

  describe('streaming', () => {
    it('asks for usage, which is otherwise omitted from a stream', async () => {
      // Without stream_options.include_usage a streamed call reports no cost,
      // leaving §34 blind to exactly the requests that stream.
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response('data: [DONE]\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      );
      const provider = new OpenAIProvider({ apiKey: 'k', fetchImpl });

      for await (const _ of provider.stream({
        role: 'fast',
        prompt: turn(),
        maxOutputTokens: 700,
      })) {
        // drain
      }

      expect(bodyOf(fetchImpl).stream_options).toEqual({ include_usage: true });
    });

    it('yields deltas then a final usage chunk', async () => {
      const events = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        'data: {"choices":[{"delta":{"content":" world"}}]}',
        'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":2}}',
        'data: [DONE]',
      ].join('\n\n');

      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(`${events}\n\n`, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      );
      const provider = new OpenAIProvider({ apiKey: 'k', fetchImpl });

      const chunks = [];
      for await (const chunk of provider.stream({
        role: 'fast',
        prompt: turn(),
        maxOutputTokens: 700,
      })) {
        chunks.push(chunk);
      }

      expect(chunks.filter((c) => c.type === 'delta').map((c) => c.text)).toEqual([
        'Hello',
        ' world',
      ]);
      expect(chunks.at(-1)).toMatchObject({ type: 'done' });
    });
  });

  describe('embeddings', () => {
    it('sorts results by index rather than trusting arrival order', async () => {
      // The response shape does not guarantee order, and a mismatched vector
      // silently attaches to the wrong text.
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              { embedding: [2], index: 1 },
              { embedding: [1], index: 0 },
            ],
            usage: { prompt_tokens: 4 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
      const provider = new OpenAIProvider({ apiKey: 'k', fetchImpl });

      const result = await provider.embed({ texts: ['a', 'b'], inputType: 'document' });

      expect(result.embeddings).toEqual([[1], [2]]);
    });

    it('fails when the count does not match the input', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ embedding: [1], index: 0 }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      const provider = new OpenAIProvider({ apiKey: 'k', fetchImpl });

      await expect(
        provider.embed({ texts: ['a', 'b'], inputType: 'document' }),
      ).rejects.toThrow(/Expected 2 embeddings/);
    });
  });
});
