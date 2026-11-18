/** Playable hero classes (deck classes). */
export const CARD_CLASSES = [
  'DEATHKNIGHT',
  'DEMONHUNTER',
  'DRUID',
  'HUNTER',
  'MAGE',
  'PALADIN',
  'PRIEST',
  'ROGUE',
  'SHAMAN',
  'WARLOCK',
  'WARRIOR',
] as const;
export type CardClass = (typeof CARD_CLASSES)[number];

/** A card belongs to a class or is neutral. */
export type CardOwnerClass = CardClass | 'NEUTRAL';

export const DECK_FORMATS = ['STANDARD', 'WILD'] as const;
export type DeckFormat = (typeof DECK_FORMATS)[number];

export const CARD_TYPES = ['MINION', 'SPELL', 'WEAPON', 'HERO', 'LOCATION'] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const RARITIES = ['FREE', 'COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;
export type Rarity = (typeof RARITIES)[number];

export interface RuneCost {
  blood: number;
  frost: number;
  unholy: number;
}

/** Trimmed card record served by the API (derived from HearthstoneJSON). */
export interface Card {
  /** HearthstoneJSON string id, e.g. "CORE_CS2_029". Used for artwork URLs. */
  id: string;
  /** Blizzard numeric id. Stable identity used in decks and deck codes. */
  dbfId: number;
  name: string;
  cardClass: CardOwnerClass;
  /** Multi-class cards list every class that may run them (replaces cardClass). */
  classes?: CardClass[];
  set: string;
  type: CardType;
  rarity: Rarity;
  cost: number;
  attack?: number;
  health?: number;
  durability?: number;
  armor?: number;
  text?: string;
  races?: string[];
  spellSchool?: string;
  runeCost?: RuneCost;
  mechanics?: string[];
  /** Core reprints point at the original card; both count as the same card for copy limits. */
  countAsCopyOfDbfId?: number;
  /** Companion card that ships with a "Fabled" legendary; hidden from browsing, one copy. */
  bundledWith?: number;
  /** For a "Fabled" legendary: the companions that must be in the deck with it. */
  bundledCards?: number[];
  /** True when the card's set is in the current Standard rotation. */
  standard: boolean;
}

export interface DeckCardEntry {
  dbfId: number;
  count: number;
}

export const DECK_SOURCE_TYPES = ['tournament', 'streamer', 'creator', 'community'] as const;
export type DeckSourceType = (typeof DECK_SOURCE_TYPES)[number];

/**
 * Where a pro / meta list came from. Set only by the import script, never by the
 * public API, so a "tournament" badge is always trustworthy.
 */
export interface DeckSource {
  type: DeckSourceType;
  /** Player, streamer or creator name as published. */
  name: string;
  /** Event or channel, e.g. "Masters Tour World Championship 2026". */
  event?: string;
  /** Stage or result as published, e.g. "Group B", "Finalist". */
  placement?: string;
  /** Where the list was published. Always link back. */
  url?: string;
  /** ISO date the list was played or published. */
  playedAt?: string;
}

export interface Deck {
  id: string;
  name: string;
  heroClass: CardClass;
  format: DeckFormat;
  cards: DeckCardEntry[];
  description: string;
  authorName: string;
  /** Free-text archetype label, e.g. "Attack Druid". */
  archetype: string | null;
  /** Present on imported pro lists; null for community decks. */
  source: DeckSource | null;
  /** The deck this one was remixed from (see "Open in builder"). */
  basedOnId: string | null;
  published: boolean;
  views: number;
  createdAt: string;
  updatedAt: string;
}

/** Lightweight deck row for list views. */
export interface DeckSummary {
  id: string;
  name: string;
  heroClass: CardClass;
  format: DeckFormat;
  authorName: string;
  archetype: string | null;
  source: DeckSource | null;
  basedOnId: string | null;
  published: boolean;
  views: number;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Minimal shape needed by the deck rules; `Card` satisfies it. */
export type CardLookup = (dbfId: number) => Card | undefined;
