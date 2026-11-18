import type {
  CardClass,
  Deck,
  DeckCardEntry,
  DeckDiff,
  DeckFormat,
  DeckKind,
  DeckStats,
  DeckSummary,
  ValidationResult,
} from '@hsdeck/shared';

export interface MetaResponse {
  classes: CardClass[];
  formats: DeckFormat[];
  standardSets: string[];
  cardCount: number;
  dataFetchedAt: string;
}

export interface DeckResponse {
  deck: Deck;
  /** True when the caller's owner token created this deck. */
  isOwner: boolean;
  deckCode: string;
  validation: ValidationResult;
  stats: DeckStats;
  /** The deck this one was remixed from, when visible to the viewer. */
  basedOn: DeckSummary | null;
  /** Cards added/removed relative to `basedOn`. */
  diff: DeckDiff | null;
}

export interface ArchetypesResponse {
  items: { archetype: string; count: number; classes: CardClass[] }[];
}

export interface DeckListResponse {
  items: DeckSummary[];
  total: number;
}

export interface MyDecksResponse {
  items: DeckSummary[];
}

export interface DecodeResponse {
  format: DeckFormat;
  heroClass: CardClass;
  heroDbfId: number;
  cards: DeckCardEntry[];
  unknownDbfIds: number[];
}

export interface DeckListParams {
  class?: CardClass;
  format?: DeckFormat;
  q?: string;
  kind?: DeckKind;
  archetype?: string;
  sort?: 'newest' | 'popular';
  limit?: number;
  offset?: number;
}
