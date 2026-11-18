import { GitHub, Google, decodeIdToken } from 'arctic';
import type { AuthProvider } from '@hsdeck/shared';
import type { OAuthIdentity } from './user-repo.js';

/** What the auth routes need from a provider; swapped for a fake in tests. */
export interface OAuthClient {
  /** Builds the provider authorization URL. Google needs PKCE, hence codeVerifier. */
  authorizationUrl(state: string, codeVerifier: string): URL;
  /** Exchanges the callback code for the signed-in identity. */
  identityForCode(code: string, codeVerifier: string): Promise<OAuthIdentity>;
}

export type OAuthClients = Partial<Record<AuthProvider, OAuthClient>>;

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
}

export function githubClient(creds: OAuthCredentials, redirectUri: string): OAuthClient {
  const github = new GitHub(creds.clientId, creds.clientSecret, redirectUri);
  return {
    authorizationUrl: (state) => github.createAuthorizationURL(state, ['read:user']),
    async identityForCode(code) {
      const tokens = await github.validateAuthorizationCode(code);
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokens.accessToken()}`, 'User-Agent': 'hsdeckbuilder' },
      });
      if (!res.ok) throw new Error(`GitHub user lookup failed: ${res.status}`);
      const u = (await res.json()) as {
        id: number;
        login: string;
        name: string | null;
        avatar_url: string | null;
      };
      return {
        provider: 'github',
        providerId: String(u.id),
        login: u.login,
        name: u.name?.trim() || u.login,
        avatarUrl: u.avatar_url ?? null,
      };
    },
  };
}

export function googleClient(creds: OAuthCredentials, redirectUri: string): OAuthClient {
  const google = new Google(creds.clientId, creds.clientSecret, redirectUri);
  return {
    authorizationUrl: (state, codeVerifier) =>
      google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']),
    async identityForCode(code, codeVerifier) {
      const tokens = await google.validateAuthorizationCode(code, codeVerifier);
      const claims = decodeIdToken(tokens.idToken()) as {
        sub: string;
        name?: string;
        picture?: string;
        email?: string;
      };
      const login = claims.email ?? claims.sub;
      return {
        provider: 'google',
        providerId: claims.sub,
        login,
        name: claims.name?.trim() || login.split('@')[0] || 'Google user',
        avatarUrl: claims.picture ?? null,
      };
    },
  };
}

export function clientsFromConfig(
  oauth: { github: OAuthCredentials | null; google: OAuthCredentials | null },
  appUrl: string,
): OAuthClients {
  const clients: OAuthClients = {};
  if (oauth.github)
    clients.github = githubClient(oauth.github, `${appUrl}/api/auth/callback/github`);
  if (oauth.google)
    clients.google = googleClient(oauth.google, `${appUrl}/api/auth/callback/google`);
  return clients;
}
