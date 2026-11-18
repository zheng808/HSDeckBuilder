import { DECK_SIZE, DUST_COST, MAX_COPIES, MAX_LEGENDARY_COPIES, MAX_RUNES } from './constants.js';
import type { Card, CardClass, CardLookup, DeckCardEntry, DeckFormat, RuneCost } from './types.js';

export type DeckIssueCode =
  | 'TOO_FEW_CARDS'
  | 'TOO_MANY_CARDS'
  | 'UNKNOWN_CARD'
  | 'WRONG_CLASS'
  | 'NOT_STANDARD'
  | 'TOO_MANY_COPIES'
  | 'INVALID_COUNT'
  | 'RUNES_EXCEEDED'
  | 'MISSING_BUNDLE_PARENT'
  | 'INCOMPLETE_BUNDLE';

export interface DeckIssue {
  code: DeckIssueCode;
  message: string;
  /** Present when the issue concerns a specific card. */
  dbfId?: number;
}

export interface DeckShape {
  heroClass: CardClass;
  format: DeckFormat;
  cards: DeckCardEntry[];
}

export interface ValidationResult {
  /** True when there are no issues. */
  ok: boolean;
  /** True when the deck is legal but not yet 30 cards (only possible with requireComplete=false). */
  incomplete: boolean;
  cardCount: number;
  issues: DeckIssue[];
}

export interface ValidateOptions {
  /** When true (default) the deck must contain exactly 30 cards. Drafts pass false. */
  requireComplete?: boolean;
}

/** Identity used for the copy limit: Core reprints count as their original card. */
export function canonicalDbfId(card: Card): number {
  return card.countAsCopyOfDbfId ?? card.dbfId;
}

export function maxCopies(card: Card): number {
  if (card.bundledWith !== undefined) return 1;
  return card.rarity === 'LEGENDARY' ? MAX_LEGENDARY_COPIES : MAX_COPIES;
}

/** Deck slots a card occupies when added: itself plus any bundled companions. */
export function slotsNeeded(card: Card): number {
  return 1 + (card.bundledCards?.length ?? 0);
}

export function cardPlayableInClass(card: Card, heroClass: CardClass): boolean {
  if (card.classes && card.classes.length > 0) return card.classes.includes(heroClass);
  return card.cardClass === heroClass || card.cardClass === 'NEUTRAL';
}

export function cardLegalInFormat(card: Card, format: DeckFormat): boolean {
  return format === 'WILD' || card.standard;
}

export function countCards(cards: DeckCardEntry[]): number {
  return cards.reduce((sum, c) => sum + c.count, 0);
}

/** The rune commitment a set of cards demands: the per-rune maximum across cards. */
export function requiredRunes(cards: DeckCardEntry[], lookup: CardLookup): RuneCost {
  const runes: RuneCost = { blood: 0, frost: 0, unholy: 0 };
  for (const entry of cards) {
    const rc = lookup(entry.dbfId)?.runeCost;
    if (!rc) continue;
    runes.blood = Math.max(runes.blood, rc.blood);
    runes.frost = Math.max(runes.frost, rc.frost);
    runes.unholy = Math.max(runes.unholy, rc.unholy);
  }
  return runes;
}

export function totalRunes(runes: RuneCost): number {
  return runes.blood + runes.frost + runes.unholy;
}

export function validateDeck(
  deck: DeckShape,
  lookup: CardLookup,
  opts: ValidateOptions = {},
): ValidationResult {
  const requireComplete = opts.requireComplete ?? true;
  const issues: DeckIssue[] = [];
  const copiesByCanonical = new Map<number, { count: number; card: Card }>();

  for (const entry of deck.cards) {
    if (!Number.isInteger(entry.count) || entry.count < 1) {
      issues.push({
        code: 'INVALID_COUNT',
        message: `Card ${entry.dbfId} has an invalid count (${entry.count}).`,
        dbfId: entry.dbfId,
      });
      continue;
    }
    const card = lookup(entry.dbfId);
    if (!card) {
      issues.push({
        code: 'UNKNOWN_CARD',
        message: `Unknown card id ${entry.dbfId}.`,
        dbfId: entry.dbfId,
      });
      continue;
    }
    if (!cardPlayableInClass(card, deck.heroClass)) {
      issues.push({
        code: 'WRONG_CLASS',
        message: `${card.name} cannot be played in a ${deck.heroClass} deck.`,
        dbfId: card.dbfId,
      });
    }
    if (!cardLegalInFormat(card, deck.format)) {
      issues.push({
        code: 'NOT_STANDARD',
        message: `${card.name} is not legal in Standard.`,
        dbfId: card.dbfId,
      });
    }
    const key = canonicalDbfId(card);
    const prev = copiesByCanonical.get(key);
    copiesByCanonical.set(key, { count: (prev?.count ?? 0) + entry.count, card });
  }

  for (const { count, card } of copiesByCanonical.values()) {
    const limit = maxCopies(card);
    if (count > limit) {
      issues.push({
        code: 'TOO_MANY_COPIES',
        message: `${card.name}: at most ${limit} ${limit === 1 ? 'copy' : 'copies'} allowed (deck has ${count}).`,
        dbfId: card.dbfId,
      });
    }
  }

  const present = new Set(deck.cards.map((e) => e.dbfId));
  for (const entry of deck.cards) {
    const card = lookup(entry.dbfId);
    if (!card) continue;
    if (card.bundledWith !== undefined && !present.has(card.bundledWith)) {
      const parent = lookup(card.bundledWith);
      issues.push({
        code: 'MISSING_BUNDLE_PARENT',
        message: `${card.name} comes bundled with ${parent?.name ?? `card ${card.bundledWith}`}; it cannot be run on its own.`,
        dbfId: card.dbfId,
      });
    }
    const missing = (card.bundledCards ?? []).filter((id) => !present.has(id));
    if (missing.length > 0) {
      const names = missing.map((id) => lookup(id)?.name ?? `card ${id}`).join(' and ');
      issues.push({
        code: 'INCOMPLETE_BUNDLE',
        message: `${card.name} comes with ${names}; the whole bundle must be in the deck.`,
        dbfId: card.dbfId,
      });
    }
  }

  const cardCount = countCards(deck.cards);
  if (cardCount > DECK_SIZE) {
    issues.push({
      code: 'TOO_MANY_CARDS',
      message: `A deck holds ${DECK_SIZE} cards; this one has ${cardCount}.`,
    });
  }
  const incomplete = cardCount < DECK_SIZE;
  if (incomplete && requireComplete) {
    issues.push({
      code: 'TOO_FEW_CARDS',
      message: `A deck needs ${DECK_SIZE} cards; this one has ${cardCount}.`,
    });
  }

  if (deck.heroClass === 'DEATHKNIGHT') {
    const runes = requiredRunes(deck.cards, lookup);
    const total = totalRunes(runes);
    if (total > MAX_RUNES) {
      issues.push({
        code: 'RUNES_EXCEEDED',
        message: `Death Knight decks may use at most ${MAX_RUNES} runes (this deck needs ${total}: ${runes.blood} Blood, ${runes.frost} Frost, ${runes.unholy} Unholy).`,
      });
    }
  }

  return { ok: issues.length === 0, incomplete, cardCount, issues };
}

export interface AddCardResult {
  ok: boolean;
  reason?: string;
}

/** Whether one more copy of `card` may be added to the deck. */
export function canAddCard(deck: DeckShape, card: Card, lookup: CardLookup): AddCardResult {
  if (!cardPlayableInClass(card, deck.heroClass)) {
    return { ok: false, reason: `${card.name} is not a ${deck.heroClass} or neutral card.` };
  }
  if (!cardLegalInFormat(card, deck.format)) {
    return { ok: false, reason: `${card.name} is not legal in Standard.` };
  }
  if (card.bundledWith !== undefined) {
    const parent = lookup(card.bundledWith);
    return {
      ok: false,
      reason: `${card.name} comes bundled with ${parent?.name ?? 'its legendary'}; add that card instead.`,
    };
  }
  const free = DECK_SIZE - countCards(deck.cards);
  if (free <= 0) {
    return { ok: false, reason: 'The deck is full.' };
  }
  if (slotsNeeded(card) > free) {
    return {
      ok: false,
      reason: `${card.name} needs ${slotsNeeded(card)} free slots (it comes with ${(card.bundledCards ?? []).length} companions).`,
    };
  }
  const key = canonicalDbfId(card);
  let copies = 0;
  for (const entry of deck.cards) {
    const other = lookup(entry.dbfId);
    if (other && canonicalDbfId(other) === key) copies += entry.count;
  }
  if (copies >= maxCopies(card)) {
    return {
      ok: false,
      reason:
        card.rarity === 'LEGENDARY'
          ? `Only one copy of a legendary (${card.name}) is allowed.`
          : `Only ${MAX_COPIES} copies of ${card.name} are allowed.`,
    };
  }
  if (deck.heroClass === 'DEATHKNIGHT' && card.runeCost) {
    const runes = requiredRunes([...deck.cards, { dbfId: card.dbfId, count: 1 }], lookup);
    if (totalRunes(runes) > MAX_RUNES) {
      return { ok: false, reason: `${card.name} would exceed the ${MAX_RUNES}-rune limit.` };
    }
  }
  return { ok: true };
}

/** Pure helper: returns a new card list with one more copy of `dbfId`. */
export function addCardEntry(cards: DeckCardEntry[], dbfId: number): DeckCardEntry[] {
  const existing = cards.find((c) => c.dbfId === dbfId);
  if (existing) {
    return cards.map((c) => (c.dbfId === dbfId ? { ...c, count: c.count + 1 } : c));
  }
  return [...cards, { dbfId, count: 1 }];
}

/** Pure helper: returns a new card list with one fewer copy of `dbfId`. */
export function removeCardEntry(cards: DeckCardEntry[], dbfId: number): DeckCardEntry[] {
  return cards
    .map((c) => (c.dbfId === dbfId ? { ...c, count: c.count - 1 } : c))
    .filter((c) => c.count > 0);
}

/** Adds a card and, for a "Fabled" legendary, its bundled companions. */
export function addCardWithBundle(cards: DeckCardEntry[], card: Card): DeckCardEntry[] {
  let next = addCardEntry(cards, card.dbfId);
  for (const child of card.bundledCards ?? []) {
    if (!next.some((e) => e.dbfId === child)) next = addCardEntry(next, child);
  }
  return next;
}

/**
 * Removes one copy of a card. Removing a "Fabled" legendary or any of its companions
 * removes the whole bundle, as the game does.
 */
export function removeCardWithBundle(
  cards: DeckCardEntry[],
  dbfId: number,
  lookup: CardLookup,
): DeckCardEntry[] {
  const card = lookup(dbfId);
  const parentId =
    card?.bundledWith !== undefined ? card.bundledWith : card?.bundledCards?.length ? dbfId : null;
  if (parentId === null) return removeCardEntry(cards, dbfId);
  return cards.filter((e) => e.dbfId !== parentId && lookup(e.dbfId)?.bundledWith !== parentId);
}

export const MANA_CURVE_BUCKETS = 8; // 0,1,2,3,4,5,6,7+

export interface DeckStats {
  cardCount: number;
  /** Card counts by mana cost: index 0..6 exact, index 7 is 7+. */
  manaCurve: number[];
  typeCounts: Partial<Record<Card['type'], number>>;
  rarityCounts: Partial<Record<Card['rarity'], number>>;
  dustCost: number;
  averageCost: number;
  runes: RuneCost;
}

export function dustCostOf(card: Card): number {
  if (card.set === 'CORE' || card.rarity === 'FREE' || card.bundledWith !== undefined) return 0;
  return DUST_COST[card.rarity] ?? 0;
}

export function deckStats(cards: DeckCardEntry[], lookup: CardLookup): DeckStats {
  const manaCurve = new Array<number>(MANA_CURVE_BUCKETS).fill(0);
  const typeCounts: DeckStats['typeCounts'] = {};
  const rarityCounts: DeckStats['rarityCounts'] = {};
  let dustCost = 0;
  let totalCost = 0;
  let counted = 0;

  for (const entry of cards) {
    const card = lookup(entry.dbfId);
    if (!card) continue;
    const bucket = Math.min(Math.max(card.cost, 0), MANA_CURVE_BUCKETS - 1);
    manaCurve[bucket] = (manaCurve[bucket] ?? 0) + entry.count;
    typeCounts[card.type] = (typeCounts[card.type] ?? 0) + entry.count;
    rarityCounts[card.rarity] = (rarityCounts[card.rarity] ?? 0) + entry.count;
    dustCost += dustCostOf(card) * entry.count;
    totalCost += card.cost * entry.count;
    counted += entry.count;
  }

  return {
    cardCount: countCards(cards),
    manaCurve,
    typeCounts,
    rarityCounts,
    dustCost,
    averageCost: counted === 0 ? 0 : Math.round((totalCost / counted) * 100) / 100,
    runes: requiredRunes(cards, lookup),
  };
}

/** Sort entries the way the game shows them: by cost, then name. */
export function sortDeckEntries(cards: DeckCardEntry[], lookup: CardLookup): DeckCardEntry[] {
  return [...cards].sort((a, b) => {
    const ca = lookup(a.dbfId);
    const cb = lookup(b.dbfId);
    const costDiff = (ca?.cost ?? 99) - (cb?.cost ?? 99);
    if (costDiff !== 0) return costDiff;
    return (ca?.name ?? '').localeCompare(cb?.name ?? '');
  });
}
