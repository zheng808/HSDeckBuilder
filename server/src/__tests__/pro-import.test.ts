import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import { encodeDeckstring } from '@hsdeck/shared';
import { createApp } from '../app.js';
import { CardStore } from '../cards/card-store.js';
import { config } from '../config.js';
import { openDatabase } from '../db.js';
import { DeckRepo } from '../decks/deck-repo.js';
import { importProDecks } from '../decks/pro-import.js';

let app: Hono;
let cards: CardStore;
let decks: DeckRepo;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const read = async (res: Response): Promise<any> => res.json();
const OWNER = { 'x-owner-token': 'owner-token-1234' };
const json = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

function legalHunterCode(): string {
  const pool = cards
    .query({ class: 'HUNTER', format: 'STANDARD' })
    .filter((c) => c.rarity !== 'LEGENDARY');
  const entries = pool.slice(0, 15).map((c) => ({ dbfId: c.dbfId, count: 2 }));
  return encodeDeckstring({ format: 'STANDARD', heroClass: 'HUNTER', cards: entries });
}

beforeAll(() => {
  cards = CardStore.fromDataDir(config.dataDir);
  ({ app, decks } = createApp({ db: openDatabase(':memory:'), cards, quiet: true }));
});

describe('pro deck import', () => {
  it('imports every list in the shipped server/data/pro-decks.json', () => {
    const seed = JSON.parse(
      readFileSync(path.join(config.dataDir, 'pro-decks.json'), 'utf8'),
    ) as unknown;
    const scratch = new DeckRepo(openDatabase(':memory:'));
    const result = importProDecks(seed, { decks: scratch, cards });
    expect(result.skipped).toEqual([]);
    expect(result.created).toBeGreaterThanOrEqual(5);
  });

  it('imports lists as published source-tagged decks, idempotently, and skips bad ones', () => {
    const code = legalHunterCode();
    const payload = [
      {
        event: 'Test Open 2026',
        url: 'https://example.com/lineups',
        date: '2026-11-01',
        decks: [
          {
            player: 'Rexxar',
            placement: 'Winner',
            name: 'Face Hunter',
            archetype: 'Face Hunter',
            code,
          },
          { player: 'Broken', code: 'AAECAR8AAAA=' }, // decodes, but has 0 cards
          { player: 'Garbage', code: 'not-a-code' },
        ],
      },
    ];
    const first = importProDecks(payload, { decks, cards });
    expect(first.created).toBe(1);
    expect(first.updated).toBe(0);
    expect(first.skipped.map((s) => s.player).sort()).toEqual(['Broken', 'Garbage']);

    const second = importProDecks(payload, { decks, cards });
    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);

    const list = decks.listPublished({ kind: 'pro', sort: 'newest', limit: 50, offset: 0 });
    expect(list.total).toBe(1);
    const deck = list.items[0]!;
    expect(deck.source).toEqual({
      type: 'tournament',
      name: 'Rexxar',
      event: 'Test Open 2026',
      placement: 'Winner',
      url: 'https://example.com/lineups',
      playedAt: '2026-11-01',
    });
    expect(deck.archetype).toBe('Face Hunter');
    expect(deck.authorName).toBe('Rexxar');
    expect(deck.cardCount).toBe(30);
  });

  it('exposes kind and archetype filters and the archetypes endpoint', async () => {
    const community = await read(
      await app.request(
        '/api/decks',
        json(
          {
            name: 'Mine',
            heroClass: 'HUNTER',
            format: 'STANDARD',
            cards: [],
            archetype: 'Face Hunter',
          },
          OWNER,
        ),
      ),
    );
    expect(community.deck.source).toBeNull();
    const pro = await read(await app.request('/api/decks?kind=pro'));
    expect(pro.items.every((d: { source: unknown }) => d.source !== null)).toBe(true);
    expect(pro.total).toBe(1);
    const all = await read(await app.request('/api/decks?kind=community'));
    expect(all.items.every((d: { source: unknown }) => d.source === null)).toBe(true);
    const byArchetype = await read(await app.request('/api/decks?archetype=face%20hunter'));
    expect(byArchetype.total).toBe(1); // the community deck is an unpublished draft
    const archetypes = await read(await app.request('/api/archetypes'));
    expect(archetypes.items[0]).toEqual({
      archetype: 'Face Hunter',
      count: 1,
      classes: ['HUNTER'],
    });
  });

  it('records basedOn when remixing a pro list and returns the diff', async () => {
    const base = (await read(await app.request('/api/decks?kind=pro'))).items[0];
    const baseDeck = await read(await app.request(`/api/decks/${base.id}`));
    const cardsOfBase = baseDeck.deck.cards as Array<{ dbfId: number; count: number }>;
    const variantCards = cardsOfBase.slice(1); // drop one card (2 copies)
    const variant = await read(
      await app.request(
        '/api/decks',
        json(
          {
            name: 'Remix',
            heroClass: 'HUNTER',
            format: 'STANDARD',
            cards: variantCards,
            basedOnId: base.id,
          },
          OWNER,
        ),
      ),
    );
    expect(variant.basedOn.id).toBe(base.id);
    expect(variant.diff.removed).toEqual([cardsOfBase[0]]);
    expect(variant.diff.added).toEqual([]);
    expect(variant.diff.changedCards).toBe(2);

    const bad = await app.request(
      '/api/decks',
      json(
        { name: 'Bad', heroClass: 'HUNTER', format: 'STANDARD', cards: [], basedOnId: 'nope' },
        OWNER,
      ),
    );
    expect(bad.status).toBe(400);
    const self = await app.request(`/api/decks/${variant.deck.id}`, {
      ...json({ basedOnId: variant.deck.id }, OWNER),
      method: 'PUT',
    });
    expect(self.status).toBe(400);

    // The public API cannot set a source.
    const forged = await read(
      await app.request(
        '/api/decks',
        json(
          {
            name: 'Forged',
            heroClass: 'HUNTER',
            format: 'STANDARD',
            cards: [],
            source: { type: 'tournament', name: 'x' },
          },
          OWNER,
        ),
      ),
    );
    expect(forged.deck.source).toBeNull();
  });
});
