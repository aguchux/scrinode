import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionRepository } from '../database/session.repository';

/**
 * Reader authentication — §27.1.
 *
 * Resolves the Auth.js session cookie to a user id and attaches it to the
 * request. Every route it guards can then rely on `readerId` being a real,
 * unexpired reader.
 *
 * **This authenticates readers only.** §27.3 forbids a reader token authorising
 * an admin route and vice versa; admin identity is a separate system with its
 * own tables, and this guard must never be reused there. It reads only
 * `sessions`, which holds no privilege fields — there is nothing here to
 * escalate with.
 *
 * Fails closed. No cookie, an unknown token or an expired session are all 401,
 * indistinguishable from each other so a caller cannot probe which tokens
 * existed.
 */

/**
 * The cookie Auth.js sets.
 *
 * It prefixes the name with `__Secure-` when the site is served over HTTPS, so
 * both are accepted — the secure variant first, since production sets that one.
 */
const COOKIE_NAMES = ['__Secure-authjs.session-token', 'authjs.session-token'] as const;

/** A request that has passed this guard. */
export interface AuthenticatedRequest extends Request {
  readerId?: string;
}

@Injectable()
export class ReaderGuard implements CanActivate {
  constructor(private readonly sessions: SessionRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionCookie(request);

    if (!token) throw new UnauthorizedException('Sign in to continue.');

    const readerId = await this.sessions.findUserIdByToken(token);

    // Same message for an expired and an unknown session: distinguishing them
    // tells an attacker whether a token was ever valid.
    if (!readerId) throw new UnauthorizedException('Sign in to continue.');

    request.readerId = readerId;

    return true;
  }
}

/**
 * Read the session token from the request's cookies.
 *
 * Parsed here rather than relying on `cookie-parser`: the API does not register
 * it, and adding middleware for one header is more surface than a read. Only the
 * two known names are considered — a guard that accepted any cookie-looking
 * value would authenticate on an attacker-chosen header.
 */
function readSessionCookie(request: Request): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;

    const name = part.slice(0, separator).trim();
    if (!(COOKIE_NAMES as readonly string[]).includes(name)) continue;

    const value = decodeURIComponent(part.slice(separator + 1).trim());
    if (value.length > 0) return value;
  }

  return undefined;
}

/**
 * The authenticated reader's id.
 *
 * Throws rather than returning undefined: reaching a guarded handler without an
 * id means the guard was removed, and continuing would run an ownership-scoped
 * query with no owner.
 */
export function readerIdOf(request: AuthenticatedRequest): string {
  const readerId = request.readerId;

  if (!readerId) {
    throw new UnauthorizedException('Sign in to continue.');
  }

  return readerId;
}
