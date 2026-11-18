/**
 * Hearthstone deck code ("deckstring") codec.
 *
 * Layout (all integers are unsigned LEB128 varints, then base64):
 *   0x00 reserved | version=1 | format | heroCount=1, heroDbfId |
 *   n1, dbfIds with count 1 | n2, dbfIds with count 2 | nN, (dbfId, count) pairs |
 *   optional sideboard section (ignored on decode, never written).
 * Reference: https://hearthsim.info/docs/deckstrings/
 */
import { DEFAULT_HERO_DBF_ID } from './constants.js';
import type { CardClass, DeckCardEntry, DeckFormat } from './types.js';

const FORMAT_WILD = 1;
const FORMAT_STANDARD = 2;

export interface DeckstringInput {
  format: DeckFormat;
  heroClass: CardClass;
  cards: DeckCardEntry[];
  /** Override the hero portrait; defaults to the class's default hero. */
  heroDbfId?: number;
}

export interface DecodedDeckstring {
  format: DeckFormat;
  heroDbfId: number;
  /** Resolved only when the hero is one of the default class heroes. */
  heroClass?: CardClass;
  cards: DeckCardEntry[];
}

function writeVarint(out: number[], value: number): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid varint value: ${value}`);
  let v = value;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v);
}

class ByteReader {
  private pos = 0;
  constructor(private readonly bytes: Uint8Array) {}
  get remaining(): number {
    return this.bytes.length - this.pos;
  }
  readByte(): number {
    if (this.pos >= this.bytes.length) throw new Error('Unexpected end of deck code');
    return this.bytes[this.pos++]!;
  }
  readVarint(): number {
    let result = 0;
    let shift = 0;
    for (;;) {
      const byte = this.readByte();
      result += (byte & 0x7f) * 2 ** shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7;
      if (shift > 35) throw new Error('Varint too long');
    }
  }
}

function bytesToBase64(bytes: number[]): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeDeckstring(input: DeckstringInput): string {
  const singles: number[] = [];
  const doubles: number[] = [];
  const others: Array<[number, number]> = [];
  const merged = new Map<number, number>();
  for (const c of input.cards) merged.set(c.dbfId, (merged.get(c.dbfId) ?? 0) + c.count);
  for (const [dbfId, count] of merged) {
    if (count === 1) singles.push(dbfId);
    else if (count === 2) doubles.push(dbfId);
    else if (count > 2) others.push([dbfId, count]);
  }
  singles.sort((a, b) => a - b);
  doubles.sort((a, b) => a - b);
  others.sort((a, b) => a[0] - b[0]);

  const out: number[] = [0];
  writeVarint(out, 1);
  writeVarint(out, input.format === 'STANDARD' ? FORMAT_STANDARD : FORMAT_WILD);
  writeVarint(out, 1);
  writeVarint(out, input.heroDbfId ?? DEFAULT_HERO_DBF_ID[input.heroClass]);
  writeVarint(out, singles.length);
  for (const id of singles) writeVarint(out, id);
  writeVarint(out, doubles.length);
  for (const id of doubles) writeVarint(out, id);
  writeVarint(out, others.length);
  for (const [id, count] of others) {
    writeVarint(out, id);
    writeVarint(out, count);
  }
  // No sideboard.
  writeVarint(out, 0);
  return bytesToBase64(out);
}

export function decodeDeckstring(code: string): DecodedDeckstring {
  const trimmed = code.trim();
  if (!trimmed) throw new Error('Deck code is empty');
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(trimmed);
  } catch {
    throw new Error('Deck code is not valid base64');
  }
  const r = new ByteReader(bytes);
  if (r.readByte() !== 0) throw new Error('Deck code has an invalid header');
  const version = r.readVarint();
  if (version !== 1) throw new Error(`Unsupported deck code version ${version}`);
  const formatId = r.readVarint();
  const format: DeckFormat = formatId === FORMAT_STANDARD ? 'STANDARD' : 'WILD';

  const heroCount = r.readVarint();
  if (heroCount < 1) throw new Error('Deck code has no hero');
  const heroDbfId = r.readVarint();
  for (let i = 1; i < heroCount; i++) r.readVarint();

  const cards: DeckCardEntry[] = [];
  const n1 = r.readVarint();
  for (let i = 0; i < n1; i++) cards.push({ dbfId: r.readVarint(), count: 1 });
  const n2 = r.readVarint();
  for (let i = 0; i < n2; i++) cards.push({ dbfId: r.readVarint(), count: 2 });
  const nN = r.readVarint();
  for (let i = 0; i < nN; i++) {
    const dbfId = r.readVarint();
    const count = r.readVarint();
    cards.push({ dbfId, count });
  }
  // Anything after this point is sideboard data; we don't model sideboards.

  const heroClass = (Object.keys(DEFAULT_HERO_DBF_ID) as CardClass[]).find(
    (cls) => DEFAULT_HERO_DBF_ID[cls] === heroDbfId,
  );
  return { format, heroDbfId, heroClass, cards };
}

/**
 * Extracts the deck code from text copied out of the game client, which wraps the
 * code in `###` comment lines. Returns the first line that looks like a code.
 */
export function extractDeckstring(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('#') && /^[A-Za-z0-9+/=]+$/.test(l));
}
