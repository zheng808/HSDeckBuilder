import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { config } from './config.js';

const { app, cards } = createApp({ serveClient: config.isProduction });

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(
    `API listening on http://localhost:${info.port} (${cards.cards.length} cards, db: ${config.dbPath})`,
  );
});
