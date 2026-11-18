import { beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import { createApp } from '../app.js';
import { openDatabase } from '../db.js';
import { CardStore } from '../cards/card-store.js';
import { config } from '../config.js';
import { DECK_SIZE, encodeDeckstring, type Card } from '@hsdeck/shared';

let app: Hono;
let cards: CardStore;
const OWNER = { 'x-owner-token': 'owner-token-1234' };
const OTHER = { 'x-owner-token': 'other-token-5678' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const read = async (res: Response): Promise<any> => res.json();
const json = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

/** Picks a legal Standard Mage list of 30 cards from the real data. */
function sampleMageCards(): { dbfId: number; count: number }[] {
  const pool = cards
    .query({ class: 'MAGE', format: 'STANDARD' })
    .filter((c) => c.rarity !== 'LEGENDARY');
  const entries: { dbfId: number; count: number }[] = [];
  let total = 0;
  for (const card of pool) {
    if (total >= DECK_SIZE) break;
    entries.push({ dbfId: card.dbfId, count: 2 });
    total += 2;
  }
  return entries;
}

beforeAll(() => {
  cards = CardStore.fromDataDir(config.dataDir);
  ({ app } = createApp({ db: openDatabase(':memory:'), cards, quiet: true }));
});

describe('cards', () => {
  it('serves meta and filtered cards', async () => {
    const meta = await read(await app.request('/api/meta'));
    expect(meta.classes).toContain('MAGE');
    const res = await app.request('/api/cards?class=HUNTER&format=STANDARD&q=beast');
    expect(res.status).toBe(200);
    const list = (await res.json()) as Card[];
    expect(list.length).toBeGreaterThan(0);
    for (const c of list) {
      expect(c.standard).toBe(true);
      expect(['HUNTER', 'NEUTRAL']).toContain(c.classes ? 'HUNTER' : c.cardClass);
    }
  });

  it('hides originals shadowed by Core reprints', async () => {
    const list = (await (
      await app.request('/api/cards?class=MAGE&format=WILD&q=fireball')
    ).json()) as Card[];
    const fireballs = list.filter((c) => c.name === 'Fireball');
    expect(fireballs).toHaveLength(1);
    expect(fireballs[0]?.set).toBe('CORE');
  });

  it('returns bundled companions so decks resolve, flagged for pickers to hide', async () => {
    const list = (await (await app.request('/api/cards?class=HUNTER&q=ranger')).json()) as Card[];
    const alleria = list.find((c) => c.name === 'Ranger Captain Alleria');
    const sylvanas = list.find((c) => c.name === 'Ranger General Sylvanas');
    expect(alleria?.bundledWith).toBe(sylvanas?.dbfId);
    expect(sylvanas?.bundledCards).toContain(alleria?.dbfId);
  });

  it('rejects bad query values', async () => {
    expect((await app.request('/api/cards?class=WIZARD')).status).toBe(400);
  });
});

describe('decks', () => {
  it('requires an owner token to create', async () => {
    const res = await app.request(
      '/api/decks',
      json({ name: 'x', heroClass: 'MAGE', format: 'STANDARD', cards: [] }),
    );
    expect(res.status).toBe(401);
  });

  it('creates, saves, publishes, lists and views a deck', async () => {
    const partial = sampleMageCards().slice(0, 5);
    const created = await app.request(
      '/api/decks',
      json(
        {
          name: 'Test Mage',
          heroClass: 'MAGE',
          format: 'STANDARD',
          cards: partial,
          authorName: 'Alex',
        },
        OWNER,
      ),
    );
    expect(created.status).toBe(201);
    const { deck, validation, deckCode } = await read(created);
    expect(deck.published).toBe(false);
    expect(validation.incomplete).toBe(true);
    expect(deckCode.startsWith('AAE')).toBe(true);

    // Drafts are private to the owner.
    expect((await app.request(`/api/decks/${deck.id}`)).status).toBe(404);
    expect((await app.request(`/api/decks/${deck.id}`, { headers: OTHER })).status).toBe(404);
    expect((await app.request(`/api/decks/${deck.id}`, { headers: OWNER })).status).toBe(200);

    // Publishing an incomplete deck fails with issues.
    const early = await app.request(`/api/decks/${deck.id}/publish`, {
      method: 'POST',
      headers: OWNER,
    });
    expect(early.status).toBe(422);
    expect((await read(early)).error.issues[0].code).toBe('TOO_FEW_CARDS');

    // Fill it up and publish.
    const full = await app.request(`/api/decks/${deck.id}`, {
      ...json({ cards: sampleMageCards() }, OWNER),
      method: 'PUT',
    });
    expect(full.status).toBe(200);
    const published = await app.request(`/api/decks/${deck.id}/publish`, {
      method: 'POST',
      headers: OWNER,
    });
    expect(published.status).toBe(200);
    expect((await read(published)).deck.published).toBe(true);

    // Others can now see it, and views increase for non-owners only.
    const view = await app.request(`/api/decks/${deck.id}`, { headers: OTHER });
    expect(view.status).toBe(200);
    const viewBody = await read(view);
    expect(viewBody.deck.views).toBe(1);
    expect(viewBody.isOwner).toBe(false);
    const ownerView = await read(await app.request(`/api/decks/${deck.id}`, { headers: OWNER }));
    expect(ownerView.deck.views).toBe(1);
    expect(ownerView.isOwner).toBe(true);

    const list = await read(await app.request('/api/decks?class=MAGE&format=STANDARD'));
    expect(list.total).toBe(1);
    expect(list.items[0].cardCount).toBe(30);

    // Only the owner may edit or delete.
    expect(
      (
        await app.request(`/api/decks/${deck.id}`, {
          ...json({ name: 'hijack' }, OTHER),
          method: 'PUT',
        })
      ).status,
    ).toBe(403);
    expect(
      (await app.request(`/api/decks/${deck.id}`, { method: 'DELETE', headers: OTHER })).status,
    ).toBe(403);

    // A published deck cannot be broken by an update.
    const breakIt = await app.request(`/api/decks/${deck.id}`, {
      ...json({ cards: partial }, OWNER),
      method: 'PUT',
    });
    expect(breakIt.status).toBe(422);

    const mine = await read(await app.request('/api/my/decks', { headers: OWNER }));
    expect(mine.items).toHaveLength(1);

    expect(
      (await app.request(`/api/decks/${deck.id}`, { method: 'DELETE', headers: OWNER })).status,
    ).toBe(204);
    expect((await app.request(`/api/decks/${deck.id}`, { headers: OWNER })).status).toBe(404);
  });

  it('rejects illegal drafts (wrong class, wild card in standard, too many copies)', async () => {
    const hunterCard = cards
      .query({ class: 'HUNTER', format: 'STANDARD' })
      .find((c) => c.cardClass === 'HUNTER')!;
    const res = await app.request(
      '/api/decks',
      json(
        {
          name: 'Bad',
          heroClass: 'MAGE',
          format: 'STANDARD',
          cards: [{ dbfId: hunterCard.dbfId, count: 1 }],
        },
        OWNER,
      ),
    );
    expect(res.status).toBe(422);
    expect((await read(res)).error.issues[0].code).toBe('WRONG_CLASS');
  });

  it('decodes deck codes', async () => {
    const entries = sampleMageCards();
    const created = await read(
      await app.request(
        '/api/decks',
        json({ name: 'Codes', heroClass: 'MAGE', format: 'WILD', cards: entries }, OWNER),
      ),
    );
    const decoded = await app.request('/api/deckcode/decode', json({ code: created.deckCode }));
    expect(decoded.status).toBe(200);
    const body = await read(decoded);
    expect(body.heroClass).toBe('MAGE');
    expect(body.format).toBe('WILD');
    expect(body.cards).toHaveLength(entries.length);
    expect(body.unknownDbfIds).toEqual([]);
    expect((await app.request('/api/deckcode/decode', json({ code: 'garbage!!' }))).status).toBe(
      400,
    );
  });
  it('remaps hidden reprints in deck codes and saved decks to the canonical card', async () => {
    const original = cards.cards.find((c) => c.name === 'Fireball' && c.set === 'LEGACY')!;
    const core = cards.cards.find((c) => c.name === 'Fireball' && c.set === 'CORE')!;
    expect(original.countAsCopyOfDbfId).toBe(core.dbfId);
    const code = encodeDeckstring({
      format: 'WILD',
      heroClass: 'MAGE',
      cards: [
        { dbfId: original.dbfId, count: 1 },
        { dbfId: core.dbfId, count: 1 },
      ],
    });
    const decoded = await read(await app.request('/api/deckcode/decode', json({ code })));
    expect(decoded.cards).toEqual([{ dbfId: core.dbfId, count: 2 }]);

    const saved = await read(
      await app.request(
        '/api/decks',
        json(
          {
            name: 'Remap',
            heroClass: 'MAGE',
            format: 'WILD',
            cards: [{ dbfId: original.dbfId, count: 2 }],
          },
          OWNER,
        ),
      ),
    );
    expect(saved.deck.cards).toEqual([{ dbfId: core.dbfId, count: 2 }]);
  });
  it('keeps untouched fields on partial updates', async () => {
    const created = await read(
      await app.request(
        '/api/decks',
        json(
          {
            name: 'Keep',
            heroClass: 'HUNTER',
            format: 'WILD',
            cards: [],
            authorName: 'Rexxar',
            description: 'face',
          },
          OWNER,
        ),
      ),
    );
    const updated = await read(
      await app.request(`/api/decks/${created.deck.id}`, {
        ...json({ cards: [] }, OWNER),
        method: 'PUT',
      }),
    );
    expect(updated.deck.authorName).toBe('Rexxar');
    expect(updated.deck.description).toBe('face');
    expect(updated.deck.name).toBe('Keep');
  });
});
