import { cacheablePrefix, render, variableSuffix } from './prompt.js';
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
 * OpenAI adapter.
 *
 * A plain fetch wrapper, for the reasons in the Anthropic adapter.
 *
 * **Caching is implicit here, and that difference matters.** OpenAI matches a
 * prompt prefix automatically with no marker to place — but it only considers
 * prefixes past a minimum length, and it matches *exact leading tokens* of the
 * whole request. So the same ordering discipline is required and there is
 * nothing in the request to reveal whether it worked. The only evidence is
 * `usage.prompt_tokens_details.cached_tokens` on the response, which is why
 * §34's accounting reads it rather than assuming.
 *
 * The practical consequence: this adapter must not reorder or reformat what
 * `assemble()` produced. A convenience like sorting messages or trimming
 * whitespace would silently break the match.
 *
 * Contract, verified against OpenAI's reference 2026-09-29:
 *   POST https://api.openai.com/v1/chat/completions
 *   Authorization: Bearer <key>
 *   { model, max_completion_tokens, messages: [...], stream? }
 *   -> { choices: [{ message: { content } }], usage: {
 *          prompt_tokens, completion_tokens,
 *          prompt_tokens_details: { cached_tokens } } }
 */

const CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const EMBEDDING_ENDPOINT = 'https://api.openai.com/v1/embeddings';

const MODELS: Record<AIModelRole, string> = {
  reasoning: 'gpt-5',
  fast: 'gpt-5-mini',
  'long-context': 'gpt-5',
  // Available, but not what Scrinode uses. See embed() below.
  embedding: 'text-embedding-3-large',
};

const REASONING_RATES: ModelRates = {
  inputPerMillion: 10,
  // OpenAI discounts a cached prefix rather than charging to write one, so
  // cacheWrite equals input: there is no write premium to account for.
  cachedInputPerMillion: 1.25,
  cacheWritePerMillion: 10,
  outputPerMillion: 30,
  verifiedOn: '2026-09-29',
};

const RATES: Record<AIModelRole, ModelRates> = {
  reasoning: REASONING_RATES,
  'long-context': REASONING_RATES,
  fast: {
    inputPerMillion: 0.6,
    cachedInputPerMillion: 0.075,
    cacheWritePerMillion: 0.6,
    outputPerMillion: 2.4,
    verifiedOn: '2026-09-29',
  },
  embedding: {
    inputPerMillion: 0.13,
    cachedInputPerMillion: 0.13,
    cacheWritePerMillion: 0.13,
    outputPerMillion: 0,
    verifiedOn: '2026-09-29',
  },
};

interface OpenAIUsage {
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
  readonly prompt_tokens_details?: { readonly cached_tokens?: number };
}

export interface OpenAIOptions {
  readonly apiKey: string;
  readonly maxAttempts?: number;
  readonly fetchImpl?: typeof fetch;
}

export class OpenAIProvider implements AIProvider {
  constructor(private readonly options: OpenAIOptions) {}

  modelFor(role: AIModelRole): string {
    return MODELS[role];
  }

  ratesFor(role: AIModelRole): ModelRates {
    return RATES[role];
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const payload = await postJson<{
      choices?: { message?: { content?: string } }[];
      usage?: OpenAIUsage;
    }>(this.request(input, false));

    const usage = toUsage(payload.usage);

    return {
      text: payload.choices?.[0]?.message?.content ?? '',
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

    let usage: TokenUsage = {
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
    };

    for await (const event of parseSse(response.body)) {
      const typed = event as {
        choices?: { delta?: { content?: string } }[];
        usage?: OpenAIUsage;
      };

      const delta = typed.choices?.[0]?.delta?.content;
      if (delta) yield { type: 'delta', text: delta };

      // Only sent because the request asks for it; without
      // stream_options.include_usage a streamed call reports no cost at all,
      // which would leave §34 blind to exactly the requests that stream.
      if (typed.usage) usage = toUsage(typed.usage);
    }

    yield { type: 'done', usage, costUsd: computeCost(usage, this.ratesFor(input.role)) };
  }

  /**
   * Embed texts.
   *
   * Implemented because the interface has it and OpenAI does offer embeddings,
   * but **Scrinode's index is Voyage's**. All 424,765 stored vectors are
   * voyage-4 at 1024 dimensions, and a query embedded by a different model is
   * not comparable to them — the search returns plausible-looking nonsense
   * rather than failing. Using this against `retrieval_units` would mean
   * re-embedding the entire corpus first.
   */
  async embed(input: EmbedInput): Promise<EmbedResult> {
    const model = this.modelFor('embedding');

    const payload = await postJson<{
      data?: { embedding?: number[]; index?: number }[];
      usage?: { prompt_tokens?: number };
    }>({
      url: EMBEDDING_ENDPOINT,
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
      body: { model, input: input.texts },
      ...(this.options.maxAttempts === undefined ? {} : { maxAttempts: this.options.maxAttempts }),
      ...(input.signal ? { signal: input.signal } : {}),
      ...(this.options.fetchImpl ? { fetchImpl: this.options.fetchImpl } : {}),
    });

    const rows = payload.data ?? [];
    if (rows.length !== input.texts.length) {
      throw new AIProviderError(
        `Expected ${input.texts.length} embeddings, received ${rows.length}.`,
        { retryable: false },
      );
    }

    // Response order is not guaranteed by the shape, so sort by index rather
    // than trusting arrival order — the same guard the Voyage client applies.
    const sorted = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const totalTokens = payload.usage?.prompt_tokens ?? 0;

    return {
      embeddings: sorted.map((row) => row.embedding ?? []),
      totalTokens,
      model,
      costUsd: computeCost(
        { inputTokens: totalTokens, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0 },
        this.ratesFor('embedding'),
      ),
    };
  }

  /**
   * Build the request.
   *
   * The cacheable prefix becomes one leading system message and the variable
   * suffix a user message. Order is preserved exactly as `assemble()` produced
   * it: OpenAI matches leading tokens, so any reordering here breaks the match
   * with no error and roughly 4x the input cost.
   */
  private request(input: GenerateInput, stream: boolean) {
    const prefix = cacheablePrefix(input.prompt);
    const suffix = variableSuffix(input.prompt);

    const messages: { role: 'system' | 'user'; content: string }[] = [];

    if (prefix.length > 0) {
      messages.push({ role: 'system', content: prefix.map((s) => s.text).join('\n\n') });
    }

    messages.push({
      role: 'user',
      content: render({ segments: suffix, cacheBoundary: 0, question: input.prompt.question }),
    });

    return {
      url: CHAT_ENDPOINT,
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
      body: {
        model: this.modelFor(input.role),
        max_completion_tokens: input.maxOutputTokens,
        ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
        messages,
        ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
      },
      ...(this.options.maxAttempts === undefined ? {} : { maxAttempts: this.options.maxAttempts }),
      ...(input.signal ? { signal: input.signal } : {}),
      ...(this.options.fetchImpl ? { fetchImpl: this.options.fetchImpl } : {}),
    };
  }
}

/**
 * Split OpenAI's reported totals into the classes §34 accounts for.
 *
 * `prompt_tokens` is the **total**, cached included, so the uncached figure is
 * a subtraction. Reading `prompt_tokens` as uncached input would double-count
 * the cached portion and report a cached turn as more expensive than an
 * uncached one — the exact opposite of the truth.
 */
function toUsage(usage: OpenAIUsage | undefined): TokenUsage {
  const prompt = usage?.prompt_tokens ?? 0;
  const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;

  return {
    inputTokens: Math.max(0, prompt - cached),
    cachedInputTokens: cached,
    // OpenAI charges no premium to populate a cache entry, so there is nothing
    // to attribute here. Anthropic does, and reports it separately.
    cacheWriteTokens: 0,
    outputTokens: usage?.completion_tokens ?? 0,
  };
}
