import type { DeckSource, DeckSourceType } from '@hsdeck/shared';
import { cn } from '../../lib/format';

const GLYPH: Record<DeckSourceType, string> = {
  tournament: '🏆',
  streamer: '📺',
  creator: '▶',
  community: '👥',
};

export const SOURCE_TYPE_LABEL: Record<DeckSourceType, string> = {
  tournament: 'Tournament',
  streamer: 'Streamer',
  creator: 'Creator',
  community: 'Community',
};

/** Compact provenance badge for imported pro lists. Always carries text. */
export function SourceBadge({ source, className }: { source: DeckSource; className?: string }) {
  const main = source.event ?? source.name;
  const title = [SOURCE_TYPE_LABEL[source.type], source.name, source.event, source.placement]
    .filter(Boolean)
    .join(' · ');
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[11px] font-medium text-ink',
        className,
      )}
      title={title}
    >
      <span aria-hidden>{GLYPH[source.type]}</span>
      <span className="sr-only">{SOURCE_TYPE_LABEL[source.type]}: </span>
      <span className="truncate">{main}</span>
      {source.placement && <span className="shrink-0 text-ink-muted">· {source.placement}</span>}
    </span>
  );
}
