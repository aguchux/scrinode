import type { Citation } from '@scrinode/types';
import { describe, expect, it } from 'vitest';
import { validateCitations } from './citations';
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

const scripture = (partial: Partial<Citation> = {}): Citation => ({
  kind: 'scripture',
  label: 'Romans 8:28',
  retrievalUnitId: 'u1',
  canonicalReference: 'ROM.8.28',
  translation: 'BSB',
  ...partial,
});

describe('validateCitations', () => {
  it('accepts a citation that traces to a retrieved unit', () => {
    const { valid, rejected } = validateCitations([scripture()], [unit()]);

    expect(valid).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  describe('rejects what §2.2 forbids', () => {
    it('drops a citation naming a unit that was not retrieved', () => {
      // The core guard. A model recalling a real verse unaided still produces
      // an ungrounded citation, because the grounding is what makes it
      // checkable.
      const { valid, rejected } = validateCitations(
        [scripture({ retrievalUnitId: 'never-retrieved' })],
        [unit()],
      );

      expect(valid).toHaveLength(0);
      expect(rejected[0]?.reason).toMatch(/not among those retrieved/);
    });

    it('drops a Scripture citation with no unit id at all', () => {
      const { valid, rejected } = validateCitations(
        [{ kind: 'scripture', label: 'Romans 8:28' }],
        [unit()],
      );

      expect(valid).toHaveLength(0);
      expect(rejected[0]?.reason).toMatch(/cannot be traced/);
    });

    it('drops a citation whose quoted text is not verbatim in the unit', () => {
      // §22.3 forbids paraphrasing Scripture. A reworded quote means the model
      // rewrote the text, which is a correctness failure rather than a style
      // one — and the reader would find different words in the passage.
      const { rejected } = validateCitations(
        [scripture({ text: 'God makes everything turn out fine for believers' })],
        [unit()],
      );

      expect(rejected[0]?.reason).toMatch(/verbatim/);
    });

    it('drops a citation relabelled to a reference outside the unit', () => {
      // The reference is the reader's route back to the text. A wrong one sends
      // them where the quoted words are not.
      const { rejected } = validateCitations(
        [scripture({ canonicalReference: 'ROM.9.1' })],
        [unit()],
      );

      expect(rejected[0]?.reason).toMatch(/outside the cited unit/);
    });

    it('drops a citation naming a different book', () => {
      const { rejected } = validateCitations(
        [scripture({ canonicalReference: 'JHN.8.28' })],
        [unit()],
      );

      expect(rejected).toHaveLength(1);
    });

    it('never repairs a bad citation', () => {
      // Guessing which unit a model meant would invent the grounding, which is
      // the thing being prevented.
      const bad = scripture({ retrievalUnitId: 'wrong' });
      const { valid } = validateCitations([bad], [unit()]);

      expect(valid).toEqual([]);
    });
  });

  describe('accepts a reference inside a passage range', () => {
    it('allows a verse within a multi-verse unit', () => {
      const passage = unit({
        id: 'p1',
        unitType: 'passage',
        referenceStart: 'ROM.8.28',
        referenceEnd: 'ROM.8.33',
      });

      const { valid } = validateCitations(
        [scripture({ retrievalUnitId: 'p1', canonicalReference: 'ROM.8.30' })],
        [passage],
      );

      expect(valid).toHaveLength(1);
    });

    it('allows the range boundaries themselves', () => {
      const passage = unit({
        id: 'p1',
        referenceStart: 'ROM.8.28',
        referenceEnd: 'ROM.8.33',
      });

      for (const reference of ['ROM.8.28', 'ROM.8.33']) {
        const { valid } = validateCitations(
          [scripture({ retrievalUnitId: 'p1', canonicalReference: reference })],
          [passage],
        );

        expect(valid, reference).toHaveLength(1);
      }
    });

    it('rejects a verse just past the range end', () => {
      const passage = unit({
        id: 'p1',
        referenceStart: 'ROM.8.28',
        referenceEnd: 'ROM.8.33',
      });

      const { rejected } = validateCitations(
        [scripture({ retrievalUnitId: 'p1', canonicalReference: 'ROM.8.34' })],
        [passage],
      );

      expect(rejected).toHaveLength(1);
    });

    it('allows a verse in a chapter unit that carries no verse component', () => {
      // A chapter unit's referenceStart is BOOK.CHAPTER, so a verse inside it
      // must compare as within range rather than past its end.
      const chapter = unit({
        id: 'c1',
        unitType: 'chapter',
        referenceStart: 'ROM.8',
        referenceEnd: null,
      });

      const { valid, rejected } = validateCitations(
        [scripture({ retrievalUnitId: 'c1', canonicalReference: 'ROM.8.28' })],
        [chapter],
      );

      expect(rejected, JSON.stringify(rejected)).toHaveLength(0);
      expect(valid).toHaveLength(1);
    });
  });

  describe('non-Scripture citations', () => {
    it('passes through kinds with no corpus to check against', () => {
      // Lexical and historical data are not yet sourced (§14.1). They are not
      // validated because there is nothing to validate against — which is not
      // the same as being verified, and the caller must not present them so.
      const { valid } = validateCitations(
        [
          { kind: 'lexical', label: 'ἀγάπη' },
          { kind: 'historical', label: 'Roman house churches' },
        ],
        [],
      );

      expect(valid).toHaveLength(2);
    });

    it('still rejects a Scripture citation when nothing was retrieved', () => {
      const { valid, rejected } = validateCitations([scripture()], []);

      expect(valid).toHaveLength(0);
      expect(rejected).toHaveLength(1);
    });
  });

  it('reports rejections rather than discarding them silently', () => {
    // §34 wants this visible: a rising rejection rate is the signal that a
    // prompt or a model has started inventing references.
    const { rejected } = validateCitations(
      [scripture(), scripture({ retrievalUnitId: 'missing' })],
      [unit()],
    );

    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.citation.retrievalUnitId).toBe('missing');
  });
});
