import { Stability, cacheablePrefix, render, variableSuffix } from '@scrinode/ai';
import { describe, expect, it } from 'vitest';
import { HISTORY_TURNS, SYSTEM_PROMPT, buildPrompt } from './prompt.builder';
import type { RetrievedUnit } from '../database/retrieval.repository';

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

const study = {
  title: 'Romans 8',
  description: 'Sermon series on assurance',
  scriptureFocus: ['ROM.8.1', 'ROM.8.39'],
  findings: ['Paul frames suffering as present but not final.'],
};

describe('buildPrompt', () => {
  describe('cache tiers', () => {
    it('orders system, study, history, then retrieved units', () => {
      // The ordering is what makes caching work at all (§17). A wrong tier
      // costs roughly 4x with no error raised.
      const prompt = buildPrompt({
        question: 'What does this mean?',
        units: [unit()],
        study,
        history: [{ role: 'user', content: 'Earlier question' }],
      });

      expect(prompt.segments.map((s) => s.label)).toEqual([
        'system',
        'study-memory',
        'history',
        'retrieved-units',
      ]);
    });

    it('assigns the turn tier to retrieved units', () => {
      const prompt = buildPrompt({ question: 'q', units: [unit()] });
      const units = prompt.segments.find((s) => s.label === 'retrieved-units');

      expect(units?.stability).toBe(Stability.Turn);
    });

    it('keeps retrieved units out of the cacheable prefix', () => {
      // The failure this whole design prevents: units in the prefix mean no two
      // turns share one, so nothing ever caches.
      const prompt = buildPrompt({ question: 'q', units: [unit()], study });

      expect(cacheablePrefix(prompt).map((s) => s.label)).not.toContain('retrieved-units');
      expect(variableSuffix(prompt).map((s) => s.label)).toContain('retrieved-units');
    });

    it('does not request a cache for a prefix below the provider floor', () => {
      // The system prompt alone is ~3.4k characters, under MIN_CACHEABLE_CHARS.
      // Declining is correct: a cache write below a provider's floor is either
      // ignored or charged for nothing. A first turn in a fresh Study genuinely
      // has nothing worth caching.
      const prompt = buildPrompt({ question: 'q', units: [unit()] });

      expect(prompt.cacheBoundary).toBe(0);
    });

    it('caches once a Study carries enough memory to clear the floor', () => {
      // The realistic steady state, and where the saving actually lands: a
      // Study accumulates focus and findings, and system + memory together
      // clear the floor. This is the case worth protecting.
      const substantial = {
        ...study,
        findings: Array.from({ length: 40 }, (_, i) => `Finding ${i}: ${'detail '.repeat(20)}`),
      };

      const prompt = buildPrompt({ question: 'q', units: [unit()], study: substantial });

      expect(cacheablePrefix(prompt).map((s) => s.label)).toEqual(['system', 'study-memory']);
    });
  });

  describe('the system prompt', () => {
    it('interpolates nothing, so every request shares one prefix', () => {
      // A date, a user name or a Study title here would make the prompt differ
      // per request and destroy the cache prefix every other saving rests on.
      expect(SYSTEM_PROMPT).not.toMatch(/\$\{|\{\{/);
    });

    it('is byte-identical across two different requests', () => {
      const a = buildPrompt({ question: 'first', units: [unit()], study });
      const b = buildPrompt({ question: 'second', units: [unit({ id: 'u2' })] });

      const systemOf = (p: typeof a) => p.segments.find((s) => s.label === 'system')?.text;
      expect(systemOf(a)).toBe(systemOf(b));
    });

    it('instructs the model not to answer from memory', () => {
      // §2.2 and §3.3. This text is the only thing between a grounded answer
      // and a confident invention.
      expect(SYSTEM_PROMPT).toMatch(/do not answer from memory/i);
      expect(SYSTEM_PROMPT).toMatch(/say so plainly/i);
    });

    it('requires §23 structure and forbids asserting one reading', () => {
      expect(SYSTEM_PROMPT).toMatch(/Textual observation/);
      expect(SYSTEM_PROMPT).toMatch(/Major interpretations/);
      expect(SYSTEM_PROMPT).toMatch(/Do not choose one and present it as settled/i);
    });

    it('forbids revealing its own reasoning', () => {
      // §18: never expose private chain-of-thought.
      expect(SYSTEM_PROMPT).toMatch(/not reveal or narrate your own reasoning/i);
    });
  });

  describe('retrieved units', () => {
    it('labels each unit with the id a citation must reference', () => {
      // Without the id the model has nothing to cite by, so §16's validation
      // would reject every Scripture citation it produced.
      const prompt = buildPrompt({ question: 'q', units: [unit({ id: 'abc-123' })] });

      expect(render(prompt)).toContain('[unit abc-123]');
    });

    it('renders a passage range rather than only its start', () => {
      const prompt = buildPrompt({
        question: 'q',
        units: [unit({ unitType: 'passage', referenceStart: 'ROM.8.28', referenceEnd: 'ROM.8.33' })],
      });

      expect(render(prompt)).toContain('ROM.8.28-ROM.8.33');
    });

    it('tells the model to say so when nothing was retrieved', () => {
      // §3.3: when retrieval returns nothing relevant, Zedek says so. A silent
      // empty section invites the model to fill it from memory.
      const prompt = buildPrompt({ question: 'q', units: [] });

      expect(render(prompt)).toMatch(/nothing to answer from/i);
    });

    it('includes the verbatim text, so a citation can be checked against it', () => {
      const prompt = buildPrompt({ question: 'q', units: [unit()] });

      expect(render(prompt)).toContain('God works all things together');
    });
  });

  describe('history', () => {
    it('carries a bounded window rather than the whole conversation', () => {
      // §3.3 forbids replaying a transcript: unbounded history makes turn 30
      // cost five times turn 5 for no better answer.
      const history = Array.from({ length: 30 }, (_, i) => ({
        role: 'user' as const,
        content: `turn ${i}`,
      }));

      const text = render(buildPrompt({ question: 'q', units: [unit()], history }));

      expect(text).not.toContain('turn 0');
      expect(text).toContain(`turn ${29}`);
    });

    it('keeps the most recent turns, oldest first', () => {
      // Oldest-first keeps the rendered text append-only, so the previous
      // turn's cache prefix still matches.
      const history = Array.from({ length: HISTORY_TURNS }, (_, i) => ({
        role: 'user' as const,
        content: `turn ${i}`,
      }));

      const text = render(buildPrompt({ question: 'q', units: [unit()], history }));

      expect(text.indexOf('turn 0')).toBeLessThan(text.indexOf(`turn ${HISTORY_TURNS - 1}`));
    });

    it('omits the segment entirely when there is no history', () => {
      const prompt = buildPrompt({ question: 'q', units: [unit()] });

      expect(prompt.segments.map((s) => s.label)).not.toContain('history');
    });
  });

  describe('study memory', () => {
    it('includes findings as established statements', () => {
      const text = render(buildPrompt({ question: 'q', units: [unit()], study }));

      expect(text).toContain('Paul frames suffering as present but not final.');
    });

    it('includes the Scripture in focus', () => {
      const text = render(buildPrompt({ question: 'q', units: [unit()], study }));

      expect(text).toContain('ROM.8.1');
    });

    it('omits the segment when a Study has nothing yet', () => {
      // An empty Study segment would occupy a cache tier and add nothing.
      const prompt = buildPrompt({
        question: 'q',
        units: [unit()],
        study: { title: '', scriptureFocus: [], findings: [] },
      });

      expect(prompt.segments.map((s) => s.label)).not.toContain('study-memory');
    });
  });

  it('places the question last', () => {
    const prompt = buildPrompt({ question: 'the actual question', units: [unit()] });

    expect(render(prompt).endsWith('the actual question')).toBe(true);
  });
});
