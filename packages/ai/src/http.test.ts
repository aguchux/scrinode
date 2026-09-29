import { describe, expect, it, vi } from 'vitest';
import { isRetryable, parseSse, postJson } from './http.js';

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const request = (fetchImpl: typeof fetch, maxAttempts = 2) => ({
  url: 'https://example.invalid/v1',
  headers: { Authorization: 'Bearer k' },
  body: { hello: 'world' },
  maxAttempts,
  fetchImpl,
});

describe('isRetryable', () => {
  it('retries rate limits and server faults', () => {
    expect(isRetryable(429)).toBe(true);
    expect(isRetryable(500)).toBe(true);
    expect(isRetryable(503)).toBe(true);
  });

  it('does not retry a bad request or bad credentials', () => {
    // Repeating these burns quota and delays the real error.
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(401)).toBe(false);
    expect(isRetryable(403)).toBe(false);
    expect(isRetryable(404)).toBe(false);
  });
});

describe('postJson', () => {
  it('returns the parsed body on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ answer: 42 }));

    await expect(postJson(request(fetchImpl as unknown as typeof fetch))).resolves.toEqual({
      answer: 42,
    });
  });

  it('does not retry a 400', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('bad', { status: 400 }));

    await expect(postJson(request(fetchImpl as unknown as typeof fetch))).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('honours Retry-After on a rate limit', async () => {
    // A generic backoff inside a per-minute window guarantees another 429 and
    // burns the attempt budget for nothing.
    const onRetry = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('slow down', { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(ok({ answer: 1 }));

    await postJson({ ...request(fetchImpl as unknown as typeof fetch), onRetry });

    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ status: 429, delayMs: 0 }));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('reports a generic message rather than the vendor body', async () => {
    // A vendor error body can echo the prompt, and prompts carry the reader's
    // own notes (§33).
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('PROMPT: private note', { status: 401 }));

    await expect(postJson(request(fetchImpl as unknown as typeof fetch))).rejects.toThrow(
      /rejected our credentials/,
    );
  });

  it('propagates an abort rather than retrying it', async () => {
    // An abort is the caller's intent (§18 requires cancellation), not a fault.
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn().mockResolvedValue(ok({}));

    await expect(
      postJson({ ...request(fetchImpl as unknown as typeof fetch), signal: controller.signal }),
    ).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('parseSse', () => {
  const streamOf = (text: string): ReadableStream<Uint8Array> =>
    new Response(text).body as ReadableStream<Uint8Array>;

  const collect = async (text: string) => {
    const events = [];
    for await (const event of parseSse(streamOf(text))) events.push(event);

    return events;
  };

  it('parses data lines into payloads', async () => {
    const events = await collect('data: {"a":1}\n\ndata: {"a":2}\n\n');

    expect(events).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('stops at the [DONE] sentinel', async () => {
    const events = await collect('data: {"a":1}\n\ndata: [DONE]\n\ndata: {"a":2}\n\n');

    expect(events).toEqual([{ a: 1 }]);
  });

  it('reassembles an event split across chunk boundaries', async () => {
    // A chunk boundary can fall mid-line. Splitting each chunk independently
    // drops events under load and looks like a vendor bug.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"mes'));
        controller.enqueue(encoder.encode('sage":"split"}\n\n'));
        controller.close();
      },
    });

    const events = [];
    for await (const event of parseSse(stream)) events.push(event);

    expect(events).toEqual([{ message: 'split' }]);
  });

  it('skips a malformed event rather than failing the stream', async () => {
    // The reader has already seen the text before it; aborting would lose a
    // partial answer over one bad frame.
    const events = await collect('data: {"a":1}\n\ndata: not json\n\ndata: {"a":3}\n\n');

    expect(events).toEqual([{ a: 1 }, { a: 3 }]);
  });

  it('ignores comment and event-name lines', async () => {
    const events = await collect(': keep-alive\n\nevent: ping\n\ndata: {"a":1}\n\n');

    expect(events).toEqual([{ a: 1 }]);
  });
});
