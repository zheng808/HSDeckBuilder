/**
 * Imports pro / tournament lists from server/data/pro-decks.json into the deck DB.
 *
 *   npm run import:pro-decks                 # uses DB_PATH (default server/decks.db)
 *   npm run import:pro-decks -- --file x.json
 *
 * Idempotent. The decks are owned by IMPORT_OWNER_TOKEN (default "system-pro-import");
 * use that token in the x-owner-token header to edit or unpublish them.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CardStore } from '../src/cards/card-store.js';
import { config } from '../src/config.js';
import { openDatabase } from '../src/db.js';
import { DeckRepo } from '../src/decks/deck-repo.js';
import { DEFAULT_IMPORT_OWNER_TOKEN, importProDecks } from '../src/decks/pro-import.js';

const fileIdx = process.argv.indexOf('--file');
const file =
  fileIdx !== -1 && process.argv[fileIdx + 1]
    ? path.resolve(process.argv[fileIdx + 1]!)
    : path.join(config.dataDir, 'pro-decks.json');

const raw = JSON.parse(await readFile(file, 'utf8')) as unknown;
const db = openDatabase(config.dbPath);
const result = importProDecks(raw, {
  decks: new DeckRepo(db),
  cards: CardStore.fromDataDir(config.dataDir),
  ownerToken: process.env.IMPORT_OWNER_TOKEN ?? DEFAULT_IMPORT_OWNER_TOKEN,
});
console.log(
  `Imported from ${file} into ${config.dbPath}: ${result.created} created, ${result.updated} updated, ${result.skipped.length} skipped`,
);
for (const s of result.skipped) console.log(`  skipped ${s.event} / ${s.player}: ${s.reason}`);
process.exitCode = result.skipped.length > 0 && result.created + result.updated === 0 ? 1 : 0;
