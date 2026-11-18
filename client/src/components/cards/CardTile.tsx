import { memo, useState } from 'react';
import type { Card } from '@hsdeck/shared';
import { cardRenderUrl } from '../../lib/card-art';
import { RARITY_COLOR } from '../../lib/class-meta';
import { cn } from '../../lib/format';

interface CardTileProps {
  card: Card;
  /** Copies already in the deck. */
  inDeck: number;
  /** Why the card can't be added right now (undefined when it can). */
  blockedReason?: string;
  onAdd: (card: Card) => void;
}

function CardTileImpl({ card, inDeck, blockedReason, onAdd }: CardTileProps) {
  const [failed, setFailed] = useState(false);
  const blocked = Boolean(blockedReason);
  const label = `${card.name}, ${card.cost} mana ${card.type.toLowerCase()}${inDeck ? `, ${inDeck} in deck` : ''}`;

  return (
    <button
      type="button"
      onClick={() => onAdd(card)}
      aria-disabled={blocked || undefined}
      aria-label={blocked ? `${label}. ${blockedReason}` : `Add ${label}`}
      title={blockedReason ?? `Add ${card.name}`}
      className={cn(
        'group relative aspect-[256/388] w-full rounded-lg transition-transform',
        blocked
          ? 'opacity-40'
          : 'hover:-translate-y-1 hover:drop-shadow-[0_0_10px_var(--color-gold)]',
      )}
    >
      {failed ? (
        <span className="card-surface flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
          <span className="rounded-full bg-mana px-2 text-sm font-bold text-white">
            {card.cost}
          </span>
          <span className="text-sm font-semibold" style={{ color: RARITY_COLOR[card.rarity] }}>
            {card.name}
          </span>
          {card.text && (
            <span className="line-clamp-4 text-[11px] text-ink-muted">
              {stripMarkup(card.text)}
            </span>
          )}
        </span>
      ) : (
        <img
          src={cardRenderUrl(card.id)}
          alt={card.name}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      )}
      {inDeck > 0 && (
        <span
          className="absolute top-1 right-3 rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-bg shadow"
          aria-hidden
        >
          ×{inDeck}
        </span>
      )}
    </button>
  );
}

function stripMarkup(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/[$#]/g, '')
    .replace(/\[x\]/g, '');
}

export const CardTile = memo(CardTileImpl);
