import { randomBytes } from 'node:crypto';
import type {
  CardClass,
  Deck,
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
}

export interface StoredDeck extends Deck {
  ownerHash: string;
  importKey: string | null;
}

export interface NewDeck {
  name: string;
  heroClass: Deck['heroClass'];
  format: Deck['format'];
  cards: DeckCardEntry[];
  description: string;
  authorName: string;
  ownerHash: string;
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
    published: row.published === 1,
    views: row.views,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerHash: row.owner_hash,
    importKey: row.import_key,
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
  'id, name, hero_class, format, cards_json, description, author_name, owner_hash, published, views, created_at, updated_at, archetype, source_json, based_on_id, import_key';

export class DeckRepo {
  constructor(private readonly db: Database) {}

  create(input: NewDeck): StoredDeck {
    const now = new Date().toISOString();
    const id = newId();
    this.db
      .prepare(
        `INSERT INTO decks (${COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
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
    const where: string[] = ['published = 1'];
    const params: (string | number)[] = [];
    if (q.class) {
      where.push('hero_class = ?');
      params.push(q.class);
    }
    if (q.format) {
      where.push('format = ?');
      params.push(q.format);
    }
    if (q.kind === 'pro') where.push('source_json IS NOT NULL');
    if (q.kind === 'community') where.push('source_json IS NULL');
    if (q.archetype) {
      where.push('archetype = ? COLLATE NOCASE');
      params.push(q.archetype);
    }
    if (q.q) {
      where.push('(name LIKE ? OR author_name LIKE ? OR archetype LIKE ?)');
      const like = `%${q.q.replace(/[%_]/g, '')}%`;
      params.push(like, like, like);
    }
    const whereSql = where.join(' AND ');
    const order = q.sort === 'popular' ? 'views DESC, created_at DESC' : 'created_at DESC';
    const total = (
      this.db.prepare(`SELECT COUNT(*) AS n FROM decks WHERE ${whereSql}`).get(...params) as {
        n: number;
      }
    ).n;
    const rows = this.db
      .prepare(`SELECT * FROM decks WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(...params, q.limit, q.offset) as unknown as DeckRow[];
    return { items: rows.map((r) => toSummary(rowToDeck(r))), total };
  }

  listByOwner(ownerHash: string): DeckSummary[] {
    const rows = this.db
      .prepare('SELECT * FROM decks WHERE owner_hash = ? ORDER BY updated_at DESC')
      .all(ownerHash) as unknown as DeckRow[];
    return rows.map((r) => toSummary(rowToDeck(r)));
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
