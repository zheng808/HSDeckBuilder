import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { ApiError } from './errors.js';
import { optionalOwnerHash } from './owner.js';
import type { StoredUser, UserRepo } from '../auth/user-repo.js';

/** Who is making the request: a signed-in user and/or an anonymous owner token. */
export interface Viewer {
  user: StoredUser | null;
  ownerHash: string | undefined;
}

export type AppEnv = { Variables: { viewer: Viewer } };

export function viewerMiddleware(
  users: UserRepo,
  sessionCookie: string,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const sid = getCookie(c, sessionCookie);
    const user = sid ? (users.userForSession(sid) ?? null) : null;
    c.set('viewer', { user, ownerHash: optionalOwnerHash(c) });
    await next();
  };
}

export function requireUser(c: Context<AppEnv>): StoredUser {
  const user = c.get('viewer').user;
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to do this');
  return user;
}

export function requireAdmin(c: Context<AppEnv>, adminApiToken = ''): void {
  const headerToken = c.req.header('x-admin-token');
  if (adminApiToken && headerToken && headerToken === adminApiToken) return;
  const user = requireUser(c);
  if (!user.isAdmin) throw new ApiError(403, 'FORBIDDEN', 'Admins only');
}

/** A viewer can write when signed in or when presenting an owner token. */
export function requireWriter(c: Context<AppEnv>): Viewer {
  const viewer = c.get('viewer');
  if (!viewer.user && !viewer.ownerHash) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Sign in or send an x-owner-token header');
  }
  return viewer;
}
