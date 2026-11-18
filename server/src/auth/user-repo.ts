import { createHash, randomBytes } from 'node:crypto';
import type { AuthProvider, User } from '@hsdeck/shared';
import type { Database } from '../db.js';

export interface StoredUser extends User {
  provider: AuthProvider;
  providerId: string;
  login: string;
}

interface UserRow {
  id: string;
  provider: AuthProvider;
  provider_id: string;
  login: string;
  name: string;
  avatar_url: string | null;
  is_admin: number;
  created_at: string;
}

export interface OAuthIdentity {
  provider: AuthProvider;
  providerId: string;
  login: string;
  name: string;
  avatarUrl: string | null;
}

const SESSION_DAYS = 30;

const rowToUser = (r: UserRow): StoredUser => ({
  id: r.id,
  provider: r.provider,
  providerId: r.provider_id,
  login: r.login,
  name: r.name,
  avatarUrl: r.avatar_url,
  isAdmin: r.is_admin === 1,
  createdAt: r.created_at,
});

export const publicUser = (u: StoredUser): User => ({
  id: u.id,
  name: u.name,
  avatarUrl: u.avatarUrl,
  isAdmin: u.isAdmin,
  createdAt: u.createdAt,
});

const hashSessionId = (id: string) => createHash('sha256').update(id).digest('hex');

export class UserRepo {
  constructor(
    private readonly db: Database,
    private readonly adminLogins: string[] = [],
  ) {}

  /** Creates or refreshes the user for an OAuth identity. */
  upsertFromOAuth(identity: OAuthIdentity): StoredUser {
    const isAdmin = this.adminLogins.includes(
      `${identity.provider}:${identity.login}`.toLowerCase(),
    );
    const existing = this.db
      .prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?')
      .get(identity.provider, identity.providerId) as UserRow | undefined;
    if (existing) {
      this.db
        .prepare('UPDATE users SET login = ?, name = ?, avatar_url = ?, is_admin = ? WHERE id = ?')
        .run(identity.login, identity.name, identity.avatarUrl, isAdmin ? 1 : 0, existing.id);
      return this.get(existing.id)!;
    }
    const id = randomBytes(9).toString('base64url');
    this.db
      .prepare(
        'INSERT INTO users (id, provider, provider_id, login, name, avatar_url, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        identity.provider,
        identity.providerId,
        identity.login,
        identity.name,
        identity.avatarUrl,
        isAdmin ? 1 : 0,
        new Date().toISOString(),
      );
    return this.get(id)!;
  }

  get(id: string): StoredUser | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? rowToUser(row) : undefined;
  }

  /** Returns the raw session id to put in the cookie. Only its hash is stored. */
  createSession(userId: string): { id: string; expiresAt: string } {
    const id = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
    this.db
      .prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(hashSessionId(id), userId, expiresAt, new Date().toISOString());
    return { id, expiresAt };
  }

  userForSession(sessionId: string): StoredUser | undefined {
    const row = this.db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.expires_at > ?`,
      )
      .get(hashSessionId(sessionId), new Date().toISOString()) as UserRow | undefined;
    return row ? rowToUser(row) : undefined;
  }

  deleteSession(sessionId: string): void {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(hashSessionId(sessionId));
  }

  /** Moves every deck owned by an anonymous token to the user. Returns how many. */
  claimDecks(userId: string, ownerHash: string): number {
    const r = this.db
      .prepare('UPDATE decks SET user_id = ? WHERE user_id IS NULL AND owner_hash = ?')
      .run(userId, ownerHash);
    return Number(r.changes);
  }
}
