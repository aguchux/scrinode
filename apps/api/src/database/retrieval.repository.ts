import { Inject, Injectable } from '@nestjs/common';
import { Pool, type QueryResultRow } from 'pg';
import { PG_POOL } from './database.constants';
import { BaseRepository } from './repository.base';

/**
 * Vector retrieval over `retrieval_units` — the vector half of §19.
 *
 * Deliberately not imported from `@scrinode/ingest`: that package is a CLI
 * with its own pool and its own lifecycle, and §29 keeps heavy work out of the
 * API. The SQL is duplicated on purpose; the alternative is the API depending
 * on an ingestion tool, which couples request latency to a batch program.
 *
 * Three properties of this query are load-bearing and easy to lose:
 *
 * **The question is embedded as a query, stored text as a document.** Voyage
 * prepends a different instruction for each, and mismatching them measurably
 * degrades results. It is the easiest retrieval bug to introduce and the
 * hardest to notice, because nothing fails — the answers just get worse.
 *
 * **`embedding_model` is always filtered.** All 424,765 stored vectors are
 * `voyage-4`; a vector from another model occupies an unrelated space, so
 * scores across them are meaningless rather than merely wrong.
 *
 * **`SET LOCAL hnsw.ef_search` needs a transaction.** It applies for the
 * transaction, and pooled queries may otherwise land on different connections,
 * leaving it unset for exactly the query that needs it. This is also why it
 * survives PgBouncer: the setting and the query share one transaction.
 */

/** Fixed by the corpus. Changing it means re-embedding every unit. */
const EMBEDDING_MODEL = 'voyage-4';
const EMBEDDING_DIMENSIONS = 1024;

/**
 * How many HNSW graph nodes to visit before ranking.
 *
 * Higher means better recall and more work. Below the requested row count the
 * index cannot return a full result set.
 */
const DEFAULT_EF_SEARCH = 100;

export type UnitType = 'verse' | 'passage' | 'chapter';

export interface RetrievalFilter {
  /**
   * Which translations may be searched.
   *
   * Required, and required to be non-empty. §22.1 gates every read on
   * `isAvailable()`, and an unfiltered search would return text from a
   * translation the reader may not be served — a licensing breach rather than
   * a bug. The caller resolves availability; this enforces that it did.
   */
  readonly translations: readonly string[];

  readonly unitType?: UnitType;
  readonly bookId?: string;
  readonly testament?: 'OT' | 'NT';
  readonly limit?: number;
  readonly efSearch?: number;
}

export interface RetrievedUnit {
  readonly id: string;
  readonly unitType: UnitType;
  readonly translation: string | null;
  readonly referenceStart: string | null;
  readonly referenceEnd: string | null;
  readonly text: string;
  /** Cosine similarity in 0..1, converted from pgvector's distance. */
  readonly score: number;
}

interface UnitRow {
  id: string;
  unit_type: UnitType;
  translation: string | null;
  reference_start: string | null;
  reference_end: string | null;
  text: string;
  distance: number | string;
}

export class RetrievalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetrievalError';
  }
}

@Injectable()
export class RetrievalRepository extends BaseRepository {
  constructor(@Inject(PG_POOL) pool: Pool) {
    super(pool, 'retrieval_units');
  }

  /**
   * Nearest units to a query vector.
   *
   * Takes a vector rather than a question: embedding is the AI layer's job
   * (§17), and a repository that called a vendor would put an HTTP request
   * inside the data layer.
   */
  async search(
    queryVector: readonly number[],
    filter: RetrievalFilter,
  ): Promise<RetrievedUnit[]> {
    if (queryVector.length !== EMBEDDING_DIMENSIONS) {
      // The halfvec column declares the width and would reject this, but the
      // error from Postgres names a type rather than the cause.
      throw new RetrievalError(
        `Expected a ${EMBEDDING_DIMENSIONS}-dimension query vector, received ${queryVector.length}. ` +
          `The corpus is embedded with ${EMBEDDING_MODEL}.`,
      );
    }

    if (filter.translations.length === 0) {
      // Fail closed. An empty filter must never widen to "all translations":
      // §22.1 makes registry membership insufficient and availability the gate,
      // so a caller that resolved nothing available gets nothing.
      return [];
    }

    const limit = filter.limit ?? 8;
    const efSearch = Math.max(filter.efSearch ?? DEFAULT_EF_SEARCH, limit);

    // $1 is the vector; every subsequent value is bound, never interpolated
    // (§24, §33).
    const params: unknown[] = [toVectorLiteral(queryVector)];
    const conditions: string[] = [];

    const bind = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    conditions.push(`translation = ANY(${bind(filter.translations.map(upper))})`);
    conditions.push(`embedding_model = ${bind(EMBEDDING_MODEL)}`);

    // Unembedded rows would otherwise sort last by distance rather than being
    // excluded, filling a short result set with rows that cannot match.
    conditions.push('embedding IS NOT NULL');

    if (filter.unitType) conditions.push(`unit_type = ${bind(filter.unitType)}`);
    if (filter.bookId) conditions.push(`book_id = ${bind(upper(filter.bookId))}`);
    if (filter.testament) conditions.push(`testament = ${bind(filter.testament)}`);

    const limitParam = bind(limit);

    const sql = `SELECT id, unit_type, translation, reference_start, reference_end, text,
                        embedding <=> $1::halfvec AS distance
                   FROM retrieval_units
                  WHERE ${conditions.join(' AND ')}
                  ORDER BY embedding <=> $1::halfvec
                  LIMIT ${limitParam}`;

    const rows = await this.withEfSearch<UnitRow>(efSearch, sql, params);

    return rows.map(toUnit);
  }

  /**
   * Confirm that unit ids exist and are readable under these translations.
   *
   * §16's citation validation: a citation naming a unit that was never
   * retrievable is exactly the fabricated reference §2.2 forbids. Returns the
   * subset that resolves, so the caller can drop the rest.
   */
  async resolveUnitIds(
    ids: readonly string[],
    translations: readonly string[],
  ): Promise<Set<string>> {
    if (ids.length === 0 || translations.length === 0) return new Set();

    const rows = await this.queryMany<{ id: string }>(
      `SELECT id FROM retrieval_units
        WHERE id = ANY($1) AND translation = ANY($2)`,
      [[...ids], translations.map(upper)],
    );

    return new Set(rows.map((row) => row.id));
  }

  /**
   * Run a query with `hnsw.ef_search` set.
   *
   * A dedicated client inside a transaction, because `SET LOCAL` scopes to the
   * transaction. Pooled queries can otherwise land on different connections,
   * which leaves the setting unapplied for the query that needed it and
   * silently degrades recall.
   *
   * `efSearch` is interpolated rather than bound: Postgres does not accept a
   * parameter in SET. It is coerced to a bounded integer first, so no caller
   * value reaches the statement.
   */
  private async withEfSearch<R extends QueryResultRow>(
    efSearch: number,
    sql: string,
    params: readonly unknown[],
  ): Promise<R[]> {
    const safe = Math.min(Math.max(Math.trunc(efSearch), 1), 1_000);

    return this.transaction(async (client) => {
      await client.query(`SET LOCAL hnsw.ef_search = ${safe}`);
      const { rows } = await client.query<R>(sql, [...params]);

      return rows;
    });
  }
}

/** pgvector's text input format. */
function toVectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(',')}]`;
}

const upper = (value: string): string => value.toUpperCase();

function toUnit(row: UnitRow): RetrievedUnit {
  // pgvector returns cosine *distance* in 0..2. Similarity is 1 - distance,
  // clamped because floating point can produce a hair past either end.
  const distance = typeof row.distance === 'string' ? Number(row.distance) : row.distance;

  return {
    id: row.id,
    unitType: row.unit_type,
    translation: row.translation,
    referenceStart: row.reference_start,
    referenceEnd: row.reference_end,
    text: row.text,
    score: Math.min(1, Math.max(0, 1 - distance)),
  };
}
