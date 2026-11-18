import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { diffDecks, type CardLookup } from '@hsdeck/shared';
import { useDeck } from '../../api/hooks';
import { useBuilderStore } from '../../store/builder-store';
import { Button, buttonClasses } from '../ui/Button';
import { DeckDiffList } from './DeckDiffList';

/** "Based on X" strip in the builder with a compare toggle and a detach action. */
export function BasedOnPanel({ lookup }: { lookup: CardLookup }) {
  const basedOnId = useBuilderStore((s) => s.basedOnId);
  const cards = useBuilderStore((s) => s.cards);
  const detachBase = useBuilderStore((s) => s.detachBase);
  const base = useDeck(basedOnId ?? undefined);
  const [open, setOpen] = useState(false);
  const diff = useMemo(
    () => (base.data ? diffDecks(base.data.deck.cards, cards) : null),
    [base.data, cards],
  );

  if (!basedOnId) return null;

  return (
    <div className="rounded-md border border-line bg-bg/60 p-2 text-xs" aria-label="Base deck">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-ink-muted">
          Based on{' '}
          {base.data ? (
            <Link to={`/decks/${basedOnId}`} className="text-ink hover:underline">
              {base.data.deck.name}
            </Link>
          ) : base.isError ? (
            <span className="text-warning">a deck that is no longer visible</span>
          ) : (
            <span>…</span>
          )}
        </span>
        <div className="flex shrink-0 gap-1">
          {diff && (
            <button
              type="button"
              aria-expanded={open}
              className={buttonClasses('ghost', 'sm')}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? 'Hide' : 'Compare'}
            </button>
          )}
          <Button variant="ghost" size="sm" onClick={detachBase}>
            Detach
          </Button>
        </div>
      </div>
      {open && diff && <DeckDiffList diff={diff} lookup={lookup} className="mt-2" />}
    </div>
  );
}
