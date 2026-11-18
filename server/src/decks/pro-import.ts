import { createHash } from 'node:crypto';
import {
  decodeDeckstring,
  encodeDeckstring,
  proDeckImportSchema,
  validateDeck,
  type DeckSource,
  type ProDeckImport,
} from '@hsdeck/shared';
import type { CardStore } from '../cards/card-store.js';
import { hashOwnerToken } from '../http/owner.js';
import type { DeckRepo } from './deck-repo.js';

export const DEFAULT_IMPORT_OWNER_TOKEN = 'system-pro-import';

export interface ImportResult {
  created: number;
  updated: number;
  skipped: Array<{ event: string; player: string; reason: string }>;
}

/**
 * Imports published pro / tournament lists. Idempotent: an entry is keyed by
 * event + player + canonical deck code, so re-running updates metadata in place.
 */
export function importProDecks(
  raw: unknown,
  deps: { decks: DeckRepo; cards: CardStore; ownerToken?: string },
): ImportResult {
  const events: ProDeckImport = proDeckImportSchema.parse(raw);
  const ownerHash = hashOwnerToken(deps.ownerToken ?? DEFAULT_IMPORT_OWNER_TOKEN);
  const result: ImportResult = { created: 0, updated: 0, skipped: [] };

  for (const event of events) {
    for (const entry of event.decks) {
      const skip = (reason: string) =>
        result.skipped.push({ event: event.event, player: entry.player, reason });
      let decoded;
      try {
        decoded = decodeDeckstring(entry.code);
      } catch (err) {
        skip(`bad deck code: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      const heroClass = decoded.heroClass ?? deps.cards.heroClassFor(decoded.heroDbfId);
      if (!heroClass) {
        skip(`unknown hero ${decoded.heroDbfId}`);
        continue;
      }
      const cards = deps.cards.canonicalize(decoded.cards);
      const deckShape = { heroClass, format: decoded.format, cards };
      const validation = validateDeck(deckShape, deps.cards.get, { requireComplete: true });
      if (!validation.ok) {
        skip(validation.issues.map((i) => i.message).join('; '));
        continue;
      }
      const canonicalCode = encodeDeckstring(deckShape);
      const importKey = createHash('sha1')
        .update(`${event.event}|${entry.player}|${canonicalCode}`)
        .digest('hex');
      const source: DeckSource = {
        type: event.type,
        name: entry.player,
        event: event.event,
        ...(entry.placement ? { placement: entry.placement } : {}),
        ...((entry.url ?? event.url) ? { url: entry.url ?? event.url } : {}),
        ...(event.date ? { playedAt: event.date } : {}),
      };
      const archetype = entry.archetype ?? entry.name ?? null;
      const name = entry.name ?? entry.archetype ?? `${entry.player}'s ${heroClass} deck`;
      const existing = deps.decks.getByImportKey(importKey);
      if (existing) {
        deps.decks.update(existing.id, {
          name,
          archetype,
          source,
          cards,
          format: decoded.format,
          heroClass,
          published: true,
        });
        result.updated += 1;
      } else {
        deps.decks.create({
          name,
          heroClass,
          format: decoded.format,
          cards,
          description: '',
          authorName: entry.player,
          ownerHash,
          archetype,
          source,
          importKey,
          published: true,
        });
        result.created += 1;
      }
    }
  }
  return result;
}
