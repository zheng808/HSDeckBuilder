/**
 * Downloads the collectible card dump from HearthstoneJSON, trims it to the fields the
 * app needs, and writes server/data/cards.json and server/data/heroes.json.
 *
 *   npm run seed:cards            # fetch latest
 *   npm run seed:cards -- --from /path/to/cards.collectible.json   # offline
 *
 * Standard legality is NOT baked in here; it is computed at load time from
 * STANDARD_SETS in @hsdeck/shared so a rotation only needs a constants change.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXCLUDED_SETS, type Card, type CardClass } from '@hsdeck/shared';

const SOURCE_URL = 'https://api.hearthstonejson.com/v1/latest/enUS/cards.collectible.json';
/** Full dump (includes uncollectible tokens) used only to find bundled companion cards. */
const ALL_CARDS_URL = 'https://api.hearthstonejson.com/v1/latest/enUS/cards.json';
const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');

type RawCard = Record<string, unknown> & {
  id: string;
  dbfId: number;
  name: string;
  set: string;
  type: string;
  rarity?: string;
  cardClass?: string;
  classes?: string[];
  cost?: number;
};

export type HeroRecord = { id: string; dbfId: number; name: string; cardClass: CardClass };

async function loadJson(flag: string, url: string): Promise<RawCard[]> {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1) {
    const file = process.argv[idx + 1];
    if (!file) throw new Error(`${flag} requires a path`);
    console.log(`Reading ${file}`);
    return JSON.parse(await readFile(file, 'utf8')) as RawCard[];
  }
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as RawCard[];
}

/** `--from <collectible.json>` and `--all-from <cards.json>` read local copies instead of downloading. */
const loadRaw = () => loadJson('--from', SOURCE_URL);
const loadAll = () => loadJson('--all-from', ALL_CARDS_URL);

/**
 * "Fabled" legendaries ship with companion cards that occupy real deck slots and
 * appear in deck codes under their own (uncollectible) ids, e.g. Ranger General
 * Sylvanas (TIME_609) with Alleria (TIME_609t1) and Vereesa (TIME_609t2). Detect them:
 * parent is collectible with "Fabled" in its text, token id is `<parent>t<n>` and elite.
 */
/**
 * Companions verified (from real deck codes) to occupy deck slots. Other Fabled
 * companions are generated during play, so they are linked to their parent for
 * display but not required. Extend this as new Fabled cards show up in codes.
 */
const REQUIRED_COMPANIONS: Record<string, string[]> = {
  TIME_609: ['TIME_609t1', 'TIME_609t2'], // Ranger General Sylvanas: Alleria, Vereesa
  TIME_020: ['TIME_020t1', 'TIME_020t2'], // Broxigar: Axe of Cenarius, First Portal to Argus
};

function findBundles(all: RawCard[]): Map<RawCard, RawCard[]> {
  const parents = new Map(
    all
      .filter((c) => c.collectible && /<b>Fabled/.test(String(c['text'] ?? '')))
      .map((c) => [c.id, c] as const),
  );
  const bundles = new Map<RawCard, RawCard[]>();
  for (const card of all) {
    if (card.collectible || card['elite'] !== true) continue;
    const m = /^(.+?)t\d+$/.exec(card.id);
    const parent = m && parents.get(m[1]!);
    if (!parent) continue;
    const list = bundles.get(parent) ?? [];
    list.push(card);
    bundles.set(parent, list);
  }
  return bundles;
}

function pick<T>(v: unknown): T | undefined {
  return v === undefined || v === null ? undefined : (v as T);
}

/** Shape stored on disk: everything in Card except the computed `standard` flag. */
export type StoredCard = Omit<Card, 'standard'>;

function trim(raw: RawCard): StoredCard | undefined {
  if (EXCLUDED_SETS.has(raw.set)) return undefined;
  if (typeof raw.cost !== 'number') return undefined; // uncollectible oddities
  const classes = pick<string[]>(raw.classes);
  const cardClass = raw.cardClass ?? classes?.[0] ?? 'NEUTRAL';
  const card: StoredCard = {
    id: raw.id,
    dbfId: raw.dbfId,
    name: raw.name,
    cardClass: cardClass as Card['cardClass'],
    set: raw.set,
    type: raw.type as Card['type'],
    rarity: (raw.rarity ?? 'FREE') as Card['rarity'],
    cost: raw.cost,
  };
  if (classes && classes.length > 1) card.classes = classes as CardClass[];
  const opt: Array<keyof StoredCard> = [
    'attack',
    'health',
    'durability',
    'armor',
    'text',
    'races',
    'spellSchool',
    'runeCost',
    'mechanics',
    'countAsCopyOfDbfId',
  ];
  for (const key of opt) {
    const v = raw[key];
    if (v !== undefined && v !== null) (card as Record<string, unknown>)[key] = v;
  }
  return card;
}

async function main() {
  const raw = await loadRaw();
  const bundles = findBundles(await loadAll());
  const cards: StoredCard[] = [];
  const heroes: HeroRecord[] = [];
  for (const r of raw) {
    if (r.set === 'HERO_SKINS' && r.type === 'HERO' && r.cardClass) {
      heroes.push({ id: r.id, dbfId: r.dbfId, name: r.name, cardClass: r.cardClass as CardClass });
      continue;
    }
    const c = trim(r);
    if (c) cards.push(c);
  }
  let bundled = 0;
  const byDbfId = new Map(cards.map((c) => [c.dbfId, c]));
  for (const [parent, tokens] of bundles) {
    const parentCard = byDbfId.get(parent.dbfId);
    if (!parentCard) continue;
    const children: StoredCard[] = [];
    for (const token of tokens.sort((a, b) => a.dbfId - b.dbfId)) {
      const child = trim(token);
      if (!child) continue;
      child.bundledWith = parent.dbfId;
      children.push(child);
    }
    if (children.length === 0) continue;
    const required = REQUIRED_COMPANIONS[parent.id];
    if (required) {
      parentCard.bundledCards = children.filter((c) => required.includes(c.id)).map((c) => c.dbfId);
    }
    cards.push(...children);
    bundled += children.length;
  }
  cards.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name) || a.dbfId - b.dbfId);
  heroes.sort((a, b) => a.dbfId - b.dbfId);

  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, 'cards.json'), JSON.stringify(cards));
  await writeFile(path.join(dataDir, 'heroes.json'), JSON.stringify(heroes));
  await writeFile(
    path.join(dataDir, 'meta.json'),
    JSON.stringify(
      {
        source: SOURCE_URL,
        fetchedAt: new Date().toISOString(),
        cards: cards.length,
        heroes: heroes.length,
      },
      null,
      2,
    ),
  );
  const sets = new Map<string, number>();
  for (const c of cards) sets.set(c.set, (sets.get(c.set) ?? 0) + 1);
  console.log(
    `Wrote ${cards.length} cards (${bundled} bundled companions), ${heroes.length} heroes to ${dataDir}`,
  );
  console.log(
    'Sets:',
    [...sets.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => `${s}(${n})`)
      .join(' '),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
