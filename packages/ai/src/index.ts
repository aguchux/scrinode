/**
 * @scrinode/ai — the provider abstraction (AGENTS.md §17).
 *
 * Everything vendor-specific lives behind this package. §8's lint rule makes
 * that structural rather than aspirational: no other package may import an AI
 * vendor SDK.
 */
export { AI_MODEL_ROLES, isAIModelRole, type AIModelRole } from './roles.js';

export {
  MIN_CACHEABLE_CHARS,
  Stability,
  assemble,
  cacheablePrefix,
  render,
  variableSuffix,
  type AssembledPrompt,
  type PromptSegment,
} from './prompt.js';

export {
  EMPTY_USAGE,
  addUsage,
  cacheHitRate,
  computeCost,
  type ModelRates,
  type TokenUsage,
} from './usage.js';

export {
  AIProviderError,
  type AIProvider,
  type AIStreamChunk,
  type EmbedInput,
  type EmbedResult,
  type GenerateInput,
  type GenerateResult,
} from './provider.js';

export {
  LONG_CONTEXT_CHARS,
  routeRole,
  type GenerativeIntent,
  type RouteOptions,
} from './router.js';

export { FakeProvider, type FakeCall } from './fake-provider.js';

/**
 * Vendor adapters.
 *
 * The only place in the repo that speaks to an AI vendor. §8's lint rule keeps
 * it that way, and it was probed in both directions: an `openai` import fails
 * in @scrinode/scripture and passes here.
 *
 * The two differ in how caching is requested, and the difference is why the
 * abstraction exists rather than a single client. Anthropic takes an explicit
 * `cache_control` marker; OpenAI matches a prefix implicitly with nothing in
 * the request to reveal whether it worked. Both are served by the same ordered
 * prompt, which is the point.
 */
export { AnthropicProvider, type AnthropicOptions } from './anthropic.js';
export { OpenAIProvider, type OpenAIOptions } from './openai.js';
export { RATE_LIMIT_BACKOFF_MS, isRetryable } from './http.js';
