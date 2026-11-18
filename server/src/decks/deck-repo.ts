import { randomBytes } from 'node:crypto';
import type {
  CardClass,
  Deck,
  DeckAuthor,
  DeckCardEntry,
  DeckListQuery,
  DeckSource,
  DeckSummary,
} from '@hsdeck/shared';
import { countCards } from '@hsdeck/shared';
import type { Database } from '../db.js';

interface DeckRow {
  id: string;
  name: string;
  hero_class: Deck['heroClass'];
  format: Deck['format'];
  cards_json: string;
  description: string;
  author_name: string;
  owner_hash: string;
  published: number;
  views: number;
  created_at: string;
  updated_at: string;
  archetype: string | null;
  source_json: string | null;
  based_on_id: string | null;
  import_key: string | null;
  user_id: string | null;
  likes: number;
  // joined from users
  author_user_name: string | null;
  author_avatar_url: string | null;
}

export interface StoredDeck extends Deck {
  ownerHash: string;
  importKey: string | null;
  /** Account owner id; null for token-owned decks. */
  userId: string | null;
}

/** Who may edit a deck: its account owner, or the anonymous token when it has none. */
export function ownsDeck(
  deck: StoredDeck,
  viewer: { user: { id: string } | null; ownerHash: string | undefined },
): boolean {
  if (deck.userId) return viewer.user?.id === deck.userId;
  return viewer.ownerHash !== undefined && viewer.ownerHash === deck.ownerHash;
}

export interface NewDeck {
  name: string;
  heroClass: Deck['heroClass'];
  format: Deck['format'];
  cards: DeckCardEntry[];
  description: string;
  authorName: string;
  ownerHash: string;
  userId?: string | null;
  archetype?: string | null;
  basedOnId?: string | null;
  /** Importer only. */
  source?: DeckSource | null;
  importKey?: string | null;
  published?: boolean;
}

export type DeckPatch = Partial<
  Pick<
    NewDeck,
    | 'name'
    | 'heroClass'
    | 'format'
    | 'cards'
    | 'description'
    | 'authorName'
    | 'archetype'
    | 'basedOnId'
    | 'source'
    | 'published'
  >
>;

export interface ArchetypeCount {
  archetype: string;
  count: number;
  classes: CardClass[];
}

function rowToDeck(row: DeckRow): StoredDeck {
  const author: DeckAuthor | null = row.user_id
    ? {
        id: row.user_id,
        name: row.author_user_name ?? row.author_name,
        avatarUrl: row.author_avatar_url,
      }
    : null;
  return {
    id: row.id,
    name: row.name,
    heroClass: row.hero_class,
    format: row.format,
    cards: JSON.parse(row.cards_json) as DeckCardEntry[],
    description: row.description,
    authorName: row.author_name,
    archetype: row.archetype,
    source: row.source_json ? (JSON.parse(row.source_json) as DeckSource) : null,
    basedOnId: row.based_on_id,
    author,
    likes: row.likes,
    published: row.published === 1,
    views: row.views,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerHash: row.owner_hash,
    importKey: row.import_key,
    userId: row.user_id,
  };
}

export function toSummary(deck: Deck): DeckSummary {
  return {
    id: deck.id,
    name: deck.name,
    heroClass: deck.heroClass,
    format: deck.format,
    authorName: deck.authorName,
    archetype: deck.archetype,
    source: deck.source,
    basedOnId: deck.basedOnId,
    author: deck.author,
    likes: deck.likes,
    published: deck.published,
    views: deck.views,
    cardCount: countCards(deck.cards),
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
  };
}

/** Short, URL-safe id (base64url, 12 chars). */
function newId(): string {
  return randomBytes(9).toString('base64url');
}

const COLS =
  'id, name, hero_class, format, cards_json, description, author_name, owner_hash, published, views, created_at, updated_at, archetype, source_json, based_on_id, import_key, user_id';

/** Deck rows joined with their account owner (if any). */
const SELECT =
  'SELECT d.*, u.name AS author_user_name, u.avatar_url AS author_avatar_url FROM decks d LEFT JOIN users u ON u.id = d.user_id';

export class DeckRepo {
  constructor(private readonly db: Database) {}

  create(input: NewDeck): StoredDeck {
    const now = new Date().toISOString();
    const id = newId();
    this.db
      .prepare(
        `INSERT INTO decks (${COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.heroClass,
        input.format,
        JSON.stringify(input.cards),
        input.description,
        input.authorName,
        input.ownerHash,
        input.published ? 1 : 0,
        now,
        now,
        input.archetype ?? null,
        input.source ? JSON.stringify(input.source) : null,
        input.basedOnId ?? null,
        input.importKey ?? null,
        input.userId ?? null,
      );
    return this.get(id)!;
  }

  get(id: string): StoredDeck | undefined {
    const row = this.db.prepare('SELECT * FROM decks WHERE id = ?').get(id) as DeckRow | undefined;
    return row ? rowToDeck(row) : undefined;
  }

  getByImportKey(importKey: string): StoredDeck | undefined {
    const row = this.db.prepare('SELECT * FROM decks WHERE import_key = ?').get(importKey) as
      DeckRow | undefined;
    return row ? rowToDeck(row) : undefined;
  }

  update(id: string, patch: DeckPatch): StoredDeck | undefined {
    const current = this.get(id);
    if (!current) return undefined;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.db
      .prepare(
        `UPDATE decks SET name = ?, hero_class = ?, format = ?, cards_json = ?, description = ?, author_name = ?,
           published = ?, updated_at = ?, archetype = ?, source_json = ?, based_on_id = ?
         WHERE id = ?`,
      )
      .run(
        next.name,
        next.heroClass,
        next.format,
        JSON.stringify(next.cards),
        next.description,
        next.authorName,
        next.published ? 1 : 0,
        next.updatedAt,
        next.archetype ?? null,
        next.source ? JSON.stringify(next.source) : null,
        next.basedOnId ?? null,
        id,
      );
    return this.get(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM decks WHERE id = ?').run(id);
    return result.changes > 0;
  }

  incrementViews(id: string): void {
    this.db.prepare('UPDATE decks SET views = views + 1 WHERE id = ?').run(id);
  }

  listPublished(q: DeckListQuery): { items: DeckSummary[]; total: number } {
    const where: string[] = ['d.published = 1'];
    const params: (string | number)[] = [];
    if (q.class) {
      where.push('d.hero_class = ?');
      params.push(q.class);
    }
    if (q.author) {
      where.push('d.user_id = ?');
      params.push(q.author);
    }
    if (q.format) {
      where.push('d.format = ?');
      params.push(q.format);
    }
    if (q.kind === 'pro') where.push('d.source_json IS NOT NULL');
    if (q.kind === 'community') where.push('d.source_json IS NULL');
    if (q.archetype) {
      where.push('d.archetype = ? COLLATE NOCASE');
      params.push(q.archetype);
    }
    if (q.q) {
      where.push('(d.name LIKE ? OR d.author_name LIKE ? OR d.archetype LIKE ?)');
      const like = `%${q.q.replace(/[%_]/g, '')}%`;
      params.push(like, like, like);
    }
    const whereSql = where.join(' AND ');
    const order =
      q.sort === 'popular'
        ? 'd.views DESC, d.created_at DESC'
        : q.sort === 'liked'
          ? 'd.likes DESC, d.created_at DESC'
          : 'd.created_at DESC';
    const total = (
      this.db.prepare(`SELECT COUNT(*) AS n FROM decks d WHERE ${whereSql}`).get(...params) as {
        n: number;
      }
    ).n;
    const rows = this.db
      .prepare(`${SELECT} WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(...params, q.limit, q.offset) as unknown as DeckRow[];
    return { items: rows.map((r) => toSummary(rowToDeck(r))), total };
  }

  /** Decks of a signed-in user plus any still tied to the anonymous token. */
  listMine(viewer: { user: { id: string } | null; ownerHash: string | undefined }): DeckSummary[] {
    const where: string[] = [];
    const params: string[] = [];
    if (viewer.user) {
      where.push('d.user_id = ?');
      params.push(viewer.user.id);
    }
    if (viewer.ownerHash) {
      where.push('(d.user_id IS NULL AND d.owner_hash = ?)');
      params.push(viewer.ownerHash);
    }
    if (where.length === 0) return [];
    const rows = this.db
      .prepare(`${SELECT} WHERE ${where.join(' OR ')} ORDER BY d.updated_at DESC`)
      .all(...params) as unknown as DeckRow[];
    return rows.map((r) => toSummary(rowToDeck(r)));
  }

  hasLiked(deckId: string, userId: string): boolean {
    return (
      this.db
        .prepare('SELECT 1 AS x FROM deck_likes WHERE deck_id = ? AND user_id = ?')
        .get(deckId, userId) !== undefined
    );
  }

  /** Idempotent like/unlike; returns the new count. */
  setLike(deckId: string, userId: string, liked: boolean): number {
    if (liked) {
      const r = this.db
        .prepare('INSERT OR IGNORE INTO deck_likes (deck_id, user_id, created_at) VALUES (?, ?, ?)')
        .run(deckId, userId, new Date().toISOString());
      if (r.changes > 0)
        this.db.prepare('UPDATE decks SET likes = likes + 1 WHERE id = ?').run(deckId);
    } else {
      const r = this.db
        .prepare('DELETE FROM deck_likes WHERE deck_id = ? AND user_id = ?')
        .run(deckId, userId);
      if (r.changes > 0) {
        this.db.prepare('UPDATE decks SET likes = MAX(likes - 1, 0) WHERE id = ?').run(deckId);
      }
    }
    return (
      this.db.prepare('SELECT likes FROM decks WHERE id = ?').get(deckId) as { likes: number }
    ).likes;
  }

  /** Archetypes used by published decks, most common first. */
  listArchetypes(limit = 100): ArchetypeCount[] {
    const rows = this.db
      .prepare(
        `SELECT archetype, COUNT(*) AS n, GROUP_CONCAT(DISTINCT hero_class) AS classes
         FROM decks WHERE published = 1 AND archetype IS NOT NULL AND archetype <> ''
         GROUP BY archetype COLLATE NOCASE ORDER BY n DESC, archetype ASC LIMIT ?`,
      )
      .all(limit) as unknown as Array<{ archetype: string; n: number; classes: string }>;
    return rows.map((r) => ({
      archetype: r.archetype,
      count: r.n,
      classes: r.classes.split(',') as CardClass[],
    }));
  }
}
