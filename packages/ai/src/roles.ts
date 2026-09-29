/**
 * Model roles — AGENTS.md §17.
 *
 * Product code asks for a capability, never a model name. Two reasons, and
 * the second is the expensive one:
 *
 *   - a vendor's best reasoning model and best cheap model are frequently
 *     different vendors, and §8 forbids that choice leaking into domain code
 *   - `reasoning` and `fast` differ by roughly an order of magnitude in price,
 *     so routing every question to `reasoning` is the single easiest way to
 *     make Zedek unaffordable
 */
export type AIModelRole = 'reasoning' | 'fast' | 'embedding' | 'long-context';

/** Every role, for exhaustiveness checks and registry validation. */
export const AI_MODEL_ROLES: readonly AIModelRole[] = [
  'reasoning',
  'fast',
  'embedding',
  'long-context',
];

export function isAIModelRole(value: string): value is AIModelRole {
  return (AI_MODEL_ROLES as readonly string[]).includes(value);
}
