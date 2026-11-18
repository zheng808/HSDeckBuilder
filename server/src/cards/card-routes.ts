import { Hono } from 'hono';
import { CARD_CLASSES, DECK_FORMATS, STANDARD_SETS, cardQuerySchema } from '@hsdeck/shared';
import { notFound, parseWith } from '../http/errors.js';
import type { CardStore } from './card-store.js';

export function cardRoutes(cards: CardStore) {
  const app = new Hono();

  app.get('/meta', (c) =>
    c.json({
      classes: CARD_CLASSES,
      formats: DECK_FORMATS,
      standardSets: [...STANDARD_SETS],
      cardCount: cards.cards.length,
      dataFetchedAt: cards.meta.fetchedAt,
    }),
  );

  app.get('/cards', (c) => {
    const query = parseWith(cardQuerySchema, c.req.query(), 'query');
    c.header('Cache-Control', 'public, max-age=3600');
    return c.json(cards.query(query));
  });

  app.get('/cards/:dbfId', (c) => {
    const dbfId = Number(c.req.param('dbfId'));
    const card = Number.isInteger(dbfId) ? cards.get(dbfId) : undefined;
    if (!card) throw notFound('Card');
    return c.json(card);
  });

  return app;
}
