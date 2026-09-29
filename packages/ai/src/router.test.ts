import { describe, expect, it } from 'vitest';
import { LONG_CONTEXT_CHARS, routeRole } from './router.js';

describe('routeRole', () => {
  it('sends contested theology to reasoning', () => {
    // §23 forbids flattening disputed doctrine into one asserted answer.
    // Presenting major interpretations fairly is what a weaker model does
    // badly: it picks one and sounds certain.
    expect(routeRole('theological_question')).toBe('reasoning');
    expect(routeRole('compare')).toBe('reasoning');
    expect(routeRole('trace_theme')).toBe('reasoning');
  });

  it('sends restatement to fast', () => {
    // The majority of traffic, and roughly a tenth of the price. Routing
    // these to reasoning is the most expensive available default.
    expect(routeRole('explain')).toBe('fast');
    expect(routeRole('summarise')).toBe('fast');
    expect(routeRole('original_language')).toBe('fast');
  });

  it('escalates to long-context when the prompt will not fit', () => {
    // Not a quality judgement: a model whose window cannot hold the prompt
    // cannot answer at all.
    expect(routeRole('explain', { contextChars: LONG_CONTEXT_CHARS })).toBe('long-context');
  });

  it('lets context size override even a reasoning intent', () => {
    expect(routeRole('theological_question', { contextChars: LONG_CONTEXT_CHARS + 1 })).toBe(
      'long-context',
    );
  });

  it('treats absent context size as small', () => {
    expect(routeRole('explain', {})).toBe('fast');
  });
});
