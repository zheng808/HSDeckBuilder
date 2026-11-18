import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  cardLegalInFormat,
  cardPlayableInClass,
  isStandardSet,
  type Card,
  type CardClass,
  type CardQuery,
  type DeckCardEntry,
} from '@hsdeck/shared';

export interface HeroRecord {
  id: string;
  dbfId: number;
  name: string;
  cardClass: CardClass;
}

export interface CardDataMeta {
  source: string;
  fetchedAt: string;
  cards: number;
  heroes: number;
  bundled?: number;
}

/** In-memory card catalogue. Card data is static, so no database table is needed. */
export class CardStore {
  readonly cards: Card[];
  readonly meta: CardDataMeta;
  private readonly byDbfId = new Map<number, Card>();
  private readonly heroesByDbfId = new Map<number, HeroRecord>();
  /** Non-canonical reprints; hidden from browsing but still valid inside decks. */
  private readonly shadowed = new Set<number>();

  constructor(cards: Omit<Card, 'standard'>[], heroes: HeroRecord[], meta: CardDataMeta) {
    this.cards = cards.map((c) => ({ ...c, standard: isStandardSet(c.set) }));
    this.meta = meta;
    this.linkReprints();
    for (const card of this.cards) this.byDbfId.set(card.dbfId, card);
    for (const hero of heroes) this.heroesByDbfId.set(hero.dbfId, hero);
  }

  /**
   * Cards with the same name are the same card for deck-building purposes (Core
   * reprints, Caverns of Time reprints). HearthstoneJSON only links some of them, so
   * we group by name and elect one canonical version: Core first, then Standard-legal,
   * then the oldest print. Every other version gets `countAsCopyOfDbfId` pointing at
   * the canonical card and is hidden from browsing.
   */
  private linkReprints(): void {
    const groups = new Map<string, Card[]>();
    for (const card of this.cards) {
      const key = card.name.toLowerCase();
      const group = groups.get(key);
      if (group) group.push(card);
      else groups.set(key, [card]);
    }
    const rank = (c: Card) => (c.set === 'CORE' ? 0 : c.standard ? 1 : 2);
    for (const group of groups.values()) {
      if (group.length === 1) {
        delete group[0]!.countAsCopyOfDbfId;
        continue;
      }
      group.sort((a, b) => rank(a) - rank(b) || a.dbfId - b.dbfId);
      const canonical = group[0]!;
      delete canonical.countAsCopyOfDbfId;
      for (const other of group.slice(1)) {
        other.countAsCopyOfDbfId = canonical.dbfId;
        this.shadowed.add(other.dbfId);
      }
    }
  }

  static fromDataDir(dataDir: string): CardStore {
    const read = <T>(file: string): T =>
      JSON.parse(readFileSync(path.join(dataDir, file), 'utf8')) as T;
    return new CardStore(read('cards.json'), read('heroes.json'), read('meta.json'));
  }

  get = (dbfId: number): Card | undefined => this.byDbfId.get(dbfId);

  /** The canonical card a deck-code id refers to (hidden reprints map to their canonical print). */
  resolveDbfId(dbfId: number): number {
    return this.byDbfId.get(dbfId)?.countAsCopyOfDbfId ?? dbfId;
  }

  /** Maps hidden reprints to the canonical card and merges duplicate entries. */
  canonicalize(entries: DeckCardEntry[]): DeckCardEntry[] {
    const merged = new Map<number, number>();
    for (const entry of entries) {
      const id = this.resolveDbfId(entry.dbfId);
      merged.set(id, (merged.get(id) ?? 0) + entry.count);
    }
    return [...merged].map(([dbfId, count]) => ({ dbfId, count }));
  }

  heroClassFor(heroDbfId: number): CardClass | undefined {
    return this.heroesByDbfId.get(heroDbfId)?.cardClass;
  }

  query(q: CardQuery): Card[] {
    const needle = q.q?.toLowerCase();
    return this.cards.filter((card) => {
      if (this.shadowed.has(card.dbfId)) return false;
      if (card.bundledWith !== undefined) return false; // companions come with their parent
      if (q.class && !cardPlayableInClass(card, q.class)) return false;
      if (q.format && !cardLegalInFormat(card, q.format)) return false;
      if (q.cost !== undefined && card.cost !== q.cost) return false;
      if (q.type && card.type !== q.type) return false;
      if (q.rarity && card.rarity !== q.rarity) return false;
      if (q.set && card.set !== q.set) return false;
      if (needle) {
        const haystack =
          `${card.name} ${card.text ?? ''} ${card.races?.join(' ') ?? ''} ${card.spellSchool ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }
}
