import { FakeProvider, type AIProvider } from '@scrinode/ai';
import type { ZedekStreamEvent } from '@scrinode/types';
import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { RetrievalRepository, RetrievedUnit } from '../database/retrieval.repository';
import type { ZedekRepository } from '../database/zedek.repository';
import { ZedekService, extractCitations } from './zedek.service';

const unit = (partial: Partial<RetrievedUnit> = {}): RetrievedUnit => ({
  id: 'u1',
  unitType: 'verse',
  translation: 'BSB',
  referenceStart: 'ROM.8.28',
  referenceEnd: null,
  text: 'And we know that God works all things together for the good of those who love Him.',
  score: 0.68,
  ...partial,
});

/** A provider whose reply is fixed, so citations can be steered. */
class ScriptedProvider extends FakeProvider {
  constructor(reply: string) {
    super(reply);
  }
}

interface Harness {
  service: ZedekService;
  repository: {
    findConversation: ReturnType<typeof vi.fn>;
    findStudyById: ReturnType<typeof vi.fn>;
    listFindings: ReturnType<typeof vi.fn>;
    listMessages: ReturnType<typeof vi.fn>;
    appendUserMessage: ReturnType<typeof vi.fn>;
    appendAssistantMessage: ReturnType<typeof vi.fn>;
  };
  retrieval: { search: ReturnType<typeof vi.fn> };
  provider: AIProvider;
}

function harness(options: { units?: RetrievedUnit[]; reply?: string } = {}): Harness {
  const repository = {
    findConversation: vi.fn().mockResolvedValue({
      id: 'c1',
      study_id: 's1',
      user_id: 'reader-1',
      title: 'A conversation',
    }),
    findStudyById: vi.fn().mockResolvedValue({
      id: 's1',
      title: 'Romans 8',
      description: null,
      scripture_focus: ['ROM.8.1'],
    }),
    listFindings: vi.fn().mockResolvedValue([]),
    listMessages: vi.fn().mockResolvedValue([]),
    appendUserMessage: vi.fn().mockResolvedValue({ id: 'm1' }),
    appendAssistantMessage: vi.fn().mockResolvedValue({ id: 'm2' }),
  };

  const retrieval = {
    search: vi.fn().mockResolvedValue(options.units ?? [unit()]),
  };

  const provider = new ScriptedProvider(options.reply ?? 'An answer about [unit u1].');

  const service = new ZedekService(
    repository as unknown as ZedekRepository,
    retrieval as unknown as RetrievalRepository,
    provider,
  );

  return { service, repository, retrieval, provider };
}

const drain = async (
  events: AsyncGenerator<ZedekStreamEvent>,
): Promise<ZedekStreamEvent[]> => {
  const collected: ZedekStreamEvent[] = [];
  for await (const event of events) collected.push(event);

  return collected;
};

const ask = (h: Harness, question = 'What does this passage mean for us?') =>
  h.service.ask({
    conversationId: 'c1',
    userId: 'reader-1',
    question,
    translations: ['BSB'],
  });

describe('ZedekService.ask', () => {
  describe('ownership', () => {
    it('refuses a conversation the reader does not own', async () => {
      // §33. Checked before any work is done and before a token is spent.
      const h = harness();
      h.repository.findConversation.mockResolvedValue(null);

      await expect(drain(ask(h))).rejects.toThrow(NotFoundException);
    });

    it('does no retrieval when ownership fails', async () => {
      const h = harness();
      h.repository.findConversation.mockResolvedValue(null);

      await expect(drain(ask(h))).rejects.toThrow();
      expect(h.retrieval.search).not.toHaveBeenCalled();
    });
  });

  describe('questions that must not reach a model', () => {
    it('declines a bare reference without generating', async () => {
      // §15 puts AI last, and a reference is free to answer. Paying a vendor
      // for it is the waste this branch prevents.
      const h = harness();
      const events = await drain(ask(h, 'John 3:16'));

      expect(events.map((e) => e.type)).toEqual(['error']);
      expect(h.retrieval.search).not.toHaveBeenCalled();
    });

    it('declines a keyword search without generating', async () => {
      const h = harness();
      const events = await drain(ask(h, 'faith without works'));

      expect(events[0]?.type).toBe('error');
      expect(h.retrieval.search).not.toHaveBeenCalled();
    });
  });

  describe('when retrieval finds nothing', () => {
    it('says so rather than generating from the model’s own weights', async () => {
      // §3.3 and §2.2. This is the branch that keeps Zedek from being a
      // chatbot with Bible data attached: no provider call happens at all.
      const h = harness({ units: [] });
      const spy = vi.spyOn(h.provider, 'stream');

      const events = await drain(ask(h));
      const content = events.filter((e) => e.type === 'content');

      expect(spy).not.toHaveBeenCalled();
      expect(content[0]).toMatchObject({ type: 'content' });
      expect(JSON.stringify(content)).toMatch(/could not find passages/i);
    });

    it('still records the turn, at zero cost', async () => {
      const h = harness({ units: [] });

      await drain(ask(h));

      expect(h.repository.appendAssistantMessage).toHaveBeenCalledWith(
        expect.objectContaining({ model: expect.objectContaining({ costUsd: 0 }) }),
      );
    });

    it('drops units below the relevance floor', async () => {
      // A weak match is worse than none: it invites the model to answer from a
      // passage that does not address the question.
      const h = harness({ units: [unit({ score: 0.1 })] });

      const events = await drain(ask(h));

      expect(JSON.stringify(events)).toMatch(/could not find passages/i);
    });

    it('keeps a 0.47 match, which measurement showed is a good answer', async () => {
      // Observed scores for correct answers ran 0.47-0.68. A floor at 0.5 would
      // have discarded a correct Leviticus result, so the floor sits below it.
      const h = harness({ units: [unit({ score: 0.47 })] });

      const events = await drain(ask(h));

      expect(JSON.stringify(events)).not.toMatch(/could not find passages/i);
    });
  });

  describe('a normal turn', () => {
    it('streams status, content, citation and completion', async () => {
      const h = harness();
      const types = (await drain(ask(h))).map((e) => e.type);

      expect(types).toContain('status');
      expect(types).toContain('content');
      expect(types).toContain('citation');
      expect(types.at(-1)).toBe('complete');
    });

    it('emits only §18’s permitted statuses', async () => {
      // A closed set (§18). A status may name the stage, never what the model
      // is thinking.
      const permitted = new Set([
        'Loading Scripture...',
        'Searching cross-references...',
        'Examining original language...',
        'Searching sources...',
        'Generating response...',
      ]);

      const events = await drain(ask(harness()));

      for (const event of events) {
        if (event.type === 'status') expect(permitted.has(event.message)).toBe(true);
      }
    });

    it('records token usage and cost with the message', async () => {
      // §34. Per message, because that is the only granularity at which an
      // expensive conversation is distinguishable from a long one.
      const h = harness();

      await drain(ask(h));

      expect(h.repository.appendAssistantMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.objectContaining({
            inputTokens: expect.any(Number),
            outputTokens: expect.any(Number),
            costUsd: expect.any(Number),
          }),
        }),
      );
    });

    it('persists the reader’s question before answering', async () => {
      const h = harness();

      await drain(ask(h));

      expect(h.repository.appendUserMessage).toHaveBeenCalledWith(
        'c1',
        'What does this passage mean for us?',
      );
    });
  });

  describe('citation validation', () => {
    it('emits a citation the model grounded in a retrieved unit', async () => {
      const h = harness({ reply: 'See [unit u1] for this.' });
      const events = await drain(ask(h));

      const citation = events.find((e) => e.type === 'citation');
      expect(citation).toMatchObject({
        type: 'citation',
        citation: { retrievalUnitId: 'u1', translation: 'BSB' },
      });
    });

    it('drops a citation naming a unit that was never retrieved', async () => {
      // §2.2's guard, end to end. A model inventing a unit id gets nothing
      // through.
      const h = harness({ reply: 'See [unit invented-99] for this.' });
      const events = await drain(ask(h));

      expect(events.filter((e) => e.type === 'citation')).toHaveLength(0);
    });

    it('persists only the valid citations', async () => {
      const h = harness({ reply: 'Both [unit u1] and [unit invented-99].' });

      await drain(ask(h));

      const call = h.repository.appendAssistantMessage.mock.calls[0]?.[0];
      expect(call.citations).toHaveLength(1);
      expect(call.citations[0].retrieval_unit_id).toBe('u1');
    });

    it('still streams the prose when every citation is rejected', async () => {
      // The answer is not discarded — the reader sees it without unverifiable
      // citations attached, which is the honest outcome.
      const h = harness({ reply: 'Something about [unit bogus].' });
      const events = await drain(ask(h));

      expect(events.some((e) => e.type === 'content')).toBe(true);
    });
  });
});

describe('extractCitations', () => {
  it('takes the reference and text from the retrieved row, not the response', () => {
    // A citation assembled from the model's own words would be the
    // unverifiable claim §2.2 forbids, however plausible it read.
    const citations = extractCitations('As [unit u1] says, God is sovereign over all.', [unit()]);

    expect(citations[0]).toMatchObject({
      canonicalReference: 'ROM.8.28',
      translation: 'BSB',
      text: expect.stringContaining('God works all things together'),
    });
  });

  it('does not repeat a unit cited twice', () => {
    const citations = extractCitations('[unit u1] and again [unit u1].', [unit()]);

    expect(citations).toHaveLength(1);
  });

  it('keeps an unresolvable id so validation can reject and count it', () => {
    // Dropping it here would hide a model inventing ids — the signal §34 wants.
    const citations = extractCitations('[unit nope]', [unit()]);

    expect(citations).toHaveLength(1);
    expect(citations[0]?.retrievalUnitId).toBe('nope');
  });

  it('finds nothing in a response with no citations', () => {
    expect(extractCitations('A bare answer.', [unit()])).toEqual([]);
  });
});
