import { Hono } from 'hono';
import { candidateListQuerySchema, candidateReviewSchema, decodeDeckstring } from '@hsdeck/shared';
import type { CardStore } from '../cards/card-store.js';
import type { DeckRepo } from '../decks/deck-repo.js';
import { importProDecks } from '../decks/pro-import.js';
import { ApiError, notFound, parseJsonBody, parseWith } from '../http/errors.js';
import { requireAdmin, type AppEnv } from '../http/viewer.js';
import type { CandidateRepo } from './candidate-repo.js';
import { collectProLists } from './collect.js';

export interface AdminRouteDeps {
  candidates: CandidateRepo;
  decks: DeckRepo;
  cards: CardStore;
  dataDir: string;
  youtubeApiKey: string;
  adminApiToken: string;
  importOwnerToken?: string;
}

export function adminRoutes(deps: AdminRouteDeps) {
  const app = new Hono<AppEnv>();

  app.get('/admin/candidates', (c) => {
    requireAdmin(c);
    const q = parseWith(candidateListQuerySchema, c.req.query(), 'query');
    return c.json({ items: deps.candidates.list(q.status, q.limit) });
  });

  app.post('/admin/candidates/:id/approve', async (c) => {
    requireAdmin(c);
    const candidate = deps.candidates.get(c.req.param('id'));
    if (!candidate) throw notFound('Candidate');
    const body = await parseJsonBody(c, candidateReviewSchema);
    if (candidate.issues.length > 0) {
      throw new ApiError(422, 'DECK_INVALID', 'This list is not importable', candidate.issues);
    }
    const decoded = decodeDeckstring(candidate.code);
    const heroClass = candidate.heroClass ?? deps.cards.heroClassFor(decoded.heroDbfId);
    if (!heroClass) throw new ApiError(422, 'DECK_INVALID', 'Unknown hero in deck code');
    const name = body.name ?? candidate.title.slice(0, 60);
    const archetype = body.archetype === undefined ? candidate.archetypeGuess : body.archetype;
    const result = importProDecks(
      [
        {
          event: candidate.source.event ?? candidate.title,
          type: candidate.source.type,
          url: candidate.source.url,
          date: candidate.source.playedAt,
          decks: [
            {
              player: candidate.source.name,
              code: candidate.code,
              name,
              ...(archetype ? { archetype } : {}),
              ...(candidate.source.url ? { url: candidate.source.url } : {}),
            },
          ],
        },
      ],
      { decks: deps.decks, cards: deps.cards, ownerToken: deps.importOwnerToken },
    );
    if (result.skipped.length > 0) {
      throw new ApiError(422, 'DECK_INVALID', result.skipped[0]!.reason);
    }
    const deck = deps.decks
      .listPublished({ kind: 'pro', q: name, sort: 'newest', limit: 1, offset: 0 })
      .items.find((d) => d.authorName === candidate.source.name);
    const updated = deps.candidates.review(candidate.id, 'approved', deck?.id ?? null);
    return c.json({ candidate: updated, deck: deck ?? null });
  });

  app.post('/admin/candidates/:id/reject', (c) => {
    requireAdmin(c);
    const candidate = deps.candidates.get(c.req.param('id'));
    if (!candidate) throw notFound('Candidate');
    return c.json({ candidate: deps.candidates.review(candidate.id, 'rejected', null) });
  });

  app.post('/admin/collect', async (c) => {
    requireAdmin(c, deps.adminApiToken);
    const result = await collectProLists({
      cards: deps.cards,
      candidates: deps.candidates,
      dataDir: deps.dataDir,
      youtubeApiKey: deps.youtubeApiKey,
    });
    return c.json(result);
  });

  return app;
}
