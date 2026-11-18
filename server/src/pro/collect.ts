import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CLASS_DISPLAY_NAME,
  decodeDeckstring,
  encodeDeckstring,
  proSourcesSchema,
  validateDeck,
  type CardClass,
  type DeckSource,
} from '@hsdeck/shared';
import type { CardStore } from '../cards/card-store.js';
import type { CandidateRepo } from './candidate-repo.js';
import { collectFromYoutube, type FoundCode } from './youtube.js';

export interface CollectResult {
  scanned: number;
  added: number;
  skipped: number;
  errors: string[];
}

export function loadSources(dataDir: string) {
  const file = path.join(dataDir, 'pro-sources.json');
  return proSourcesSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

/** "Attack Druid" from a title like "ATTACK DRUID is back! (Hearthstone)". */
export function guessArchetype(title: string, heroClass: CardClass | null): string | null {
  if (!heroClass) return null;
  const className = CLASS_DISPLAY_NAME[heroClass];
  const shortNames: Record<string, string> = { DEMONHUNTER: 'DH', DEATHKNIGHT: 'DK' };
  const names = [className, shortNames[heroClass]].filter(Boolean) as string[];
  for (const name of names) {
    const m = new RegExp(`([A-Za-z'-]+)\\s+${name}\\b`, 'i').exec(title);
    if (m?.[1] && !/^(the|a|an|my|new|this|best|with|is|and)$/i.test(m[1])) {
      const word = m[1];
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()} ${className}`;
    }
  }
  return null;
}

/** Decodes, validates and stores a found code as a candidate (skips duplicates). */
export function storeCandidate(
  found: FoundCode,
  deps: { cards: CardStore; candidates: CandidateRepo },
): boolean {
  let heroClass: CardClass | null = null;
  let format: 'STANDARD' | 'WILD' | null = null;
  let cardCount = 0;
  const issues: string[] = [];
  let canonical = found.code;
  try {
    const decoded = decodeDeckstring(found.code);
    heroClass = decoded.heroClass ?? deps.cards.heroClassFor(decoded.heroDbfId) ?? null;
    format = decoded.format;
    const entries = deps.cards.canonicalize(decoded.cards);
    cardCount = entries.reduce((n, e) => n + e.count, 0);
    if (heroClass) {
      const v = validateDeck({ heroClass, format, cards: entries }, deps.cards.get, {
        requireComplete: true,
      });
      issues.push(...v.issues.map((i) => i.message));
      canonical = encodeDeckstring({ heroClass, format, cards: entries });
    } else {
      issues.push(`Unknown hero ${decoded.heroDbfId}`);
    }
  } catch (err) {
    issues.push(err instanceof Error ? err.message : 'Undecodable deck code');
  }
  const source: DeckSource = {
    type: 'creator',
    name: found.source.name,
    event: found.title.slice(0, 100),
    url: `https://www.youtube.com/watch?v=${found.videoId}`,
    ...(found.publishedAt ? { playedAt: found.publishedAt.slice(0, 10) } : {}),
  };
  return (
    deps.candidates.add({
      source,
      title: found.title,
      code: found.code,
      canonicalCode: canonical,
      heroClass,
      format,
      cardCount,
      issues,
      archetypeGuess: guessArchetype(found.title, heroClass),
    }) !== null
  );
}

export async function collectProLists(deps: {
  cards: CardStore;
  candidates: CandidateRepo;
  dataDir: string;
  youtubeApiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<CollectResult> {
  const sources = loadSources(deps.dataDir);
  const result: CollectResult = { scanned: 0, added: 0, skipped: 0, errors: [] };
  if (!deps.youtubeApiKey) {
    result.errors.push('YOUTUBE_API_KEY is not set');
    return result;
  }
  const yt = await collectFromYoutube(sources.youtube, deps.youtubeApiKey, {
    fetchImpl: deps.fetchImpl,
  });
  result.scanned += yt.scanned;
  result.errors.push(...yt.errors);
  for (const f of yt.found) {
    if (storeCandidate(f, deps)) result.added += 1;
    else result.skipped += 1;
  }
  return result;
}
