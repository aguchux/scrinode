import { routeRole } from '@scrinode/ai';
import { describe, expect, it } from 'vitest';
import { routeQuestion } from './intent';

describe('routeQuestion', () => {
  describe('questions a model never sees', () => {
    it('routes a bare reference away from generation', () => {
      // §14.1: parsed, never searched, never generated. A free answer is the
      // cheapest kind.
      for (const reference of ['John 3:16', 'ROM.8.28', '1 Cor 13', 'Romans 8:28-30', 'Psalm 23']) {
        expect(routeQuestion(reference).kind, reference).toBe('reference');
      }
    });

    it('routes a short phrase to search', () => {
      for (const phrase of ['faith without works', 'agape', 'resurrection']) {
        expect(routeQuestion(phrase).kind, phrase).toBe('lookup');
      }
    });

    it('treats a one-word doctrine as a search, not an essay request', () => {
      // A reader typing "predestination" wants the passages. Sending it to
      // `reasoning` would pay ten times over for something unasked.
      expect(routeQuestion('predestination').kind).toBe('lookup');
    });
  });

  describe('does not mistake a question for a reference', () => {
    it('sends a question about a verse to generation', () => {
      // The costly false positive: returning a verse instead of an answer.
      const routed = routeQuestion('What does John 3:16 mean?');

      expect(routed.kind).toBe('generative');
    });

    it('sends a question with no verse to generation', () => {
      expect(routeQuestion('Why did Jesus wash the disciples’ feet?').kind).toBe('generative');
    });
  });

  describe('model role, via routeRole', () => {
    const roleFor = (question: string) => {
      const routed = routeQuestion(question);
      return routed.intent ? routeRole(routed.intent) : undefined;
    };

    it('sends contested theology to reasoning', () => {
      // §23 forbids flattening disputed doctrine into one asserted answer, and
      // a weaker model picks one reading and sounds certain.
      expect(roleFor('How do Reformed and Wesleyan readings of Romans 9 differ?')).toBe(
        'reasoning',
      );
      expect(roleFor('Why does Paul speak of election here?')).toBe('reasoning');
      expect(roleFor('Compare the two accounts of the resurrection')).toBe('reasoning');
    });

    it('sends thematic tracing to reasoning', () => {
      expect(roleFor('Trace the theme of covenant through Genesis')).toBe('reasoning');
    });

    it('sends restatement to fast', () => {
      // The majority of traffic, at roughly a tenth of the price.
      expect(roleFor('What does this passage say about prayer?')).toBe('fast');
      expect(roleFor('Summarise this chapter for me please')).toBe('fast');
    });

    it('sends original-language questions to fast', () => {
      // Restatement of lexical data, not a reasoning problem.
      expect(roleFor('What is the Greek word used here for love?')).toBe('fast');
    });

    it('defaults to fast rather than reasoning', () => {
      // The default is the whole cost argument. Defaulting to `reasoning` would
      // feel safer and cost ten times as much on most requests.
      expect(roleFor('Tell me about this passage in its setting')).toBe('fast');
    });
  });

  it('handles an empty question without throwing', () => {
    expect(routeQuestion('   ').kind).toBe('generative');
  });
});
