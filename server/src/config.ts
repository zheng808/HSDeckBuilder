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
  /** Public origin used to build OAuth callback URLs, e.g. https://example.com */
  appUrl: (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  /** Secret for signing the OAuth state cookie. Required in production. */
  authSecret: process.env.AUTH_SECRET ?? 'dev-only-secret-change-me',
  oauth: {
    github:
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        ? { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }
        : null,
    google:
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
        : null,
  },
  /** "provider:login" entries that become admins on sign-in, e.g. "github:zheng808". */
  adminLogins: (process.env.ADMIN_LOGINS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  /** Machine token for POST /api/admin/collect (scheduled runs). */
  adminApiToken: process.env.ADMIN_API_TOKEN ?? '',
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? '',
};
