import type { DeckCardEntry } from './types.js';

export interface DeckDiff {
  /** Copies present in the variant but not the base. */
  added: DeckCardEntry[];
  /** Copies present in the base but not the variant. */
  removed: DeckCardEntry[];
  /** Copies both lists share. */
  sharedCards: number;
  /** Total copies added plus removed. */
  changedCards: number;
}

function countsByCard(cards: DeckCardEntry[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of cards) m.set(c.dbfId, (m.get(c.dbfId) ?? 0) + c.count);
  return m;
}

/** Card-level difference between a base list and a variant. */
export function diffDecks(base: DeckCardEntry[], variant: DeckCardEntry[]): DeckDiff {
  const a = countsByCard(base);
  const b = countsByCard(variant);
  const added: DeckCardEntry[] = [];
  const removed: DeckCardEntry[] = [];
  let shared = 0;
  for (const dbfId of new Set([...a.keys(), ...b.keys()])) {
    const inBase = a.get(dbfId) ?? 0;
    const inVariant = b.get(dbfId) ?? 0;
    shared += Math.min(inBase, inVariant);
    if (inVariant > inBase) added.push({ dbfId, count: inVariant - inBase });
    else if (inBase > inVariant) removed.push({ dbfId, count: inBase - inVariant });
  }
  const changed = added.reduce((n, c) => n + c.count, 0) + removed.reduce((n, c) => n + c.count, 0);
  return { added, removed, sharedCards: shared, changedCards: changed };
}

/** Jaccard similarity over card copies: 1 = identical lists, 0 = nothing in common. */
export function deckSimilarity(a: DeckCardEntry[], b: DeckCardEntry[]): number {
  const ca = countsByCard(a);
  const cb = countsByCard(b);
  let intersection = 0;
  let union = 0;
  for (const dbfId of new Set([...ca.keys(), ...cb.keys()])) {
    const x = ca.get(dbfId) ?? 0;
    const y = cb.get(dbfId) ?? 0;
    intersection += Math.min(x, y);
    union += Math.max(x, y);
  }
  return union === 0 ? 1 : intersection / union;
}
