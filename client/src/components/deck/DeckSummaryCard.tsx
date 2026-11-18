import { Link } from 'react-router';
import { DECK_SIZE, type DeckSummary } from '@hsdeck/shared';
import { classColor } from '../../lib/class-meta';
import { relativeTime, viewsLabel } from '../../lib/format';
import { ClassBadge } from '../ClassBadge';
import { FormatBadge } from '../FormatBadge';
import { AuthorLink } from './AuthorLink';
import { LikeCount } from './LikeButton';
import { SourceBadge } from './SourceBadge';

export function DeckSummaryCard({ deck }: { deck: DeckSummary }) {
  return (
    <Link
      to={`/decks/${deck.id}`}
      className="card-surface flex gap-3 overflow-hidden transition-colors hover:bg-surface-2"
      aria-label={`${deck.name}, ${deck.heroClass.toLowerCase()} deck by ${deck.authorName}`}
    >
      <span
        className="w-1.5 shrink-0"
        style={{ backgroundColor: classColor(deck.heroClass) }}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-3 pr-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-semibold">{deck.name}</h3>
          <FormatBadge format={deck.format} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <ClassBadge cls={deck.heroClass} className="text-xs" />
          {deck.archetype && <span className="text-ink">{deck.archetype}</span>}
          <AuthorLink author={deck.author} fallbackName={deck.authorName} asLink={false} />
        </div>
        {deck.source && (
          <div className="flex">
            <SourceBadge source={deck.source} />
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-ink-faint">
          <span>
            {deck.cardCount}/{DECK_SIZE} cards
          </span>
          <span>{viewsLabel(deck.views)}</span>
          <LikeCount likes={deck.likes ?? 0} />
          <span className="ml-auto">{relativeTime(deck.updatedAt)}</span>
          {!deck.published && (
            <span className="rounded bg-surface-3 px-1.5 text-ink-muted">Draft</span>
          )}
        </div>
      </div>
    </Link>
  );
}
