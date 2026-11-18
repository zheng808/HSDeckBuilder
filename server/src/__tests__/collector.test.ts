import { describe, expect, it } from 'vitest';
import { encodeDeckstring } from '@hsdeck/shared';
import { CardStore } from '../cards/card-store.js';
import { config } from '../config.js';
import { openDatabase } from '../db.js';
import { DeckRepo } from '../decks/deck-repo.js';
import { CandidateRepo } from '../pro/candidate-repo.js';
import { collectProLists, guessArchetype } from '../pro/collect.js';
import { adminRoutes } from '../pro/admin-routes.js';
import { Hono } from 'hono';
import type { AppEnv } from '../http/viewer.js';

const cards = CardStore.fromDataDir(config.dataDir);
const legalCode = () =>
  encodeDeckstring({
    format: 'STANDARD',
    heroClass: 'HUNTER',
    cards: cards
      .query({ class: 'HUNTER', format: 'STANDARD' })
      .filter((c) => c.rarity !== 'LEGENDARY')
      .slice(0, 15)
      .map((c) => ({ dbfId: c.dbfId, count: 2 })),
  });

/** Minimal YouTube API double keyed by endpoint. */
function fakeYoutube(description: string): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    const body = url.includes('/channels?')
      ? { items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU123' } } }] }
      : url.includes('/playlistItems?')
        ? { items: [{ contentDetails: { videoId: 'vid1' } }] }
        : {
            items: [
              {
                id: 'vid1',
                snippet: {
                  title: 'FACE HUNTER is back (Hearthstone)',
                  description,
                  publishedAt: '2026-11-01T00:00:00Z',
                },
              },
            ],
          };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

describe('pro-list collector', () => {
  it('guesses archetypes from titles', () => {
    expect(guessArchetype('FACE HUNTER is back!', 'HUNTER')).toBe('Face Hunter');
    expect(guessArchetype('Big Raza DH deck guide', 'DEMONHUNTER')).toBe('Raza Demon Hunter');
    expect(guessArchetype('The best Mage deck', 'MAGE')).toBeNull();
    expect(guessArchetype('anything', null)).toBeNull();
  });

  it('stores decoded candidates once, flags bad codes, and approves into a published deck', async () => {
    const db = openDatabase(':memory:');
    const candidates = new CandidateRepo(db);
    const decks = new DeckRepo(db);
    const code = legalCode();
    const tooShort = encodeDeckstring({
      format: 'STANDARD',
      heroClass: 'HUNTER',
      cards: cards
        .query({ class: 'HUNTER', format: 'STANDARD' })
        .slice(0, 2)
        .map((c) => ({ dbfId: c.dbfId, count: 1 })),
    });
    const description = `Deck code:\n${code}\n\nIncomplete: ${tooShort}\n`;
    const deps = {
      cards,
      candidates,
      dataDir: config.dataDir,
      youtubeApiKey: 'k',
      fetchImpl: fakeYoutube(description),
    };

    const first = await collectProLists(deps);
    expect(first.errors).toEqual([]);
    expect(first.added).toBe(2);
    const second = await collectProLists(deps);
    expect(second.added).toBe(0);
    expect(second.skipped).toBeGreaterThanOrEqual(2); // every channel re-finds the same two codes

    const pending = candidates.list('pending', 10);
    const good = pending.find((c) => c.issues.length === 0)!;
    const bad = pending.find((c) => c.issues.length > 0)!;
    expect(good.heroClass).toBe('HUNTER');
    expect(good.archetypeGuess).toBe('Face Hunter');
    expect(good.source).toMatchObject({
      type: 'creator',
      url: 'https://www.youtube.com/watch?v=vid1',
    });
    expect(bad.cardCount).toBe(2);

    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('viewer', {
        user: {
          id: 'u',
          name: 'Boss',
          avatarUrl: null,
          isAdmin: true,
          createdAt: '',
          provider: 'github',
          providerId: 'x',
          login: 'boss',
        },
        ownerHash: undefined,
      });
      await next();
    });
    app.route(
      '/api',
      adminRoutes({
        candidates,
        decks,
        cards,
        dataDir: config.dataDir,
        youtubeApiKey: 'k',
        adminApiToken: '',
      }),
    );
    const approve = await app.request(`/api/admin/candidates/${good.id}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ archetype: 'Face Hunter' }),
    });
    expect(approve.status).toBe(200);
    const body = (await approve.json()) as {
      candidate: { status: string; deckId: string };
      deck: { published: boolean; source: { type: string } };
    };
    expect(body.candidate.status).toBe('approved');
    expect(body.deck.published).toBe(true);
    expect(body.deck.source.type).toBe('creator');
    expect(decks.listPublished({ kind: 'pro', sort: 'newest', limit: 10, offset: 0 }).total).toBe(
      1,
    );

    const reject = await app.request(`/api/admin/candidates/${bad.id}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(reject.status).toBe(422);
  });
});
