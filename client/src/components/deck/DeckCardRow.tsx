import type { Card } from '@hsdeck/shared';
import { cardTileUrl } from '../../lib/card-art';
import { RARITY_COLOR } from '../../lib/class-meta';
import { cn } from '../../lib/format';

interface DeckCardRowProps {
  card?: Card;
  dbfId: number;
  count: number;
  /** When provided the row is a button that removes one copy. */
  onRemove?: (dbfId: number) => void;
}

export function DeckCardRow({ card, dbfId, count, onRemove }: DeckCardRowProps) {
  const name = card?.name ?? `Unknown card #${dbfId}`;
  const legendary = card?.rarity === 'LEGENDARY';
  const countLabel = legendary && count === 1 ? '★' : `×${count}`;
  const content = (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mana text-xs font-bold text-white">
        {card?.cost ?? '?'}
      </span>
      <span
        className="min-w-0 flex-1 truncate text-sm font-semibold"
        style={{ color: card ? RARITY_COLOR[card.rarity] : 'var(--color-danger)' }}
      >
        {name}
      </span>
      <span
        className="shrink-0 rounded bg-bg/80 px-1.5 text-xs font-bold text-gold"
        aria-label={`${count} ${count === 1 ? 'copy' : 'copies'}`}
      >
        {countLabel}
      </span>
    </>
  );
  const className = cn(
    'flex h-9 w-full items-center gap-2 rounded-md border border-line bg-surface-2 bg-cover bg-right px-2 text-left',
    onRemove && 'transition-colors hover:border-danger/60',
  );
  const style = card
    ? {
        backgroundImage: `linear-gradient(90deg, rgba(20,22,28,.97) 45%, rgba(20,22,28,.35)), url(${cardTileUrl(card.id)})`,
      }
    : undefined;

  if (!onRemove) {
    return (
      <div
        className={className}
        style={style}
        title={card ? `${name} (${card.rarity.toLowerCase()})` : undefined}
      >
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => onRemove(dbfId)}
      aria-label={`Remove one ${name} (${count} in deck)`}
      title={`Remove ${name}`}
    >
      {content}
    </button>
  );
}
