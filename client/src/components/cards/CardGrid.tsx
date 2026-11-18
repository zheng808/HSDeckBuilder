import type { Card } from '@hsdeck/shared';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { CardTile } from './CardTile';

interface CardGridProps {
  cards: Card[];
  visibleCount: number;
  onShowMore: () => void;
  inDeckCount: (dbfId: number) => number;
  blockedReason: (card: Card) => string | undefined;
  onAdd: (card: Card) => void;
}

export function CardGrid({
  cards,
  visibleCount,
  onShowMore,
  inDeckCount,
  blockedReason,
  onAdd,
}: CardGridProps) {
  if (cards.length === 0) {
    return (
      <EmptyState
        title="No cards match"
        description="Try clearing a filter or searching for something else."
      />
    );
  }
  const visible = cards.slice(0, visibleCount);
  return (
    <div className="flex flex-col gap-4">
      <ul
        className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2"
        aria-label="Card results"
      >
        {visible.map((card) => (
          <li key={card.dbfId}>
            <CardTile
              card={card}
              inDeck={inDeckCount(card.dbfId)}
              blockedReason={blockedReason(card)}
              onAdd={onAdd}
            />
          </li>
        ))}
      </ul>
      {visible.length < cards.length && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={onShowMore}>
            Show more ({cards.length - visible.length} left)
          </Button>
        </div>
      )}
    </div>
  );
}
