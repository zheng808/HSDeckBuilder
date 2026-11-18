import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.PORT ?? 3001),
  isProduction: process.env.NODE_ENV === 'production',
  /** SQLite file. ":memory:" gives an ephemeral database (used by tests). */
  dbPath: process.env.DB_PATH ?? path.join(serverRoot, 'decks.db'),
  dataDir: path.join(serverRoot, 'data'),
  clientDist: path.resolve(serverRoot, '../client/dist'),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
