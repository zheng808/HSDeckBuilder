/** Runs the pro-list collectors once (same as POST /api/admin/collect). */
import { CardStore } from '../src/cards/card-store.js';
import { config } from '../src/config.js';
import { openDatabase } from '../src/db.js';
import { CandidateRepo } from '../src/pro/candidate-repo.js';
import { collectProLists } from '../src/pro/collect.js';

const db = openDatabase(config.dbPath);
const result = await collectProLists({
  cards: CardStore.fromDataDir(config.dataDir),
  candidates: new CandidateRepo(db),
  dataDir: config.dataDir,
  youtubeApiKey: config.youtubeApiKey,
});
console.log(
  `scanned ${result.scanned} videos, ${result.added} new candidates, ${result.skipped} already known`,
);
for (const e of result.errors) console.log(`  ${e}`);
