import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  DECK_SIZE,
  sortDeckEntries,
  type CardLookup,
  type Deck,
  type DeckSource,
} from '@hsdeck/shared';
import { useCards, useDeck } from '../api/hooks';
import { errorMessage } from '../api/client';
import { relativeTime, titleCase, viewsLabel } from '../lib/format';
import { useBuilderStore } from '../store/builder-store';
import { ClassBadge } from '../components/ClassBadge';
import { FormatBadge } from '../components/FormatBadge';
import { DeckCardRow } from '../components/deck/DeckCardRow';
import { DeckDiffList } from '../components/deck/DeckDiffList';
import { ManaCurve } from '../components/deck/ManaCurve';
import { SourceBadge } from '../components/deck/SourceBadge';
import { Button, buttonClasses } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { useToast } from '../components/ui/Toast';

export function DeckPage() {
  const { id } = useParams<{ id: string }>();
  const deckQuery = useDeck(id);
  const deck = deckQuery.data?.deck;
  const cardsQuery = useCards(deck?.heroClass ?? null);
  const navigate = useNavigate();
  const toast = useToast();
  const cloneDeck = useBuilderStore((s) => s.cloneDeck);

  const cardMap = useMemo(
    () => new Map((cardsQuery.data ?? []).map((c) => [c.dbfId, c])),
    [cardsQuery.data],
  );
  const lookup = useMemo<CardLookup>(() => (dbfId) => cardMap.get(dbfId), [cardMap]);
  const sorted = useMemo(() => (deck ? sortDeckEntries(deck.cards, lookup) : []), [deck, lookup]);

  if (deckQuery.isPending) return <Spinner label="Loading deck" />;
  if (deckQuery.isError || !deck) {
    return (
      <EmptyState
        title="Deck not found"
        description={
          deckQuery.error ? errorMessage(deckQuery.error) : 'This deck may be private or deleted.'
        }
      />
    );
  }
  const { deckCode, stats, validation, isOwner: isMine, basedOn, diff } = deckQuery.data;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(deckCode);
      toast.success('Deck code copied to clipboard.');
    } catch {
      toast.error('Could not copy to the clipboard.');
    }
  };
  const openInBuilder = (d: Deck) => {
    cloneDeck(d);
    navigate('/build');
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="card-surface flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{deck.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              <ClassBadge cls={deck.heroClass} />
              {deck.archetype && <span className="text-ink">{deck.archetype}</span>}
              <FormatBadge format={deck.format} />
              {deck.source && <SourceBadge source={deck.source} />}
              <span>by {deck.authorName}</span>
              <span>{viewsLabel(deck.views)}</span>
              <span>updated {relativeTime(deck.updatedAt)}</span>
              {!deck.published && (
                <span className="rounded bg-surface-3 px-1.5 text-xs">Draft</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void copyCode()}>
              Copy deck code
            </Button>
            <Button onClick={() => openInBuilder(deck)}>Open in builder</Button>
            {isMine && (
              <Link to={`/build/${deck.id}`} className={buttonClasses('ghost')}>
                Edit
              </Link>
            )}
          </div>
        </div>
        {deck.source && <SourceLine source={deck.source} />}
        {deck.description && (
          <p className="text-sm whitespace-pre-line text-ink">{deck.description}</p>
        )}
        {!validation.ok && (
          <ul className="flex flex-col gap-1 text-sm text-warning" aria-label="Deck problems">
            {validation.issues.map((i, idx) => (
              <li key={`${i.code}-${idx}`}>⚠ {i.message}</li>
            ))}
          </ul>
        )}
        <details className="text-xs text-ink-muted">
          <summary className="cursor-pointer select-none">Show deck code</summary>
          <code className="mt-1 block break-all rounded bg-bg p-2 font-mono text-ink">
            {deckCode}
          </code>
        </details>
      </header>

      {basedOn && diff && (
        <section className="card-surface flex flex-col gap-1 p-4" aria-label="Based on">
          <h2 className="text-sm font-semibold">
            Based on{' '}
            <Link to={`/decks/${basedOn.id}`} className="text-gold hover:underline">
              {basedOn.name}
            </Link>
          </h2>
          <p className="text-xs text-ink-muted">by {basedOn.authorName}</p>
          <DeckDiffList diff={diff} lookup={lookup} className="mt-1" />
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Cards">
          {cardsQuery.isPending && <Spinner label="Loading cards" />}
          {cardsQuery.data && (
            <ul className="grid gap-1 sm:grid-cols-2">
              {sorted.map((entry) => (
                <li key={entry.dbfId}>
                  <DeckCardRow card={lookup(entry.dbfId)} dbfId={entry.dbfId} count={entry.count} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="card-surface flex flex-col gap-4 p-4" aria-label="Deck statistics">
          <ManaCurve curve={stats.manaCurve} />
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-ink-muted">Cards</dt>
            <dd>
              {stats.cardCount}/{DECK_SIZE}
            </dd>
            <dt className="text-ink-muted">Dust</dt>
            <dd>{stats.dustCost.toLocaleString()}</dd>
            <dt className="text-ink-muted">Average cost</dt>
            <dd>{stats.averageCost.toFixed(2)}</dd>
            {Object.entries(stats.typeCounts).map(([type, n]) => (
              <StatRow key={type} label={pluralType(type)} value={n} />
            ))}
            {Object.entries(stats.rarityCounts).map(([rarity, n]) => (
              <StatRow key={rarity} label={titleCase(rarity)} value={n} />
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}

function SourceLine({ source }: { source: DeckSource }) {
  return (
    <p className="text-sm text-ink-muted">
      Played by <span className="text-ink">{source.name}</span>
      {source.event && <> at {source.event}</>}
      {source.placement && <> · {source.placement}</>}
      {source.url && (
        <>
          {' '}
          · via{' '}
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:underline"
          >
            source
          </a>
        </>
      )}
    </p>
  );
}

const TYPE_PLURALS: Record<string, string> = {
  MINION: 'Minions',
  SPELL: 'Spells',
  WEAPON: 'Weapons',
  HERO: 'Heroes',
  LOCATION: 'Locations',
};
const pluralType = (type: string) => TYPE_PLURALS[type] ?? titleCase(type) + 's';

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
