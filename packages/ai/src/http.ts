import { AIProviderError } from './provider.js';

/**
 * Shared transport for the vendor adapters.
 *
 * Both adapters need the same three things — retry on transient faults, no
 * retry on a malformed request, and a vendor payload that never reaches the
 * caller (§33). Duplicating that in each is how one of them ends up retrying a
 * 400 forever.
 */

/** Retry rate limits and server faults; nothing else. */
export function isRetryable(status: number): boolean {
  // A 401 or 400 means the key is wrong or the request is malformed. Repeating
  // it burns quota and delays the real error.
  return status === 429 || status >= 500;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface RequestOptions {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
  readonly maxAttempts?: number;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
  readonly onRetry?: (info: { attempt: number; status: number; delayMs: number }) => void;
}

/** Base wait for a rate limit, in milliseconds, when no Retry-After is sent. */
export const RATE_LIMIT_BACKOFF_MS = 20_000;

/**
 * POST JSON, with retries.
 *
 * Returns the parsed body. Throws `AIProviderError` carrying a status and a
 * retryable flag, never the vendor's response text — an upstream error message
 * can contain prompt content, and prompts carry user notes (§33).
 */
export async function postJson<T>(options: RequestOptions): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const doFetch = options.fetchImpl ?? fetch;
  let last: AIProviderError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    options.signal?.throwIfAborted();

    let response: Response;

    try {
      response = await doFetch(options.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...options.headers },
        body: JSON.stringify(options.body),
        ...(options.signal ? { signal: options.signal } : {}),
      });
    } catch (error) {
      // An abort is the caller's intent, not a fault to retry.
      if (error instanceof Error && error.name === 'AbortError') throw error;

      last = new AIProviderError('The AI provider could not be reached.', { retryable: true });
      if (attempt === maxAttempts) break;
      await sleep(2 ** attempt * 500);
      continue;
    }

    if (response.ok) return (await response.json()) as T;

    const retryable = isRetryable(response.status);
    last = new AIProviderError(providerMessage(response.status), {
      status: response.status,
      retryable,
    });

    if (!retryable || attempt === maxAttempts) break;

    // Honour Retry-After when sent: a generic backoff inside a per-minute
    // window guarantees another 429 and burns the attempt budget.
    const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
    const delayMs = Number.isFinite(retryAfter)
      ? retryAfter * 1_000
      : response.status === 429
        ? RATE_LIMIT_BACKOFF_MS * attempt
        : 2 ** attempt * 500;

    options.onRetry?.({ attempt, status: response.status, delayMs });
    await sleep(delayMs);
  }

  throw last ?? new AIProviderError('The AI provider failed.', { retryable: false });
}

/**
 * What the reader is told.
 *
 * Deliberately generic. §33 keeps infrastructure detail off the wire, and a
 * vendor's error body can echo the prompt — which carries the reader's own
 * notes.
 */
function providerMessage(status: number): string {
  if (status === 429) return 'The AI provider is rate limiting requests.';
  if (status === 401 || status === 403) return 'The AI provider rejected our credentials.';
  if (status >= 500) return 'The AI provider is unavailable.';

  return 'The AI provider rejected the request.';
}

/**
 * Parse an SSE byte stream into data payloads.
 *
 * Both vendors stream as `data: {json}` lines terminated by a blank line. A
 * chunk boundary can fall anywhere, including mid-line, so a buffer is
 * required — splitting each chunk independently drops events under load and
 * looks like a vendor bug.
 */
export async function* parseSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');

        if (!line.startsWith('data:')) continue;

        const payload = line.slice(5).trim();
        // OpenAI terminates with a literal sentinel rather than closing.
        if (payload === '[DONE]') return;

        try {
          yield JSON.parse(payload);
        } catch {
          // A malformed event is skipped rather than failing the stream: the
          // reader has already seen the text before it.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
