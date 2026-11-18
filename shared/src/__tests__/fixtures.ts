import type { Card } from '../types.js';

export function card(partial: Partial<Card> & Pick<Card, 'dbfId' | 'name'>): Card {
  return {
    id: `TEST_${partial.dbfId}`,
    cardClass: 'NEUTRAL',
    set: 'CORE',
    type: 'MINION',
    rarity: 'COMMON',
    cost: 2,
    standard: true,
    ...partial,
  };
}

export const FIREBALL = card({
  dbfId: 315,
  name: 'Fireball',
  cardClass: 'MAGE',
  type: 'SPELL',
  cost: 4,
  set: 'LEGACY',
  standard: false,
});
export const CORE_FIREBALL = card({
  dbfId: 69501,
  name: 'Fireball',
  cardClass: 'MAGE',
  type: 'SPELL',
  cost: 4,
  countAsCopyOfDbfId: 315,
});
export const WISP = card({ dbfId: 179, name: 'Wisp', cost: 0 });
export const RAGNAROS = card({ dbfId: 503, name: 'Ragnaros', rarity: 'LEGENDARY', cost: 8 });
export const TRACKING = card({
  dbfId: 1000,
  name: 'Tracking',
  cardClass: 'HUNTER',
  type: 'SPELL',
  cost: 1,
});
export const TRI_CLASS = card({
  dbfId: 2000,
  name: 'Grimestreet Informant',
  classes: ['HUNTER', 'PALADIN', 'WARRIOR'],
  set: 'GANGS',
  standard: false,
});
export const WILD_ONLY = card({
  dbfId: 3000,
  name: 'Dr. Boom',
  rarity: 'LEGENDARY',
  set: 'GVG',
  standard: false,
  cost: 7,
});
export const DK_BLOOD = card({
  dbfId: 4000,
  name: 'Blood Boil',
  cardClass: 'DEATHKNIGHT',
  runeCost: { blood: 2, frost: 0, unholy: 0 },
});
export const DK_FROST = card({
  dbfId: 4001,
  name: 'Frost Strike',
  cardClass: 'DEATHKNIGHT',
  runeCost: { blood: 0, frost: 2, unholy: 0 },
});

export const SYLVANAS = card({
  dbfId: 5000,
  name: 'Ranger General Sylvanas',
  cardClass: 'HUNTER',
  rarity: 'LEGENDARY',
  cost: 3,
  bundledCards: [5001, 5002],
});
export const ALLERIA = card({
  dbfId: 5001,
  name: 'Ranger Captain Alleria',
  cardClass: 'HUNTER',
  rarity: 'FREE',
  cost: 3,
  bundledWith: 5000,
});
export const VEREESA = card({
  dbfId: 5002,
  name: 'Ranger Initiate Vereesa',
  cardClass: 'HUNTER',
  rarity: 'FREE',
  cost: 3,
  bundledWith: 5000,
});

export const ALL = [
  FIREBALL,
  CORE_FIREBALL,
  WISP,
  RAGNAROS,
  TRACKING,
  TRI_CLASS,
  WILD_ONLY,
  DK_BLOOD,
  DK_FROST,
  SYLVANAS,
  ALLERIA,
  VEREESA,
];
export const lookup = (dbfId: number) => ALL.find((c) => c.dbfId === dbfId);
