import { cacheablePrefix, render, variableSuffix, type AssembledPrompt } from './prompt.js';
import { parseSse, postJson } from './http.js';
import {
  AIProviderError,
  type AIProvider,
  type AIStreamChunk,
  type EmbedInput,
  type EmbedResult,
  type GenerateInput,
  type GenerateResult,
} from './provider.js';
import type { AIModelRole } from './roles.js';
import { computeCost, type ModelRates, type TokenUsage } from './usage.js';

/**
 * Anthropic adapter.
 *
 * A plain fetch wrapper rather than the vendor SDK. §8 confines vendor SDKs to
 * this package, and the Messages contract used here is small enough that an SDK
 * would add a dependency without adding anything else — the same call already
 * made for Voyage in the ingestion package.
 *
 * Contract, verified against Anthropic's reference 2026-09-29:
 *   POST https://api.anthropic.com/v1/messages
 *   x-api-key, anthropic-version: 2023-06-01
 *   { model, max_tokens, system: [...], messages: [...], stream? }
 *   -> { content: [{ type: 'text', text }], usage: {
 *          input_tokens, output_tokens,
 *          cache_creation_input_tokens, cache_read_input_tokens } }
 *
 * **Caching is explicit here**, unlike OpenAI. A `cache_control` marker on a
 * system block tells Anthropic to cache up to and including that block, and
 * nothing is cached without one. The marker goes at `cacheBoundary`, which is
 * the entire reason prompt.ts orders segments.
 */

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/**
 * Which model serves each role.
 *
 * Product code names a role, never a model (§17). Changing a model here is a
 * one-line change that no caller sees.
 */
const MODELS: Record<AIModelRole, string> = {
  reasoning: 'claude-opus-5-5',
  fast: 'claude-haiku-4-5-20251001',
  'long-context': 'claude-opus-5-5',
  // Anthropic has no embedding model. Retrieval uses Voyage, and asking this
  // adapter to embed is a wiring error worth failing loudly on.
  embedding: '',
};

/**
 * Price per million tokens, USD.
 *
 * `verifiedOn` is not decoration: a silently stale rate produces confidently
 * wrong cost reporting, which is worse than none. A cache read is a tenth of
 * input; a cache write is 1.25x, which is why a short prefix is not worth
 * caching at all.
 */
const REASONING_RATES: ModelRates = {
  inputPerMillion: 15,
  cachedInputPerMillion: 1.5,
  cacheWritePerMillion: 18.75,
  outputPerMillion: 75,
  verifiedOn: '2026-09-29',
};

const RATES: Record<AIModelRole, ModelRates> = {
  reasoning: REASONING_RATES,
  'long-context': REASONING_RATES,
  fast: {
    inputPerMillion: 1,
    cachedInputPerMillion: 0.1,
    cacheWritePerMillion: 1.25,
    outputPerMillion: 5,
    verifiedOn: '2026-09-29',
  },
  embedding: {
    inputPerMillion: 0,
    cachedInputPerMillion: 0,
    cacheWritePerMillion: 0,
    outputPerMillion: 0,
    verifiedOn: '2026-09-29',
  },
};

interface SystemBlock {
  readonly type: 'text';
  readonly text: string;
  readonly cache_control?: { readonly type: 'ephemeral' };
}

interface AnthropicUsage {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly cache_creation_input_tokens?: number;
  readonly cache_read_input_tokens?: number;
}

export interface AnthropicOptions {
  readonly apiKey: string;
  readonly maxAttempts?: number;
  readonly fetchImpl?: typeof fetch;
}

export class AnthropicProvider implements AIProvider {
  constructor(private readonly options: AnthropicOptions) {}

  modelFor(role: AIModelRole): string {
    const model = MODELS[role];
    if (!model) {
      throw new AIProviderError(`Anthropic serves no ${role} model.`, { retryable: false });
    }

    return model;
  }

  ratesFor(role: AIModelRole): ModelRates {
    return RATES[role];
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const payload = await postJson<{
      content?: { type?: string; text?: string }[];
      usage?: AnthropicUsage;
    }>(this.request(input, false));

    const text = (payload.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');

    const usage = toUsage(payload.usage);

    return {
      text,
      usage,
      model: this.modelFor(input.role),
      costUsd: computeCost(usage, this.ratesFor(input.role)),
    };
  }

  async *stream(input: GenerateInput): AsyncIterable<AIStreamChunk> {
    const { url, headers, body, signal, fetchImpl } = this.request(input, true);
    const doFetch = fetchImpl ?? fetch;

    const response = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });

    if (!response.ok || !response.body) {
      throw new AIProviderError('The AI provider could not start a stream.', {
        status: response.status,
        retryable: response.status === 429 || response.status >= 500,
      });
    }

    // Usage arrives across two events: input counts on message_start, output on
    // message_delta. Accumulated rather than read once, or a streamed answer
    // reports no input cost at all.
    let usage: TokenUsage = {
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
    };

    for await (const event of parseSse(response.body)) {
      const typed = event as {
        type?: string;
        delta?: { type?: string; text?: string };
        message?: { usage?: AnthropicUsage };
        usage?: AnthropicUsage;
      };

      if (typed.type === 'content_block_delta' && typed.delta?.type === 'text_delta') {
        yield { type: 'delta', text: typed.delta.text ?? '' };
        continue;
      }

      if (typed.type === 'message_start' && typed.message?.usage) {
        usage = toUsage(typed.message.usage);
        continue;
      }

      if (typed.type === 'message_delta' && typed.usage) {
        // Only output grows during a stream; input was fixed at the start.
        usage = { ...usage, outputTokens: typed.usage.output_tokens ?? usage.outputTokens };
      }
    }

    yield { type: 'done', usage, costUsd: computeCost(usage, this.ratesFor(input.role)) };
  }

  async embed(_input: EmbedInput): Promise<EmbedResult> {
    // Not a gap to fill later. Anthropic has no embedding model, and the
    // 424,765 vectors in retrieval_units are Voyage's — mixing models in one
    // index produces silently wrong retrieval rather than an error.
    throw new AIProviderError('Anthropic has no embedding model; use the Voyage provider.', {
      retryable: false,
    });
  }

  /** Build the request, placing the cache marker at the prompt's boundary. */
  private request(input: GenerateInput, stream: boolean) {
    return {
      url: ENDPOINT,
      headers: {
        'x-api-key': this.options.apiKey,
        'anthropic-version': API_VERSION,
      },
      body: {
        model: this.modelFor(input.role),
        max_tokens: input.maxOutputTokens,
        ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
        system: systemBlocks(input.prompt),
        messages: [{ role: 'user', content: userContent(input.prompt) }],
        ...(stream ? { stream: true } : {}),
      },
      ...(this.options.maxAttempts === undefined ? {} : { maxAttempts: this.options.maxAttempts }),
      ...(input.signal ? { signal: input.signal } : {}),
      ...(this.options.fetchImpl ? { fetchImpl: this.options.fetchImpl } : {}),
    };
  }
}

/**
 * The cacheable prefix, as system blocks with a marker on the last one.
 *
 * Anthropic caches up to and including the block carrying `cache_control`, so
 * exactly one marker is needed — on the final cacheable block. Marking every
 * block would request several cache entries and pay several write premiums for
 * one prefix.
 */
export function systemBlocks(prompt: AssembledPrompt): readonly SystemBlock[] {
  const prefix = cacheablePrefix(prompt);
  if (prefix.length === 0) return [];

  return prefix.map((segment, index) => ({
    type: 'text' as const,
    text: segment.text,
    ...(index === prefix.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}),
  }));
}

/** Everything past the cache boundary, plus the question, as one user turn. */
export function userContent(prompt: AssembledPrompt): string {
  return render({
    segments: variableSuffix(prompt),
    cacheBoundary: 0,
    question: prompt.question,
  });
}

function toUsage(usage: AnthropicUsage | undefined): TokenUsage {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    cachedInputTokens: usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  };
}
