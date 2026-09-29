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
