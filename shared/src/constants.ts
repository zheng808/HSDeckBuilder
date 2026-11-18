import type { CardClass } from './types.js';

export const DECK_SIZE = 30;
export const MAX_COPIES = 2;
export const MAX_LEGENDARY_COPIES = 1;
/** A Death Knight deck may commit to at most three runes in total. */
export const MAX_RUNES = 3;

/**
 * Sets legal in Standard. Update this list when Hearthstone rotates (each spring,
 * with the first expansion of the new year): drop the sets from two years ago and
 * add the new year's sets as they release. Mini-sets share their parent set code.
 *
 * Current rotation (Nov 2026): Core + 2025 sets + 2026 sets.
 */
export const STANDARD_SETS: ReadonlySet<string> = new Set([
  'CORE',
  'EVENT',
  // 2025
  'EMERALD_DREAM',
  'THE_LOST_CITY',
  'TIME_TRAVEL',
  // 2026
  'CATACLYSM',
  'ESCAPEFROM_VIOLET_HOLD',
  'BE',
]);

/**
 * Sets that exist in HearthstoneJSON's collectible dump but are not real deck cards
 * (hero portraits, Classic-mode duplicates, rotated Core duplicates).
 */
export const EXCLUDED_SETS: ReadonlySet<string> = new Set(['HERO_SKINS', 'VANILLA', 'CORE_HIDDEN']);

export function isStandardSet(set: string): boolean {
  return STANDARD_SETS.has(set);
}

/** Default hero portraits per class. Used to build deck codes. */
export const DEFAULT_HERO_DBF_ID: Record<CardClass, number> = {
  WARRIOR: 7,
  SHAMAN: 1066,
  ROGUE: 930,
  PALADIN: 671,
  HUNTER: 31,
  DRUID: 274,
  WARLOCK: 893,
  MAGE: 637,
  PRIEST: 813,
  DEMONHUNTER: 56550,
  DEATHKNIGHT: 78065,
};

export const CLASS_DISPLAY_NAME: Record<CardClass, string> = {
  DEATHKNIGHT: 'Death Knight',
  DEMONHUNTER: 'Demon Hunter',
  DRUID: 'Druid',
  HUNTER: 'Hunter',
  MAGE: 'Mage',
  PALADIN: 'Paladin',
  PRIEST: 'Priest',
  ROGUE: 'Rogue',
  SHAMAN: 'Shaman',
  WARLOCK: 'Warlock',
  WARRIOR: 'Warrior',
};

/** Crafting cost per rarity. Core-set cards are free. */
export const DUST_COST: Record<string, number> = {
  FREE: 0,
  COMMON: 40,
  RARE: 100,
  EPIC: 400,
  LEGENDARY: 1600,
};
