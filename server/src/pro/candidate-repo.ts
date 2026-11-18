import { randomBytes } from 'node:crypto';
import type { CandidateStatus, DeckSource, ProCandidate } from '@hsdeck/shared';
import type { Database } from '../db.js';

interface Row {
  id: string;
  status: CandidateStatus;
  source_json: string;
  title: string;
  code: string;
  canonical_code: string;
  hero_class: ProCandidate['heroClass'];
  format: ProCandidate['format'];
  card_count: number;
  issues_json: string;
  archetype_guess: string | null;
  deck_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface NewCandidate {
  source: DeckSource;
  title: string;
  code: string;
  canonicalCode: string;
  heroClass: ProCandidate['heroClass'];
  format: ProCandidate['format'];
  cardCount: number;
  issues: string[];
  archetypeGuess: string | null;
}

const toCandidate = (r: Row): ProCandidate => ({
  id: r.id,
  status: r.status,
  source: JSON.parse(r.source_json) as DeckSource,
  title: r.title,
  code: r.code,
  heroClass: r.hero_class,
  format: r.format,
  cardCount: r.card_count,
  issues: JSON.parse(r.issues_json) as string[],
  archetypeGuess: r.archetype_guess,
  deckId: r.deck_id,
  createdAt: r.created_at,
  reviewedAt: r.reviewed_at,
});

export class CandidateRepo {
  constructor(private readonly db: Database) {}

  /** Inserts unless the same canonical list is already known. Returns null when skipped. */
  add(input: NewCandidate): ProCandidate | null {
    const id = randomBytes(9).toString('base64url');
    const r = this.db
      .prepare(
        `INSERT OR IGNORE INTO pro_candidates
           (id, status, source_json, title, code, canonical_code, hero_class, format, card_count, issues_json, archetype_guess, created_at)
         VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        JSON.stringify(input.source),
        input.title,
        input.code,
        input.canonicalCode,
        input.heroClass,
        input.format,
        input.cardCount,
        JSON.stringify(input.issues),
        input.archetypeGuess,
        new Date().toISOString(),
      );
    return r.changes > 0 ? this.get(id) : null;
  }

  get(id: string): ProCandidate | null {
    const row = this.db.prepare('SELECT * FROM pro_candidates WHERE id = ?').get(id) as
      Row | undefined;
    return row ? toCandidate(row) : null;
  }

  list(status: CandidateStatus, limit: number): ProCandidate[] {
    const rows = this.db
      .prepare('SELECT * FROM pro_candidates WHERE status = ? ORDER BY created_at DESC LIMIT ?')
      .all(status, limit) as unknown as Row[];
    return rows.map(toCandidate);
  }

  review(
    id: string,
    status: Exclude<CandidateStatus, 'pending'>,
    deckId: string | null,
  ): ProCandidate | null {
    this.db
      .prepare('UPDATE pro_candidates SET status = ?, deck_id = ?, reviewed_at = ? WHERE id = ?')
      .run(status, deckId, new Date().toISOString(), id);
    return this.get(id);
  }
}
