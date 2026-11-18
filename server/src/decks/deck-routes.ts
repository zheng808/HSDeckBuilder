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
import { requireUser, requireWriter, type AppEnv, type Viewer } from '../http/viewer.js';
import { ownsDeck, toSummary, type DeckRepo, type StoredDeck } from './deck-repo.js';

export interface DeckRouteDeps {
  decks: DeckRepo;
  cards: CardStore;
}

/** Removes keys whose value is undefined so a spread never clobbers stored fields. */
function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function publicDeck(deck: StoredDeck): Deck {
  const { ownerHash: _owner, importKey: _key, userId: _uid, ...rest } = deck;
  return rest;
}

export function deckRoutes({ decks, cards }: DeckRouteDeps) {
  const app = new Hono<AppEnv>();

  const canSee = (deck: StoredDeck, viewer: Viewer) => deck.published || ownsDeck(deck, viewer);

  /** The base deck, if the viewer may see it. */
  const visibleBase = (
    deck: StoredDeck,
    viewer: Viewer,
  ): { basedOn: DeckSummary | null; diff: DeckDiff | null } => {
    if (!deck.basedOnId) return { basedOn: null, diff: null };
    const base = decks.get(deck.basedOnId);
    if (!base || !canSee(base, viewer)) return { basedOn: null, diff: null };
    return { basedOn: toSummary(publicDeck(base)), diff: diffDecks(base.cards, deck.cards) };
  };

  const present = (deck: StoredDeck, viewer: Viewer, validation?: ValidationResult) => ({
    deck: publicDeck(deck),
    isOwner: ownsDeck(deck, viewer),
    liked: viewer.user ? decks.hasLiked(deck.id, viewer.user.id) : false,
    deckCode: encodeDeckstring(deck),
    validation: validation ?? validateDeck(deck, cards.get, { requireComplete: deck.published }),
    stats: deckStats(deck.cards, cards.get),
    ...visibleBase(deck, viewer),
  });

  const loadOwned = (id: string, viewer: Viewer): StoredDeck => {
    const deck = decks.get(id);
    if (!deck) throw notFound('Deck');
    if (!ownsDeck(deck, viewer)) {
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
    viewer: Viewer,
    selfId?: string,
  ) => {
    if (!basedOnId) return;
    if (basedOnId === selfId) throw badRequest('A deck cannot be based on itself');
    const base = decks.get(basedOnId);
    if (!base || !canSee(base, viewer)) throw badRequest(`Unknown base deck ${basedOnId}`);
  };

  app.get('/decks', (c) => {
    const query = parseWith(deckListQuerySchema, c.req.query(), 'query');
    return c.json(decks.listPublished(query));
  });

  app.get('/archetypes', (c) => c.json({ items: decks.listArchetypes() }));

  app.post('/decks', async (c) => {
    const viewer = requireWriter(c);
    const parsed = await parseJsonBody(c, deckInputSchema);
    const input = { ...parsed, cards: cards.canonicalize(parsed.cards) };
    assertBaseVisible(input.basedOnId, viewer);
    const validation = assertLegal(input, false);
    const deck = decks.create({
      ...input,
      // Signed-in users own by account; the token (or a placeholder) fills the legacy column.
      ownerHash: viewer.ownerHash ?? `user:${viewer.user!.id}`,
      userId: viewer.user?.id ?? null,
      authorName:
        viewer.user && parsed.authorName === 'Anonymous' ? viewer.user.name : input.authorName,
    });
    return c.json(present(deck, viewer, validation), 201);
  });

  app.get('/decks/:id', (c) => {
    const deck = decks.get(c.req.param('id'));
    if (!deck) throw notFound('Deck');
    const viewer = c.get('viewer');
    const isOwner = ownsDeck(deck, viewer);
    if (!deck.published && !isOwner) throw notFound('Deck');
    if (deck.published && !isOwner) {
      decks.incrementViews(deck.id);
      deck.views += 1;
    }
    return c.json(present(deck, viewer));
  });

  app.put('/decks/:id', async (c) => {
    const viewer = requireWriter(c);
    const current = loadOwned(c.req.param('id'), viewer);
    const patch = compact(await parseJsonBody(c, deckUpdateSchema));
    if (patch.cards) patch.cards = cards.canonicalize(patch.cards);
    if (patch.basedOnId !== undefined) assertBaseVisible(patch.basedOnId, viewer, current.id);
    const merged = { ...current, ...patch };
    const validation = assertLegal(merged, current.published);
    const updated = decks.update(current.id, patch)!;
    return c.json(present(updated, viewer, validation));
  });

  app.delete('/decks/:id', (c) => {
    const viewer = requireWriter(c);
    const deck = loadOwned(c.req.param('id'), viewer);
    decks.delete(deck.id);
    return c.body(null, 204);
  });

  app.post('/decks/:id/publish', (c) => {
    const viewer = requireWriter(c);
    const deck = loadOwned(c.req.param('id'), viewer);
    const validation = assertLegal(deck, true);
    const updated = decks.update(deck.id, { published: true })!;
    return c.json(present(updated, viewer, validation));
  });

  app.post('/decks/:id/unpublish', (c) => {
    const viewer = requireWriter(c);
    const deck = loadOwned(c.req.param('id'), viewer);
    const updated = decks.update(deck.id, { published: false })!;
    return c.json(present(updated, viewer));
  });

  app.put('/decks/:id/like', (c) => {
    const user = requireUser(c);
    const deck = decks.get(c.req.param('id'));
    if (!deck || !deck.published) throw notFound('Deck');
    return c.json({ likes: decks.setLike(deck.id, user.id, true), liked: true });
  });

  app.delete('/decks/:id/like', (c) => {
    const user = requireUser(c);
    const deck = decks.get(c.req.param('id'));
    if (!deck) throw notFound('Deck');
    return c.json({ likes: decks.setLike(deck.id, user.id, false), liked: false });
  });

  app.get('/my/decks', (c) => {
    const viewer = requireWriter(c);
    return c.json({ items: decks.listMine(viewer) });
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
