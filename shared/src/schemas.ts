import { z } from 'zod';
import {
  CANDIDATE_STATUSES,
  CARD_CLASSES,
  CARD_TYPES,
  DECK_FORMATS,
  DECK_SOURCE_TYPES,
  RARITIES,
} from './types.js';
import { DECK_SIZE, MAX_COPIES } from './constants.js';

export const deckCardEntrySchema = z.object({
  dbfId: z.number().int().positive(),
  count: z.number().int().min(1).max(MAX_COPIES),
});

const deckFields = {
  name: z.string().trim().min(1).max(60),
  heroClass: z.enum(CARD_CLASSES),
  format: z.enum(DECK_FORMATS),
  cards: z.array(deckCardEntrySchema).max(DECK_SIZE),
  description: z.string().trim().max(2000),
  authorName: z.string().trim().min(1).max(40),
  archetype: z.string().trim().max(40).nullable(),
  basedOnId: z.string().trim().min(1).max(40).nullable(),
};

export const deckInputSchema = z.object({
  ...deckFields,
  cards: deckFields.cards.default([]),
  description: deckFields.description.default(''),
  authorName: deckFields.authorName.default('Anonymous'),
  archetype: deckFields.archetype.default(null),
  basedOnId: deckFields.basedOnId.default(null),
});
export type DeckInput = z.infer<typeof deckInputSchema>;

/** Partial update. Built from the field set WITHOUT defaults so omitted fields stay untouched. */
export const deckUpdateSchema = z.object(deckFields).partial();
export type DeckUpdate = z.infer<typeof deckUpdateSchema>;

export const cardQuerySchema = z.object({
  class: z.enum(CARD_CLASSES).optional(),
  format: z.enum(DECK_FORMATS).optional(),
  q: z.string().trim().max(100).optional(),
  cost: z.coerce.number().int().min(0).max(30).optional(),
  type: z.enum(CARD_TYPES).optional(),
  rarity: z.enum(RARITIES).optional(),
  set: z.string().max(40).optional(),
});
export type CardQuery = z.infer<typeof cardQuerySchema>;

export const DECK_KINDS = ['all', 'pro', 'community'] as const;
export type DeckKind = (typeof DECK_KINDS)[number];

export const deckListQuerySchema = z.object({
  class: z.enum(CARD_CLASSES).optional(),
  /** Only decks by this user id. */
  author: z.string().trim().max(40).optional(),
  format: z.enum(DECK_FORMATS).optional(),
  q: z.string().trim().max(100).optional(),
  /** pro = imported lists with a source; community = everything else. */
  kind: z.enum(DECK_KINDS).default('all'),
  archetype: z.string().trim().max(40).optional(),
  sort: z.enum(['newest', 'popular', 'liked']).default('newest'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type DeckListQuery = z.infer<typeof deckListQuerySchema>;

export const deckCodeSchema = z.object({
  code: z.string().trim().min(1).max(2000),
});

export const deckSourceSchema = z.object({
  type: z.enum(DECK_SOURCE_TYPES),
  name: z.string().trim().min(1).max(60),
  event: z.string().trim().max(100).optional(),
  placement: z.string().trim().max(60).optional(),
  url: z.string().url().max(300).optional(),
  playedAt: z.string().trim().max(30).optional(),
});

/**
 * Shape of server/data/pro-decks.json: a list of events, each with the published
 * lists. Deck names and archetypes default sensibly when omitted.
 */
export const proDeckImportSchema = z.array(
  z.object({
    event: z.string().trim().min(1).max(100),
    type: z.enum(DECK_SOURCE_TYPES).default('tournament'),
    url: z.string().url().max(300).optional(),
    date: z.string().trim().max(30).optional(),
    decks: z.array(
      z.object({
        player: z.string().trim().min(1).max(60),
        code: z.string().trim().min(1).max(2000),
        name: z.string().trim().max(60).optional(),
        archetype: z.string().trim().max(40).optional(),
        placement: z.string().trim().max(60).optional(),
        url: z.string().url().max(300).optional(),
      }),
    ),
  }),
);
export type ProDeckImport = z.infer<typeof proDeckImportSchema>;

export const candidateReviewSchema = z.object({
  /** Overrides applied when approving. */
  name: z.string().trim().min(1).max(60).optional(),
  archetype: z.string().trim().max(40).nullable().optional(),
});

export const candidateListQuerySchema = z.object({
  status: z.enum(CANDIDATE_STATUSES).default('pending'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

/** Shape of server/data/pro-sources.json: creator channels the collector watches. */
export const proSourcesSchema = z.object({
  youtube: z
    .array(
      z
        .object({
          channelId: z.string().trim().min(1).max(60).optional(),
          /** "@handle" as shown in the channel URL; resolved through the API. */
          handle: z.string().trim().min(2).max(60).optional(),
          name: z.string().trim().min(1).max(60),
          /** Only videos whose title matches (case-insensitive regex) are scanned. */
          titleFilter: z.string().max(200).optional(),
        })
        .refine((s) => s.channelId || s.handle, { message: 'channelId or handle is required' }),
    )
    .default([]),
});
export type ProSources = z.infer<typeof proSourcesSchema>;
