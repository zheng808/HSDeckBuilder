import { DatabaseSync } from 'node:sqlite';

export type Database = DatabaseSync;

const CREATE: string[] = [
  `CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    hero_class TEXT NOT NULL,
    format TEXT NOT NULL,
    cards_json TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    author_name TEXT NOT NULL,
    owner_hash TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 0,
    views INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_decks_published_created ON decks (published, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_decks_owner ON decks (owner_hash)`,
];

/** Columns added after the first release; applied with ALTER TABLE when missing. */
const COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'archetype', ddl: 'archetype TEXT' },
  { name: 'source_json', ddl: 'source_json TEXT' },
  { name: 'based_on_id', ddl: 'based_on_id TEXT' },
  { name: 'import_key', ddl: 'import_key TEXT' },
];

const AFTER: string[] = [
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_decks_import_key ON decks (import_key) WHERE import_key IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_decks_archetype ON decks (archetype)`,
];

export function openDatabase(filePath: string): Database {
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  for (const sql of CREATE) db.exec(sql);
  const existing = new Set(
    (db.prepare('PRAGMA table_info(decks)').all() as Array<{ name: string }>).map((c) => c.name),
  );
  for (const col of COLUMNS) {
    if (!existing.has(col.name)) db.exec(`ALTER TABLE decks ADD COLUMN ${col.ddl}`);
  }
  for (const sql of AFTER) db.exec(sql);
  return db;
}
