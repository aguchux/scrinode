import type { Citation } from '@scrinode/types';
import type { RetrievedUnit } from '../database/retrieval.repository';

/**
 * Citation validation — §16's last stage before a response is delivered.
 *
 * This is the mechanism behind §2.2: *do not fabricate sources, lexical
 * claims, cross-references, historical facts, or citations*. A model that has
 * read every translation will happily produce a reference that looks right and
 * does not exist, and it will do so confidently. Nothing else in the pipeline
 * catches that.
 *
 * The rule is narrow and absolute: **a Scripture citation must trace to a unit
 * that was actually retrieved for this turn.** Not to a unit that exists — to
 * one that was in the context the model was given. A citation naming a real
 * verse the model recalled unaided is still fabricated, because the grounding
 * is what makes it checkable (§1's VERIFY step).
 *
 * Invalid citations are **dropped, not corrected**. Guessing which unit a
 * model meant would be inventing the grounding, which is the thing being
 * prevented.
 */

export interface ValidationResult {
  /** Citations that trace to retrieved context. Safe to deliver. */
  readonly valid: readonly Citation[];

  /**
   * Citations that did not, with why.
   *
   * Kept rather than discarded silently: §34 wants this visible, and a rising
   * rejection rate is the signal that a prompt or a model has started
   * inventing references.
   */
  readonly rejected: readonly { readonly citation: Citation; readonly reason: string }[];
}

/**
 * Validate citations against the units retrieved for this turn.
 *
 * `units` is the retrieval result the model was given — not the whole corpus.
 */
export function validateCitations(
  citations: readonly Citation[],
  units: readonly RetrievedUnit[],
): ValidationResult {
  const byId = new Map(units.map((unit) => [unit.id, unit]));

  const valid: Citation[] = [];
  const rejected: { citation: Citation; reason: string }[] = [];

  for (const citation of citations) {
    const reason = rejectionReason(citation, byId);

    if (reason) rejected.push({ citation, reason });
    else valid.push(citation);
  }

  return { valid, rejected };
}

/**
 * Why a citation fails, or undefined if it passes.
 *
 * Only Scripture citations are checked against retrieval. The other kinds —
 * lexical, historical, research-source — have no corpus behind them yet
 * (§14.1 records original-language data as not yet sourced), so there is
 * nothing to validate against. **They are passed through rather than
 * silently accepted as grounded**: a caller must not present them as verified,
 * and the day a lexicon is ingested this function gains a branch rather than
 * a caveat.
 */
function rejectionReason(
  citation: Citation,
  byId: Map<string, RetrievedUnit>,
): string | undefined {
  if (citation.kind !== 'scripture') return undefined;

  if (!citation.retrievalUnitId) {
    return 'A Scripture citation carries no retrieval unit id, so it cannot be traced.';
  }

  const unit = byId.get(citation.retrievalUnitId);

  if (!unit) {
    return 'The cited unit was not among those retrieved for this turn.';
  }

  // A citation may not relabel the passage it came from. The reference is the
  // reader's route back to the text, and a wrong one sends them somewhere the
  // quoted words are not.
  if (
    citation.canonicalReference &&
    unit.referenceStart &&
    !coversReference(citation.canonicalReference, unit)
  ) {
    return `The citation names ${citation.canonicalReference}, outside the cited unit.`;
  }

  // A citation's text is the verbatim retrieved text (§22.3 forbids
  // paraphrase). If it does not appear in the unit, the model rewrote
  // Scripture — which §22 treats as a correctness failure, not a style one.
  if (citation.text && !unit.text.includes(citation.text.trim())) {
    return 'The quoted text does not appear verbatim in the cited unit.';
  }

  return undefined;
}

/**
 * Whether a reference falls inside a unit's range.
 *
 * Canonical ids are `BOOK.CHAPTER.VERSE` (§10), so a range is comparable
 * component-wise. A unit with no `referenceEnd` spans a single reference.
 *
 * Deliberately not a reference parser: §42 forbids duplicating that, and
 * `@scrinode/scripture` owns it. This compares the ids Postgres stored, which
 * are already canonical — parsing them again would be the duplication.
 */
function coversReference(reference: string, unit: RetrievedUnit): boolean {
  const start = unit.referenceStart;

  // Guarded before `end` is derived from it, so both are known strings below.
  if (!start) return false;

  const end = unit.referenceEnd ?? start;

  const target = parts(reference);
  const low = parts(start);
  const high = parts(end);

  if (!target || !low || !high) return false;

  // A unit never spans books, so a different book is out of range regardless
  // of the numbers.
  if (target.book !== low.book) return false;

  // A chapter-level reference has no verse component, and its end must cover
  // the whole chapter rather than verse 0. Without this, a chapter unit
  // `ROM.8` rejects a citation of `ROM.8.28` — every citation of a chapter
  // unit, which is how this was caught.
  const upperBound = hasVerse(end) ? high : { ...high, verse: Number.MAX_SAFE_INTEGER };

  return compare(target, low) >= 0 && compare(target, upperBound) <= 0;
}

/** Whether a canonical id carries a verse component at all. */
function hasVerse(reference: string): boolean {
  return reference.split('.').length >= 3;
}

interface Parts {
  readonly book: string;
  readonly chapter: number;
  readonly verse: number;
}

function parts(reference: string): Parts | undefined {
  const [book, chapter, verse] = reference.split('.');

  if (!book || !chapter) return undefined;

  const chapterNumber = Number.parseInt(chapter, 10);
  if (!Number.isInteger(chapterNumber)) return undefined;

  // A chapter-level unit has no verse component. Treating it as verse 0 makes
  // it sort before every verse in the chapter, which is what a range starting
  // at a whole chapter means.
  const verseNumber = verse === undefined ? 0 : Number.parseInt(verse, 10);

  return {
    book,
    chapter: chapterNumber,
    verse: Number.isInteger(verseNumber) ? verseNumber : 0,
  };
}

function compare(a: Parts, b: Parts): number {
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;

  return a.verse - b.verse;
}
