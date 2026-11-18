import { Hono } from 'hono';
import {
  deckCodeSchema,
  deckInputSchema,
  deckListQuerySchema,
  deckStats,
  deckUpdateSchema,
  decodeDeckstring,
  diffDecks,
  encodeDeckstring,
  validateDeck,
  type Deck,
  type DeckDiff,
  type DeckSummary,
  type ValidationResult,
} from '@hsdeck/shared';
import type { CardStore } from '../cards/card-store.js';
import { ApiError, badRequest, notFound, parseJsonBody, parseWith } from '../http/errors.js';
import { optionalOwnerHash, requireOwnerHash } from '../http/owner.js';
import { toSummary, type DeckRepo, type StoredDeck } from './deck-repo.js';

export interface DeckRouteDeps {
  decks: DeckRepo;
  cards: CardStore;
}

/** Removes keys whose value is undefined so a spread never clobbers stored fields. */
function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function publicDeck(deck: StoredDeck): Deck {
  const { ownerHash: _owner, importKey: _key, ...rest } = deck;
  return rest;
}

export function deckRoutes({ decks, cards }: DeckRouteDeps) {
  const app = new Hono();

  /** The base deck, if the viewer may see it. */
  const visibleBase = (
    deck: StoredDeck,
    viewer: string | undefined,
  ): { basedOn: DeckSummary | null; diff: DeckDiff | null } => {
    if (!deck.basedOnId) return { basedOn: null, diff: null };
    const base = decks.get(deck.basedOnId);
    if (!base || (!base.published && base.ownerHash !== viewer)) {
      return { basedOn: null, diff: null };
    }
    return { basedOn: toSummary(publicDeck(base)), diff: diffDecks(base.cards, deck.cards) };
  };

  const present = (
    deck: StoredDeck,
    viewer: string | undefined,
    isOwner: boolean,
    validation?: ValidationResult,
  ) => ({
    deck: publicDeck(deck),
    isOwner,
    deckCode: encodeDeckstring(deck),
    validation: validation ?? validateDeck(deck, cards.get, { requireComplete: deck.published }),
    stats: deckStats(deck.cards, cards.get),
    ...visibleBase(deck, viewer),
  });

  const loadOwned = (id: string, ownerHash: string): StoredDeck => {
    const deck = decks.get(id);
    if (!deck) throw notFound('Deck');
    if (deck.ownerHash !== ownerHash) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not own this deck');
    }
    return deck;
  };

  const assertLegal = (
    deck: Pick<Deck, 'heroClass' | 'format' | 'cards'>,
    requireComplete: boolean,
  ): ValidationResult => {
    const validation = validateDeck(deck, cards.get, { requireComplete });
    if (!validation.ok) {
      throw new ApiError(
        422,
        'DECK_INVALID',
        'Deck breaks the deck-building rules',
        validation.issues,
      );
    }
    return validation;
  };

  /** A base deck must exist and be published or owned by the caller. */
  const assertBaseVisible = (
    basedOnId: string | null | undefined,
    ownerHash: string,
    selfId?: string,
  ) => {
    if (!basedOnId) return;
    if (basedOnId === selfId) throw badRequest('A deck cannot be based on itself');
    const base = decks.get(basedOnId);
    if (!base || (!base.published && base.ownerHash !== ownerHash)) {
      throw badRequest(`Unknown base deck ${basedOnId}`);
    }
  };

  app.get('/decks', (c) => {
    const query = parseWith(deckListQuerySchema, c.req.query(), 'query');
    return c.json(decks.listPublished(query));
  });

  app.get('/archetypes', (c) => c.json({ items: decks.listArchetypes() }));

  app.post('/decks', async (c) => {
    const ownerHash = requireOwnerHash(c);
    const parsed = await parseJsonBody(c, deckInputSchema);
    const input = { ...parsed, cards: cards.canonicalize(parsed.cards) };
    assertBaseVisible(input.basedOnId, ownerHash);
    const validation = assertLegal(input, false);
    const deck = decks.create({ ...input, ownerHash });
    return c.json(present(deck, ownerHash, true, validation), 201);
  });

  app.get('/decks/:id', (c) => {
    const deck = decks.get(c.req.param('id'));
    if (!deck) throw notFound('Deck');
    const viewer = optionalOwnerHash(c);
    const isOwner = viewer !== undefined && viewer === deck.ownerHash;
    if (!deck.published && !isOwner) throw notFound('Deck');
    if (deck.published && !isOwner) {
      decks.incrementViews(deck.id);
      deck.views += 1;
    }
    return c.json(present(deck, viewer, isOwner));
  });

  app.put('/decks/:id', async (c) => {
    const ownerHash = requireOwnerHash(c);
    const current = loadOwned(c.req.param('id'), ownerHash);
    const patch = compact(await parseJsonBody(c, deckUpdateSchema));
    if (patch.cards) patch.cards = cards.canonicalize(patch.cards);
    if (patch.basedOnId !== undefined) assertBaseVisible(patch.basedOnId, ownerHash, current.id);
    const merged = { ...current, ...patch };
    const validation = assertLegal(merged, current.published);
    const updated = decks.update(current.id, patch)!;
    return c.json(present(updated, ownerHash, true, validation));
  });

  app.delete('/decks/:id', (c) => {
    const ownerHash = requireOwnerHash(c);
    const deck = loadOwned(c.req.param('id'), ownerHash);
    decks.delete(deck.id);
    return c.body(null, 204);
  });

  app.post('/decks/:id/publish', (c) => {
    const ownerHash = requireOwnerHash(c);
    const deck = loadOwned(c.req.param('id'), ownerHash);
    const validation = assertLegal(deck, true);
    const updated = decks.update(deck.id, { published: true })!;
    return c.json(present(updated, ownerHash, true, validation));
  });

  app.post('/decks/:id/unpublish', (c) => {
    const ownerHash = requireOwnerHash(c);
    const deck = loadOwned(c.req.param('id'), ownerHash);
    const updated = decks.update(deck.id, { published: false })!;
    return c.json(present(updated, ownerHash, true));
  });

  app.get('/my/decks', (c) => {
    const ownerHash = requireOwnerHash(c);
    return c.json({ items: decks.listByOwner(ownerHash) });
  });

  app.post('/deckcode/decode', async (c) => {
    const { code } = await parseJsonBody(c, deckCodeSchema);
    let decoded;
    try {
      decoded = decodeDeckstring(code);
    } catch (err) {
      throw badRequest(err instanceof Error ? err.message : 'Invalid deck code');
    }
    const heroClass = decoded.heroClass ?? cards.heroClassFor(decoded.heroDbfId);
    if (!heroClass) {
      throw new ApiError(422, 'DECK_INVALID', `Unknown hero ${decoded.heroDbfId} in deck code`);
    }
    const unknownDbfIds = decoded.cards
      .filter((e) => !cards.get(cards.resolveDbfId(e.dbfId)))
      .map((e) => e.dbfId);
    const known = decoded.cards.filter((e) => !unknownDbfIds.includes(e.dbfId));
    return c.json({
      format: decoded.format,
      heroClass,
      heroDbfId: decoded.heroDbfId,
      // Hidden reprints (e.g. the original print of a Core card) map to the canonical card.
      cards: cards.canonicalize(known),
      unknownDbfIds,
    });
  });

  return app;
}
