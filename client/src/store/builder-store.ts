import { create } from 'zustand';
import {
  addCardWithBundle,
  canAddCard,
  removeCardWithBundle,
  type AddCardResult,
  type Card,
  type CardClass,
  type CardLookup,
  type Deck,
  type DeckCardEntry,
  type DeckFormat,
} from '@hsdeck/shared';

export interface BuilderState {
  deckId: string | null;
  name: string;
  heroClass: CardClass | null;
  format: DeckFormat;
  cards: DeckCardEntry[];
  description: string;
  /** Free-text archetype label, e.g. "Attack Druid". */
  archetype: string | null;
  /** Deck this one was remixed from ("Open in builder"). */
  basedOnId: string | null;
  /** True when there are unsaved changes. */
  dirty: boolean;
  /** Published state of the loaded deck (drafts and new decks are false). */
  published: boolean;

  start: (heroClass: CardClass, format: DeckFormat) => void;
  loadDeck: (deck: Deck) => void;
  cloneDeck: (deck: Deck) => void;
  importCards: (heroClass: CardClass, format: DeckFormat, cards: DeckCardEntry[]) => void;
  addCard: (card: Card, lookup: CardLookup) => AddCardResult;
  /** Removing a Fabled legendary or one of its companions removes the whole bundle. */
  removeCard: (dbfId: number, lookup: CardLookup) => void;
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  setArchetype: (archetype: string) => void;
  /** Forget the base deck; the remix becomes a standalone deck. */
  detachBase: () => void;
  setFormat: (format: DeckFormat) => void;
  clearCards: () => void;
  markSaved: (deck: Deck) => void;
  reset: () => void;
}

const initial = {
  deckId: null,
  name: '',
  heroClass: null,
  format: 'STANDARD' as DeckFormat,
  cards: [] as DeckCardEntry[],
  description: '',
  archetype: null as string | null,
  basedOnId: null as string | null,
  dirty: false,
  published: false,
};

export const useBuilderStore = create<BuilderState>()((set, get) => ({
  ...initial,

  start: (heroClass, format) => set({ ...initial, heroClass, format, name: '' }),

  loadDeck: (deck) =>
    set({
      deckId: deck.id,
      name: deck.name,
      heroClass: deck.heroClass,
      format: deck.format,
      cards: deck.cards.map((c) => ({ ...c })),
      description: deck.description,
      archetype: deck.archetype,
      basedOnId: deck.basedOnId,
      published: deck.published,
      dirty: false,
    }),

  cloneDeck: (deck) =>
    set({
      ...initial,
      heroClass: deck.heroClass,
      format: deck.format,
      cards: deck.cards.map((c) => ({ ...c })),
      name: `Copy of ${deck.name}`.slice(0, 60),
      description: deck.description,
      archetype: deck.archetype,
      basedOnId: deck.id,
      dirty: true,
    }),

  importCards: (heroClass, format, cards) =>
    set({ ...initial, heroClass, format, cards: cards.map((c) => ({ ...c })), dirty: true }),

  addCard: (card, lookup) => {
    const { heroClass, format, cards } = get();
    if (!heroClass) return { ok: false, reason: 'Pick a class first.' };
    const result = canAddCard({ heroClass, format, cards }, card, lookup);
    if (result.ok) set({ cards: addCardWithBundle(cards, card), dirty: true });
    return result;
  },

  removeCard: (dbfId, lookup) =>
    set((s) => ({ cards: removeCardWithBundle(s.cards, dbfId, lookup), dirty: true })),
  setName: (name) => set({ name, dirty: true }),
  setDescription: (description) => set({ description, dirty: true }),
  setArchetype: (archetype) => set({ archetype: archetype.trim() ? archetype : null, dirty: true }),
  detachBase: () => set({ basedOnId: null, dirty: true }),
  setFormat: (format) => set({ format, dirty: true }),
  clearCards: () => set({ cards: [], dirty: true }),

  markSaved: (deck) =>
    set({
      deckId: deck.id,
      published: deck.published,
      dirty: false,
      name: deck.name,
      archetype: deck.archetype,
      basedOnId: deck.basedOnId,
    }),

  reset: () => set({ ...initial }),
}));
