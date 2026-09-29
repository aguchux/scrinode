import type {
  AIProvider,
  AIStreamChunk,
  EmbedInput,
  EmbedResult,
  GenerateInput,
  GenerateResult,
} from './provider.js';
import type { AIModelRole } from './roles.js';
import { cacheablePrefix, render, variableSuffix } from './prompt.js';
import { computeCost, type ModelRates, type TokenUsage } from './usage.js';

/**
 * A provider that bills nothing and calls nobody.
 *
 * Exists so the orchestration above it — §16's assembly, this package's cache
 * ordering, §34's accounting — can be tested without a key and without a
 * network. Every one of those is logic worth asserting, and none of it needs a
 * real model to assert.
 *
 * It also records what it was asked to cache, which is the only way to test
 * that prompt ordering produces a cacheable prefix. A real provider reports a
 * cache hit only on the *second* request, so asserting against one would make
 * the test depend on vendor state.
 */

const FAKE_RATES: ModelRates = {
  inputPerMillion: 1,
  cachedInputPerMillion: 0.1,
  cacheWritePerMillion: 1.25,
  outputPerMillion: 5,
  verifiedOn: '2026-09-29',
};

/** Four characters per token, the usual English approximation. */
const CHARS_PER_TOKEN = 4;

const estimateTokens = (text: string): number => Math.ceil(text.length / CHARS_PER_TOKEN);

export interface FakeCall {
  readonly role: AIModelRole;
  /** Labels of the segments sent as a cacheable prefix, in order. */
  readonly cachedLabels: readonly string[];
  /** Labels sent fresh. */
  readonly freshLabels: readonly string[];
  /** Whether this request was served from a previously written cache entry. */
  readonly cacheHit: boolean;
}

export class FakeProvider implements AIProvider {
  readonly calls: FakeCall[] = [];

  /** Cacheable prefixes this provider has already been given. */
  private readonly written = new Set<string>();

  constructor(private readonly reply = 'A fake answer.') {}

  modelFor(role: AIModelRole): string {
    return `fake-${role}`;
  }

  ratesFor(): ModelRates {
    return FAKE_RATES;
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const usage = this.record(input);

    return {
      text: this.reply,
      usage,
      model: this.modelFor(input.role),
      costUsd: computeCost(usage, FAKE_RATES),
    };
  }

  async *stream(input: GenerateInput): AsyncIterable<AIStreamChunk> {
    const usage = this.record(input);

    for (const word of this.reply.split(' ')) {
      input.signal?.throwIfAborted();
      yield { type: 'delta', text: `${word} ` };
    }

    yield { type: 'done', usage, costUsd: computeCost(usage, FAKE_RATES) };
  }

  async embed(input: EmbedInput): Promise<EmbedResult> {
    // A deterministic non-zero vector. Not semantically meaningful, and
    // nothing that asserts retrieval quality should use this provider.
    const embeddings = input.texts.map((text) => [text.length, input.inputType.length, 1]);

    return {
      embeddings,
      totalTokens: input.texts.reduce((sum, t) => sum + estimateTokens(t), 0),
      model: 'fake-embedding',
      costUsd: 0,
    };
  }

  /** Account for one request, and remember what was cached. */
  private record(input: GenerateInput): TokenUsage {
    const prefix = cacheablePrefix(input.prompt);
    const suffix = variableSuffix(input.prompt);
    const prefixText = prefix.map((s) => s.text).join('\n\n');

    const hit = prefixText.length > 0 && this.written.has(prefixText);
    if (prefixText.length > 0) this.written.add(prefixText);

    this.calls.push({
      role: input.role,
      cachedLabels: prefix.map((s) => s.label),
      freshLabels: suffix.map((s) => s.label),
      cacheHit: hit,
    });

    const prefixTokens = estimateTokens(prefixText);
    const freshTokens = estimateTokens(
      render({ segments: suffix, cacheBoundary: 0, question: input.prompt.question }),
    );

    return {
      inputTokens: freshTokens,
      cachedInputTokens: hit ? prefixTokens : 0,
      cacheWriteTokens: hit ? 0 : prefixTokens,
      outputTokens: estimateTokens(this.reply),
    };
  }
}
