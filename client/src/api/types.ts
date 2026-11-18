import type {
  AuthProvider,
  CardClass,
  Deck,
  DeckAuthor,
  DeckCardEntry,
  DeckDiff,
  DeckFormat,
  DeckKind,
  DeckStats,
  DeckSummary,
  ProCandidate,
  User,
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
  /** Whether the signed-in viewer has liked this deck. */
  liked: boolean;
}

export interface MeResponse {
  user: User | null;
}

export interface ProvidersResponse {
  providers: AuthProvider[];
}

export interface ProfileResponse {
  user: DeckAuthor & { createdAt: string };
  decks: DeckSummary[];
}

export interface LikeResponse {
  likes: number;
  liked: boolean;
}

export interface CandidatesResponse {
  items: ProCandidate[];
}

export interface CollectResponse {
  scanned: number;
  added: number;
  skipped: number;
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
  author?: string;
  sort?: 'newest' | 'popular' | 'liked';
  limit?: number;
  offset?: number;
}
