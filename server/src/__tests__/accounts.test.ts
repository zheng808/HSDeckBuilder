import { beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import { createApp } from '../app.js';
import { CardStore } from '../cards/card-store.js';
import { config } from '../config.js';
import { openDatabase } from '../db.js';
import type { OAuthClient } from '../auth/oauth.js';
import type { AppEnv } from '../http/viewer.js';

let app: Hono<AppEnv>;
let cards: CardStore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const read = async (res: Response): Promise<any> => res.json();
const GUEST = { 'x-owner-token': 'guest-token-1234' };

/** Fake provider: the "code" is the login name; identity derives from it. */
const fakeGithub: OAuthClient = {
  authorizationUrl: (state) => new URL(`https://fake.github/authorize?state=${state}`),
  async identityForCode(code) {
    return {
      provider: 'github',
      providerId: `id-${code}`,
      login: code,
      name: code.toUpperCase(),
      avatarUrl: null,
    };
  },
};

const cookieFrom = (res: Response, name: string) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0]!)
    .find((c) => c.startsWith(`${name}=`))!;

/** Walks login → callback for `login`, returning the session cookie header. */
async function signIn(login: string, ownerToken?: string): Promise<Record<string, string>> {
  const query = ownerToken ? `?ownerToken=${ownerToken}&returnTo=/my` : '';
  const start = await app.request(`/api/auth/login/github${query}`);
  expect(start.status).toBe(302);
  const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
  const stateCookie = cookieFrom(start, 'hs_oauth');
  const cb = await app.request(`/api/auth/callback/github?code=${login}&state=${state}`, {
    headers: { cookie: stateCookie },
  });
  expect(cb.status).toBe(302);
  expect(cb.headers.get('location')).toBe(ownerToken ? '/my' : '/');
  return { cookie: cookieFrom(cb, 'hs_session') };
}

function sampleCards() {
  return cards
    .query({ class: 'MAGE', format: 'STANDARD' })
    .filter((c) => c.rarity !== 'LEGENDARY')
    .slice(0, 15)
    .map((c) => ({ dbfId: c.dbfId, count: 2 }));
}

beforeAll(() => {
  cards = CardStore.fromDataDir(config.dataDir);
  ({ app } = createApp({
    db: openDatabase(':memory:'),
    cards,
    quiet: true,
    oauthClients: { github: fakeGithub },
    adminLogins: ['github:boss'],
  }));
});

describe('accounts', () => {
  it('lists configured providers and rejects unknown ones', async () => {
    expect(await read(await app.request('/api/auth/providers'))).toEqual({ providers: ['github'] });
    expect((await app.request('/api/auth/login/google')).status).toBe(404);
  });

  it('rejects a callback whose state does not match', async () => {
    const start = await app.request('/api/auth/login/github');
    const res = await app.request('/api/auth/callback/github?code=x&state=wrong', {
      headers: { cookie: cookieFrom(start, 'hs_oauth') },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/?auth_error=state');
  });

  it('signs in, claims the guest decks, and owns them afterwards', async () => {
    const draft = await read(
      await app.request('/api/decks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...GUEST },
        body: JSON.stringify({
          name: 'Guest deck',
          heroClass: 'MAGE',
          format: 'STANDARD',
          cards: [],
        }),
      }),
    );
    expect(draft.deck.author).toBeNull();

    const session = await signIn('alex', GUEST['x-owner-token']);
    const me = await read(await app.request('/api/auth/me', { headers: session }));
    expect(me.user.name).toBe('ALEX');
    expect(me.user.isAdmin).toBe(false);

    const mine = await read(await app.request('/api/my/decks', { headers: session }));
    expect(mine.items.map((d: { id: string }) => d.id)).toEqual([draft.deck.id]);
    const view = await read(await app.request(`/api/decks/${draft.deck.id}`, { headers: session }));
    expect(view.isOwner).toBe(true);
    expect(view.deck.author.id).toBe(me.user.id);

    // The old token no longer owns it; another user can't touch it.
    expect((await app.request(`/api/decks/${draft.deck.id}`, { headers: GUEST })).status).toBe(404);
    const other = await signIn('mallory');
    const steal = await app.request(`/api/decks/${draft.deck.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...other },
      body: JSON.stringify({ name: 'mine now' }),
    });
    expect(steal.status).toBe(403);

    // Signed-in users create decks without a token.
    const created = await app.request('/api/decks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...session },
      body: JSON.stringify({
        name: 'Account deck',
        heroClass: 'MAGE',
        format: 'STANDARD',
        cards: sampleCards(),
      }),
    });
    expect(created.status).toBe(201);
    expect((await read(created)).deck.authorName).toBe('ALEX');

    const out = await app.request('/api/auth/logout', { method: 'POST', headers: session });
    expect(out.status).toBe(204);
    expect((await read(await app.request('/api/auth/me', { headers: session }))).user).toBeNull();
  });

  it('likes published decks once per user and exposes profiles', async () => {
    const author = await signIn('author');
    const created = await read(
      await app.request('/api/decks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...author },
        body: JSON.stringify({
          name: 'Liked deck',
          heroClass: 'MAGE',
          format: 'STANDARD',
          cards: sampleCards(),
        }),
      }),
    );
    await app.request(`/api/decks/${created.deck.id}/publish`, { method: 'POST', headers: author });

    expect(
      (await app.request(`/api/decks/${created.deck.id}/like`, { method: 'PUT', headers: GUEST }))
        .status,
    ).toBe(401);
    const fan = await signIn('fan');
    expect(
      await read(
        await app.request(`/api/decks/${created.deck.id}/like`, { method: 'PUT', headers: fan }),
      ),
    ).toEqual({ likes: 1, liked: true });
    expect(
      await read(
        await app.request(`/api/decks/${created.deck.id}/like`, { method: 'PUT', headers: fan }),
      ),
    ).toEqual({ likes: 1, liked: true });
    const view = await read(await app.request(`/api/decks/${created.deck.id}`, { headers: fan }));
    expect(view.liked).toBe(true);
    expect(view.deck.likes).toBe(1);
    expect(
      await read(
        await app.request(`/api/decks/${created.deck.id}/like`, { method: 'DELETE', headers: fan }),
      ),
    ).toEqual({ likes: 0, liked: false });

    const authorId = (await read(await app.request('/api/auth/me', { headers: author }))).user.id;
    const profile = await read(await app.request(`/api/users/${authorId}`));
    expect(profile.user.name).toBe('AUTHOR');
    expect(profile.decks.map((d: { id: string }) => d.id)).toEqual([created.deck.id]);
    const liked = await read(await app.request('/api/decks?sort=liked'));
    expect(liked.items[0].author.id).toBe(authorId);
  });

  it('gates admin routes and grants admin by login', async () => {
    const user = await signIn('alex');
    expect((await app.request('/api/admin/candidates', { headers: user })).status).toBe(403);
    expect((await app.request('/api/admin/candidates')).status).toBe(401);
    const boss = await signIn('boss');
    expect(await read(await app.request('/api/admin/candidates', { headers: boss }))).toEqual({
      items: [],
    });
  });
});
