const ART_BASE = 'https://art.hearthstonejson.com/v1';

/** Full card render (256 x 388 px). */
export function cardRenderUrl(cardId: string): string {
  return `${ART_BASE}/render/latest/enUS/256x/${encodeURIComponent(cardId)}.png`;
}

/** Wide tile strip (256 x 59 px) used behind deck list rows. */
export function cardTileUrl(cardId: string): string {
  return `${ART_BASE}/tiles/${encodeURIComponent(cardId)}.png`;
}
