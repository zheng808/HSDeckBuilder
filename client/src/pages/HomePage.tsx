import { Link, useSearchParams } from 'react-router';
import { CARD_CLASSES, type CardClass, type DeckFormat, type DeckKind } from '@hsdeck/shared';
import { useArchetypes, useDecks } from '../api/hooks';
import { errorMessage } from '../api/client';
import { classColor, classLabel, isCardClass } from '../lib/class-meta';
import { cn } from '../lib/format';
import { DeckSummaryCard } from '../components/deck/DeckSummaryCard';
import { buttonClasses } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Spinner } from '../components/ui/Spinner';

type FormatFilter = DeckFormat | 'ALL';
type Sort = 'newest' | 'popular';

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const cls = isCardClass(params.get('class')) ? (params.get('class') as CardClass) : undefined;
  const formatParam = params.get('format');
  const format: FormatFilter =
    formatParam === 'STANDARD' || formatParam === 'WILD' ? formatParam : 'ALL';
  const q = params.get('q') ?? '';
  const sort: Sort = params.get('sort') === 'popular' ? 'popular' : 'newest';
  const kindParam = params.get('kind');
  const kind: DeckKind = kindParam === 'pro' || kindParam === 'community' ? kindParam : 'all';
  const archetype = params.get('archetype') ?? undefined;

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const decks = useDecks({
    class: cls,
    format: format === 'ALL' ? undefined : format,
    q: q || undefined,
    kind: kind === 'all' ? undefined : kind,
    archetype,
    sort,
    limit: 60,
  });
  const archetypes = useArchetypes();
  const topArchetypes = (archetypes.data?.items ?? []).slice(0, 12);

  return (
    <div className="flex flex-col gap-6">
      <section className="card-surface flex flex-col gap-4 bg-gradient-to-br from-surface to-surface-2 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Build. Publish. <span className="text-gold">Share.</span>
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            Pick a class, fill 30 slots with legal cards, and publish your Standard or Wild deck for
            everyone to copy with a single deck code.
          </p>
        </div>
        <Link to="/build" className={buttonClasses('primary', 'md')}>
          Build a deck
        </Link>
      </section>

      <section className="flex flex-col gap-3" aria-label="Browse published decks">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="deck-search">
            Search decks
          </label>
          <input
            id="deck-search"
            type="search"
            placeholder="Search deck or author…"
            value={q}
            onChange={(e) => setParam('q', e.target.value || undefined)}
            className="h-9 min-w-56 flex-1 rounded-md border border-line bg-surface px-3 text-sm placeholder:text-ink-faint focus:border-gold md:max-w-xs"
          />
          <SegmentedControl<DeckKind>
            label="Deck kind"
            size="sm"
            value={kind}
            onChange={(v) => setParam('kind', v === 'all' ? undefined : v)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'pro', label: 'Pro lists' },
              { value: 'community', label: 'Community' },
            ]}
          />
          <SegmentedControl<FormatFilter>
            label="Format"
            size="sm"
            value={format}
            onChange={(v) => setParam('format', v === 'ALL' ? undefined : v)}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'STANDARD', label: 'Standard' },
              { value: 'WILD', label: 'Wild' },
            ]}
          />
          <SegmentedControl<Sort>
            label="Sort"
            size="sm"
            value={sort}
            onChange={(v) => setParam('sort', v === 'newest' ? undefined : v)}
            options={[
              { value: 'newest', label: 'Newest' },
              { value: 'popular', label: 'Popular' },
            ]}
          />
        </div>
        <div role="group" aria-label="Filter by class" className="flex flex-wrap gap-1.5">
          <ClassChip
            label="All classes"
            active={!cls}
            onClick={() => setParam('class', undefined)}
          />
          {CARD_CLASSES.map((c) => (
            <ClassChip
              key={c}
              label={classLabel(c)}
              color={classColor(c)}
              active={cls === c}
              onClick={() => setParam('class', c)}
            />
          ))}
        </div>

        {(topArchetypes.length > 0 || archetype) && (
          <div role="group" aria-label="Filter by archetype" className="flex flex-wrap gap-1.5">
            <ClassChip
              label="All archetypes"
              active={!archetype}
              onClick={() => setParam('archetype', undefined)}
            />
            {topArchetypes.map((a) => (
              <ClassChip
                key={a.archetype}
                label={`${a.archetype} (${a.count})`}
                active={archetype === a.archetype}
                onClick={() => setParam('archetype', a.archetype)}
              />
            ))}
            {archetype && !topArchetypes.some((a) => a.archetype === archetype) && (
              <ClassChip
                label={archetype}
                active
                onClick={() => setParam('archetype', undefined)}
              />
            )}
          </div>
        )}

        {decks.isPending && <Spinner label="Loading decks" />}
        {decks.isError && (
          <EmptyState title="Could not load decks" description={errorMessage(decks.error)} />
        )}
        {decks.data && decks.data.items.length === 0 && kind === 'pro' && (
          <EmptyState
            title="No pro lists yet"
            description="Tournament, streamer and creator lists are imported by the site owner. Check back after the next event, or browse community decks."
          />
        )}
        {decks.data && decks.data.items.length === 0 && kind !== 'pro' && (
          <EmptyState
            title="No published decks yet"
            description="Be the first: build a deck and hit Publish."
            action={
              <Link to="/build" className={buttonClasses('secondary', 'sm')}>
                Start building
              </Link>
            }
          />
        )}
        {decks.data && decks.data.items.length > 0 && (
          <>
            <p className="text-xs text-ink-faint">
              {decks.data.total} published deck{decks.data.total === 1 ? '' : 's'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {decks.data.items.map((d) => (
                <DeckSummaryCard key={d.id} deck={d} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ClassChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active ? 'border-gold bg-gold/15 text-ink' : 'border-line text-ink-muted hover:text-ink',
      )}
    >
      {color && (
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      )}
      {label}
    </button>
  );
}
