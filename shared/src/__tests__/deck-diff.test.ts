import { describe, expect, it } from 'vitest';
import { deckSimilarity, diffDecks } from '../deck-diff.js';

const base = [
  { dbfId: 1, count: 2 },
  { dbfId: 2, count: 2 },
  { dbfId: 3, count: 1 },
];

describe('diffDecks', () => {
  it('reports no changes for identical lists in any entry order', () => {
    const diff = diffDecks(base, [...base].reverse());
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.sharedCards).toBe(5);
    expect(diff.changedCards).toBe(0);
  });

  it('reports added, removed and partial copy changes', () => {
    const variant = [
      { dbfId: 1, count: 1 }, // one copy removed
      { dbfId: 2, count: 2 },
      { dbfId: 4, count: 2 }, // new card
    ];
    const diff = diffDecks(base, variant);
    expect(diff.added).toEqual([{ dbfId: 4, count: 2 }]);
    expect(diff.removed).toEqual([
      { dbfId: 1, count: 1 },
      { dbfId: 3, count: 1 },
    ]);
    expect(diff.sharedCards).toBe(3);
    expect(diff.changedCards).toBe(4);
  });
});

describe('deckSimilarity', () => {
  it('is 1 for identical, 0 for disjoint, and in between otherwise', () => {
    expect(deckSimilarity(base, base)).toBe(1);
    expect(deckSimilarity(base, [{ dbfId: 9, count: 2 }])).toBe(0);
    expect(
      deckSimilarity(base, [
        { dbfId: 1, count: 2 },
        { dbfId: 2, count: 2 },
      ]),
    ).toBeCloseTo(4 / 5);
    expect(deckSimilarity([], [])).toBe(1);
  });
});
