import type { AuthProvider } from '@hsdeck/shared';
import { getOwnerToken } from './owner-token';

export const PROVIDER_LABEL: Record<AuthProvider, string> = {
  github: 'GitHub',
  google: 'Google',
};

/**
 * Full-page navigation target that starts the OAuth flow. The owner token rides
 * along so the server can claim this browser's anonymous decks after sign-in.
 */
export function loginUrl(provider: AuthProvider, returnTo: string): string {
  const safeReturn = returnTo.startsWith('/') ? returnTo : '/';
  return `/api/auth/login/${provider}?ownerToken=${encodeURIComponent(getOwnerToken())}&returnTo=${encodeURIComponent(safeReturn)}`;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  denied: 'Sign-in was cancelled.',
  state: 'Sign-in expired or was tampered with. Please try again.',
  provider: 'That sign-in provider is not configured.',
  exchange: 'The provider rejected the sign-in. Please try again.',
};

export function authErrorMessage(code: string): string {
  return AUTH_ERROR_MESSAGES[code] ?? `Sign-in failed (${code}).`;
}

/** Initials for an avatar fallback, e.g. "Alex Li" → "AL". */
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '?'
  );
}
