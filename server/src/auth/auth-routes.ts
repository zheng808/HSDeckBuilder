import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { AUTH_PROVIDERS, type AuthProvider } from '@hsdeck/shared';
import { ApiError, badRequest, notFound } from '../http/errors.js';
import { hashOwnerToken, optionalOwnerHash } from '../http/owner.js';
import type { AppEnv } from '../http/viewer.js';
import type { DeckRepo } from '../decks/deck-repo.js';
import type { OAuthClients } from './oauth.js';
import { publicUser, type UserRepo } from './user-repo.js';

export const SESSION_COOKIE = 'hs_session';
const STATE_COOKIE = 'hs_oauth';
const STATE_MAX_AGE = 600;

interface OAuthState {
  provider: AuthProvider;
  state: string;
  codeVerifier: string;
  ownerToken: string | null;
  returnTo: string;
}

export interface AuthRouteDeps {
  users: UserRepo;
  decks: DeckRepo;
  clients: OAuthClients;
  secret: string;
  secure: boolean;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function encodeState(s: OAuthState, secret: string): string {
  const payload = Buffer.from(JSON.stringify(s)).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

function decodeState(value: string | undefined, secret: string): OAuthState | null {
  if (!value) return null;
  const [payload, sig] = value.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload, secret);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState;
  } catch {
    return null;
  }
}

/** Only same-origin paths may be used as a post-login destination. */
function safeReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

function isProvider(value: string): value is AuthProvider {
  return (AUTH_PROVIDERS as readonly string[]).includes(value);
}

export function authRoutes({ users, decks, clients, secret, secure }: AuthRouteDeps) {
  const app = new Hono<AppEnv>();

  app.get('/auth/providers', (c) =>
    c.json({ providers: AUTH_PROVIDERS.filter((p) => clients[p] !== undefined) }),
  );

  app.get('/auth/login/:provider', (c) => {
    const provider = c.req.param('provider');
    if (!isProvider(provider)) throw notFound('Sign-in provider');
    const client = clients[provider];
    if (!client) throw notFound('Sign-in provider');
    const state: OAuthState = {
      provider,
      state: randomBytes(16).toString('base64url'),
      codeVerifier: randomBytes(32).toString('base64url'),
      ownerToken: c.req.query('ownerToken')?.trim() || null,
      returnTo: safeReturnTo(c.req.query('returnTo')),
    };
    setCookie(c, STATE_COOKIE, encodeState(state, secret), {
      httpOnly: true,
      sameSite: 'Lax',
      secure,
      path: '/api/auth',
      maxAge: STATE_MAX_AGE,
    });
    return c.redirect(client.authorizationUrl(state.state, state.codeVerifier).toString(), 302);
  });

  app.get('/auth/callback/:provider', async (c) => {
    const provider = c.req.param('provider');
    const client = isProvider(provider) ? clients[provider] : undefined;
    const saved = decodeState(getCookie(c, STATE_COOKIE), secret);
    deleteCookie(c, STATE_COOKIE, { path: '/api/auth' });
    const fail = (code: string) => c.redirect(`/?auth_error=${encodeURIComponent(code)}`, 302);
    if (!client || !saved || saved.provider !== provider) return fail('state');
    if (c.req.query('error')) return fail(c.req.query('error')!);
    const code = c.req.query('code');
    if (!code || c.req.query('state') !== saved.state) return fail('state');

    let identity;
    try {
      identity = await client.identityForCode(code, saved.codeVerifier);
    } catch (err) {
      console.error('oauth exchange failed', err);
      return fail('exchange');
    }
    const user = users.upsertFromOAuth(identity);
    if (saved.ownerToken) users.claimDecks(user.id, hashOwnerToken(saved.ownerToken));
    const session = users.createSession(user.id);
    setCookie(c, SESSION_COOKIE, session.id, {
      httpOnly: true,
      sameSite: 'Lax',
      secure,
      path: '/',
      expires: new Date(session.expiresAt),
    });
    return c.redirect(saved.returnTo, 302);
  });

  app.get('/auth/me', (c) => {
    const user = c.get('viewer').user;
    return c.json({ user: user ? publicUser(user) : null });
  });

  app.post('/auth/logout', (c) => {
    const sid = getCookie(c, SESSION_COOKIE);
    if (sid) users.deleteSession(sid);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.body(null, 204);
  });

  app.post('/auth/claim', (c) => {
    const user = c.get('viewer').user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in first');
    const ownerHash = optionalOwnerHash(c);
    if (!ownerHash) throw badRequest('Missing x-owner-token header');
    return c.json({ claimed: users.claimDecks(user.id, ownerHash) });
  });

  app.get('/users/:id', (c) => {
    const user = users.get(c.req.param('id'));
    if (!user) throw notFound('User');
    const { items } = decks.listPublished({
      author: user.id,
      kind: 'all',
      sort: 'newest',
      limit: 100,
      offset: 0,
    });
    return c.json({
      user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl, createdAt: user.createdAt },
      decks: items,
    });
  });

  return app;
}
