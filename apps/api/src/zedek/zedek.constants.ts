/**
 * Injection token for the AI provider.
 *
 * A token rather than a class, because which provider serves a deployment is a
 * configuration decision (§17). Injecting `AnthropicProvider` directly would
 * put the vendor choice in every consumer's constructor — the coupling §8's
 * lint rule exists to prevent.
 */
export const AI_PROVIDER = Symbol('AI_PROVIDER');
