import { describe, expect, it } from 'vitest';
import {
  canAddCard,
  deckStats,
  validateDeck,
  addCardEntry,
  removeCardEntry,
} from '../deck-rules.js';
import {
  CORE_FIREBALL,
  DK_BLOOD,
  DK_FROST,
  FIREBALL,
  RAGNAROS,
  TRACKING,
  TRI_CLASS,
  WILD_ONLY,
  WISP,
  card,
  lookup,
} from './fixtures.js';

const mageDeck = (
  cards: { dbfId: number; count: number }[],
  format: 'STANDARD' | 'WILD' = 'STANDARD',
) => ({
  heroClass: 'MAGE' as const,
  format,
  cards,
});

describe('validateDeck', () => {
  it('accepts a full legal deck', () => {
    // 13 distinct filler cards x2 + 2x Core Fireball + Ragnaros + 1 filler = 30
    const filler = (id: number) => card({ dbfId: id, name: `Filler ${id}` });
    const lookupWithFiller = (id: number) => (id >= 10000 ? filler(id) : lookup(id));
    const cards = [
      ...Array.from({ length: 13 }, (_, i) => ({ dbfId: 10000 + i, count: 2 })),
      { dbfId: 10013, count: 1 },
      { dbfId: CORE_FIREBALL.dbfId, count: 2 },
      { dbfId: RAGNAROS.dbfId, count: 1 },
    ];
    const result = validateDeck(mageDeck(cards), lookupWithFiller);
    expect(result.cardCount).toBe(30);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.incomplete).toBe(false);
  });

  it('flags incomplete decks only when completeness is required', () => {
    const deck = mageDeck([{ dbfId: CORE_FIREBALL.dbfId, count: 2 }]);
    expect(validateDeck(deck, lookup).issues.map((i) => i.code)).toEqual(['TOO_FEW_CARDS']);
    const draft = validateDeck(deck, lookup, { requireComplete: false });
    expect(draft.ok).toBe(true);
    expect(draft.incomplete).toBe(true);
  });

  it('rejects cards from another class', () => {
    const result = validateDeck(mageDeck([{ dbfId: TRACKING.dbfId, count: 1 }]), lookup, {
      requireComplete: false,
    });
    expect(result.issues[0]?.code).toBe('WRONG_CLASS');
  });

  it('treats multi-class cards as playable only in their listed classes', () => {
    const hunter = {
      heroClass: 'HUNTER' as const,
      format: 'WILD' as const,
      cards: [{ dbfId: TRI_CLASS.dbfId, count: 1 }],
    };
    expect(validateDeck(hunter, lookup, { requireComplete: false }).ok).toBe(true);
    const mage = mageDeck([{ dbfId: TRI_CLASS.dbfId, count: 1 }], 'WILD');
    expect(validateDeck(mage, lookup, { requireComplete: false }).issues[0]?.code).toBe(
      'WRONG_CLASS',
    );
  });

  it('rejects wild cards in standard but accepts them in wild', () => {
    const entry = [{ dbfId: WILD_ONLY.dbfId, count: 1 }];
    expect(validateDeck(mageDeck(entry), lookup, { requireComplete: false }).issues[0]?.code).toBe(
      'NOT_STANDARD',
    );
    expect(validateDeck(mageDeck(entry, 'WILD'), lookup, { requireComplete: false }).ok).toBe(true);
  });

  it('limits legendaries to one copy and counts Core reprints with their originals', () => {
    const legendary = validateDeck(mageDeck([{ dbfId: RAGNAROS.dbfId, count: 2 }]), lookup, {
      requireComplete: false,
    });
    expect(legendary.issues[0]?.code).toBe('TOO_MANY_COPIES');
    const reprint = validateDeck(
      mageDeck(
        [
          { dbfId: FIREBALL.dbfId, count: 1 },
          { dbfId: CORE_FIREBALL.dbfId, count: 2 },
        ],
        'WILD',
      ),
      lookup,
      { requireComplete: false },
    );
    expect(reprint.issues.map((i) => i.code)).toEqual(['TOO_MANY_COPIES']);
  });

  it('enforces the three-rune limit for Death Knights', () => {
    const dk = {
      heroClass: 'DEATHKNIGHT' as const,
      format: 'STANDARD' as const,
      cards: [
        { dbfId: DK_BLOOD.dbfId, count: 1 },
        { dbfId: DK_FROST.dbfId, count: 1 },
      ],
    };
    const result = validateDeck(dk, lookup, { requireComplete: false });
    expect(result.issues.map((i) => i.code)).toEqual(['RUNES_EXCEEDED']);
    expect(canAddCard({ ...dk, cards: [dk.cards[0]!] }, DK_FROST, lookup).ok).toBe(false);
  });

  it('reports unknown cards', () => {
    const result = validateDeck(mageDeck([{ dbfId: 99999, count: 1 }]), lookup, {
      requireComplete: false,
    });
    expect(result.issues[0]?.code).toBe('UNKNOWN_CARD');
  });
});

describe('canAddCard', () => {
  it('stops at the copy limit and the deck size', () => {
    expect(
      canAddCard(mageDeck([{ dbfId: CORE_FIREBALL.dbfId, count: 2 }]), CORE_FIREBALL, lookup).ok,
    ).toBe(false);
    expect(canAddCard(mageDeck([{ dbfId: RAGNAROS.dbfId, count: 1 }]), RAGNAROS, lookup).ok).toBe(
      false,
    );
    expect(canAddCard(mageDeck([{ dbfId: WISP.dbfId, count: 30 }]), CORE_FIREBALL, lookup).ok).toBe(
      false,
    );
    expect(
      canAddCard(mageDeck([{ dbfId: CORE_FIREBALL.dbfId, count: 1 }]), CORE_FIREBALL, lookup).ok,
    ).toBe(true);
  });
});

describe('entry helpers and stats', () => {
  it('adds and removes copies immutably', () => {
    const one = addCardEntry([], 1);
    const two = addCardEntry(one, 1);
    expect(one).toEqual([{ dbfId: 1, count: 1 }]);
    expect(two).toEqual([{ dbfId: 1, count: 2 }]);
    expect(removeCardEntry(two, 1)).toEqual([{ dbfId: 1, count: 1 }]);
    expect(removeCardEntry(one, 1)).toEqual([]);
  });

  it('computes mana curve, dust and average cost', () => {
    const stats = deckStats(
      [
        { dbfId: CORE_FIREBALL.dbfId, count: 2 },
        { dbfId: RAGNAROS.dbfId, count: 1 },
        { dbfId: WILD_ONLY.dbfId, count: 1 },
      ],
      lookup,
    );
    expect(stats.cardCount).toBe(4);
    expect(stats.manaCurve).toEqual([0, 0, 0, 0, 2, 0, 0, 2]);
    // Core cards (Fireball, Ragnaros fixture) cost no dust; Dr. Boom is a GVG legendary.
    expect(stats.dustCost).toBe(1600);
    expect(stats.averageCost).toBe((4 + 4 + 8 + 7) / 4);
    expect(stats.typeCounts).toEqual({ SPELL: 2, MINION: 2 });
  });
});
