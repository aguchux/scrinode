import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './database.constants';
import { BaseRepository } from './repository.base';

/**
 * Reader session lookup.
 *
 * Auth.js owns the `sessions` table (migration 0003) and its quoted column
 * names — §24's stated exception. With the database session strategy the cookie
 * carries an opaque token and the session record is the authority, so verifying
 * one is a lookup rather than a signature check. That is why this needs no
 * secret: there is no JWT to verify.
 *
 * **Expiry is checked in the query, not by the caller.** A guard that fetched a
 * row and compared dates afterwards is a guard someone will eventually write
 * without the comparison.
 */
@Injectable()
export class SessionRepository extends BaseRepository {
  constructor(@Inject(PG_POOL) pool: Pool) {
    super(pool, 'sessions');
  }

  /**
   * The user id behind a session token, or null.
   *
   * Null covers every failure identically — unknown token, expired session,
   * deleted user. A caller cannot tell them apart, which is deliberate: an
   * error distinguishing "expired" from "never existed" tells an attacker
   * whether a token was ever valid.
   */
  async findUserIdByToken(sessionToken: string): Promise<string | null> {
    if (sessionToken.length === 0) return null;

    const row = await this.queryOne<{ userId: string }>(
      `SELECT "userId" FROM sessions
        WHERE "sessionToken" = $1 AND expires > now()`,
      [sessionToken],
    );

    return row?.userId ?? null;
  }
}
