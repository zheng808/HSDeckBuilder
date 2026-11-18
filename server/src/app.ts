import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { cardRoutes } from './cards/card-routes.js';
import { CardStore } from './cards/card-store.js';
import { config } from './config.js';
import { openDatabase, type Database } from './db.js';
import { DeckRepo } from './decks/deck-repo.js';
import { deckRoutes } from './decks/deck-routes.js';
import { ApiError } from './http/errors.js';

export interface AppOptions {
  db?: Database;
  cards?: CardStore;
  /** Serve the built client from client/dist (production). */
  serveClient?: boolean;
  quiet?: boolean;
}

export function createApp(opts: AppOptions = {}) {
  const db = opts.db ?? openDatabase(config.dbPath);
  const cards = opts.cards ?? CardStore.fromDataDir(config.dataDir);
  const decks = new DeckRepo(db);

  const app = new Hono();
  if (!opts.quiet) app.use(logger());
  app.use(
    '/api/*',
    cors({
      origin: config.corsOrigins,
      allowHeaders: ['Content-Type', 'x-owner-token'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );

  app.get('/api/health', (c) => c.json({ ok: true, cards: cards.cards.length }));
  app.route('/api', cardRoutes(cards));
  app.route('/api', deckRoutes({ decks, cards }));

  app.notFound((c) =>
    c.json(
      { error: { code: 'NOT_FOUND', message: `No route for ${c.req.method} ${c.req.path}` } },
      404,
    ),
  );

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json(err.toBody(), err.status);
    if (err instanceof HTTPException) {
      return c.json({ error: { code: 'HTTP_ERROR', message: err.message } }, err.status);
    }
    console.error(err);
    return c.json({ error: { code: 'INTERNAL', message: 'Internal server error' } }, 500);
  });

  if (opts.serveClient && existsSync(config.clientDist)) {
    const root = path.relative(process.cwd(), config.clientDist);
    app.use('/*', serveStatic({ root }));
    app.get('/*', serveStatic({ root, path: 'index.html' }));
  }

  return { app, db, cards, decks };
}
