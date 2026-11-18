import type { CardLookup, DeckDiff } from '@hsdeck/shared';
import { cn } from '../../lib/format';

interface DeckDiffListProps {
  diff: DeckDiff;
  lookup: CardLookup;
  className?: string;
}

/** Added/removed cards of a remix relative to its base list. Text carries the meaning; colour is decoration. */
export function DeckDiffList({ diff, lookup, className }: DeckDiffListProps) {
  const nameOf = (dbfId: number) => lookup(dbfId)?.name ?? `Unknown card #${dbfId}`;
  if (diff.changedCards === 0) {
    return <p className={cn('text-xs text-ink-muted', className)}>Identical to the base list.</p>;
  }
  return (
    <div className={cn('flex flex-col gap-2 text-sm', className)}>
      <p className="text-xs text-ink-muted">
        {diff.changedCards} card{diff.changedCards === 1 ? '' : 's'} changed
      </p>
      {diff.added.length > 0 && (
        <DiffGroup
          title="Added"
          sign="+"
          entries={diff.added}
          nameOf={nameOf}
          tone="text-success"
        />
      )}
      {diff.removed.length > 0 && (
        <DiffGroup
          title="Removed"
          sign="−"
          entries={diff.removed}
          nameOf={nameOf}
          tone="text-danger"
        />
      )}
    </div>
  );
}

function DiffGroup({
  title,
  sign,
  entries,
  nameOf,
  tone,
}: {
  title: string;
  sign: string;
  entries: DeckDiff['added'];
  nameOf: (dbfId: number) => string;
  tone: string;
}) {
  return (
    <div>
      <h4 className={cn('text-[11px] font-semibold tracking-wide uppercase', tone)}>{title}</h4>
      <ul className="mt-0.5 flex flex-col gap-0.5">
        {entries.map((e) => (
          <li key={e.dbfId} className="flex gap-1.5">
            <span className={cn('w-3 shrink-0 text-center font-mono', tone)} aria-hidden>
              {sign}
            </span>
            <span className="sr-only">{title}:</span>
            <span>
              {e.count}× {nameOf(e.dbfId)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
