import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { SessionRepository } from '../database/session.repository';
import { ReaderGuard, readerIdOf, type AuthenticatedRequest } from './reader.guard';

const contextWith = (cookie?: string) => {
  const request = { headers: cookie === undefined ? {} : { cookie } } as AuthenticatedRequest;

  return {
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
    request,
  };
};

const guardWith = (userId: string | null) => {
  const findUserIdByToken = vi.fn().mockResolvedValue(userId);

  return {
    guard: new ReaderGuard({ findUserIdByToken } as unknown as SessionRepository),
    findUserIdByToken,
  };
};

describe('ReaderGuard', () => {
  it('attaches the reader id from a valid session cookie', async () => {
    const { guard } = guardWith('reader-1');
    const { context, request } = contextWith('authjs.session-token=abc123');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.readerId).toBe('reader-1');
  });

  it('accepts the __Secure- prefixed cookie production sets', async () => {
    // Auth.js prefixes the name over HTTPS. Accepting only the bare name would
    // reject every real production request.
    const { guard } = guardWith('reader-1');
    const { context } = contextWith('__Secure-authjs.session-token=abc123');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('finds the session cookie among others', async () => {
    const { guard, findUserIdByToken } = guardWith('reader-1');
    const { context } = contextWith('theme=dark; authjs.session-token=abc123; other=1');

    await guard.canActivate(context);

    expect(findUserIdByToken).toHaveBeenCalledWith('abc123');
  });

  describe('fails closed', () => {
    it('rejects a request with no cookie header', async () => {
      const { guard } = guardWith('reader-1');
      const { context } = contextWith();

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an unknown or expired session', async () => {
      // The repository returns null for both, and the guard must not
      // distinguish them — an error that told them apart would reveal whether a
      // token was ever valid.
      const { guard } = guardWith(null);
      const { context } = contextWith('authjs.session-token=stale');

      await expect(guard.canActivate(context)).rejects.toThrow(/Sign in to continue/);
    });

    it('does not look up a session when no cookie is present', async () => {
      const { guard, findUserIdByToken } = guardWith('reader-1');
      const { context } = contextWith('theme=dark');

      await expect(guard.canActivate(context)).rejects.toThrow();
      expect(findUserIdByToken).not.toHaveBeenCalled();
    });

    it('ignores a cookie whose name is not one Auth.js sets', async () => {
      // A guard accepting any cookie-looking value would authenticate on an
      // attacker-chosen header.
      const { guard } = guardWith('reader-1');
      const { context } = contextWith('session=abc123; token=abc123');

      await expect(guard.canActivate(context)).rejects.toThrow();
    });

    it('rejects an empty cookie value', async () => {
      const { guard } = guardWith('reader-1');
      const { context } = contextWith('authjs.session-token=');

      await expect(guard.canActivate(context)).rejects.toThrow();
    });
  });
});

describe('readerIdOf', () => {
  it('returns the id the guard attached', () => {
    expect(readerIdOf({ readerId: 'reader-1' } as AuthenticatedRequest)).toBe('reader-1');
  });

  it('throws rather than returning undefined when the guard was bypassed', () => {
    // Reaching a handler with no id means the guard was removed. Continuing
    // would run an ownership-scoped query with no owner, which returns another
    // reader's rows or none — neither is acceptable silently.
    expect(() => readerIdOf({} as AuthenticatedRequest)).toThrow(UnauthorizedException);
  });
});
