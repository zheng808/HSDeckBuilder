import { describe, expect, it } from 'vitest';
import {
  addCardWithBundle,
  canAddCard,
  dustCostOf,
  maxCopies,
  removeCardWithBundle,
  validateDeck,
} from '../deck-rules.js';
import { ALLERIA, SYLVANAS, VEREESA, WISP, lookup } from './fixtures.js';

const hunter = (cards: { dbfId: number; count: number }[]) => ({
  heroClass: 'HUNTER' as const,
  format: 'STANDARD' as const,
  cards,
});
const bundle = [
  { dbfId: SYLVANAS.dbfId, count: 1 },
  { dbfId: ALLERIA.dbfId, count: 1 },
  { dbfId: VEREESA.dbfId, count: 1 },
];

describe('Fabled bundles', () => {
  it('accepts a complete bundle and limits companions to one copy', () => {
    expect(validateDeck(hunter(bundle), lookup, { requireComplete: false }).ok).toBe(true);
    expect(maxCopies(ALLERIA)).toBe(1);
    expect(dustCostOf(ALLERIA)).toBe(0);
  });

  it('flags a companion without its parent and a parent without its companions', () => {
    const orphan = validateDeck(hunter([{ dbfId: ALLERIA.dbfId, count: 1 }]), lookup, {
      requireComplete: false,
    });
    expect(orphan.issues.map((i) => i.code)).toEqual(['MISSING_BUNDLE_PARENT']);
    const partial = validateDeck(hunter(bundle.slice(0, 2)), lookup, { requireComplete: false });
    expect(partial.issues.map((i) => i.code)).toEqual(['INCOMPLETE_BUNDLE']);
    expect(partial.issues[0]?.message).toContain('Vereesa');
  });

  it('adds and removes the whole bundle together', () => {
    const added = addCardWithBundle([{ dbfId: WISP.dbfId, count: 2 }], SYLVANAS);
    expect(added.map((e) => e.dbfId)).toEqual([
      WISP.dbfId,
      SYLVANAS.dbfId,
      ALLERIA.dbfId,
      VEREESA.dbfId,
    ]);
    expect(removeCardWithBundle(added, VEREESA.dbfId, lookup)).toEqual([
      { dbfId: WISP.dbfId, count: 2 },
    ]);
    expect(removeCardWithBundle(added, SYLVANAS.dbfId, lookup)).toEqual([
      { dbfId: WISP.dbfId, count: 2 },
    ]);
    expect(removeCardWithBundle(added, WISP.dbfId, lookup)).toHaveLength(4);
  });

  it('refuses adding a companion directly and requires room for the whole bundle', () => {
    expect(canAddCard(hunter([]), ALLERIA, lookup).ok).toBe(false);
    expect(canAddCard(hunter([{ dbfId: WISP.dbfId, count: 28 }]), SYLVANAS, lookup).ok).toBe(false);
    expect(canAddCard(hunter([{ dbfId: WISP.dbfId, count: 27 }]), SYLVANAS, lookup).ok).toBe(true);
  });
});
