import { createHash } from 'node:crypto';
import type { Context } from 'hono';
import { ApiError } from './errors.js';

export const OWNER_HEADER = 'x-owner-token';

export function hashOwnerToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Hash of the caller's owner token, or undefined when the header is absent. */
export function optionalOwnerHash(c: Context): string | undefined {
  const token = c.req.header(OWNER_HEADER)?.trim();
  if (!token || token.length < 8 || token.length > 200) return undefined;
  return hashOwnerToken(token);
}

export function requireOwnerHash(c: Context): string {
  const hash = optionalOwnerHash(c);
  if (!hash) {
    throw new ApiError(401, 'UNAUTHORIZED', `Missing ${OWNER_HEADER} header`);
  }
  return hash;
}
