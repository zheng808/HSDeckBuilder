import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import {
  canAddCard,
  type Card,
  type CardClass,
  type CardLookup,
  type DeckFormat,
} from '@hsdeck/shared';
import { useCards, useDeck } from '../api/hooks';
import { errorMessage, isApiError } from '../api/client';
import type { DecodeResponse } from '../api/types';
import { useBuilderStore } from '../store/builder-store';
import { ClassPicker } from '../components/ClassPicker';
import { FormatToggle } from '../components/FormatToggle';
import { CardFilters, EMPTY_FILTERS, type CardFilterState } from '../components/cards/CardFilters';
import { CardGrid } from '../components/cards/CardGrid';
import { DeckPanel } from '../components/deck/DeckPanel';
import { ImportDeckCodeDialog } from '../components/deck/ImportDeckCodeDialog';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { useToast } from '../components/ui/Toast';

const PAGE_SIZE = 60;

export function BuilderPage() {
  const { id } = useParams<{ id: string }>();
  const store = useBuilderStore();
  const deckQuery = useDeck(id);

  useEffect(() => {
    if (id && deckQuery.data && store.deckId !== id) store.loadDeck(deckQuery.data.deck);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, deckQuery.data]);

  // Continue editing the deck already in the store when the URL has no id.
  if (!id && store.deckId) return <Navigate to={`/build/${store.deckId}`} replace />;

  if (id && deckQuery.isError) {
    const err = deckQuery.error;
    const forbidden = isApiError(err) && (err.status === 403 || err.status === 401);
    return (
      <EmptyState
        title={forbidden ? 'This deck belongs to someone else' : 'Deck not found'}
        description={
          forbidden
            ? 'You can only edit decks created from this browser. Open the deck page and use "Open in builder" to make your own copy.'
            : errorMessage(err)
        }
      />
    );
  }
  if (id && (deckQuery.isPending || store.deckId !== id)) return <Spinner label="Loading deck" />;

  if (!store.heroClass) return <StartScreen />;
  return <Workbench heroClass={store.heroClass} />;
}

function StartScreen() {
  const store = useBuilderStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [cls, setCls] = useState<CardClass | null>(null);
  const [format, setFormat] = useState<DeckFormat>('STANDARD');
  const [importOpen, setImportOpen] = useState(false);

  const onImport = (decoded: DecodeResponse) => {
    store.importCards(decoded.heroClass, decoded.format, decoded.cards);
    navigate('/build', { replace: true });
    if (decoded.unknownDbfIds.length > 0)
      toast.error(`Some card ids were not recognised: ${decoded.unknownDbfIds.join(', ')}`);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">New deck</h1>
        <p className="text-sm text-ink-muted">
          Choose a class and a format. You can switch formats later.
        </p>
      </div>
      <FormatToggle value={format} onChange={setFormat} />
      <ClassPicker value={cls} onChange={setCls} />
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!cls} onClick={() => cls && store.start(cls, format)}>
          Start building
        </Button>
        <Button variant="secondary" onClick={() => setImportOpen(true)}>
          Import a deck code
        </Button>
      </div>
      <ImportDeckCodeDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={onImport}
      />
    </div>
  );
}

function Workbench({ heroClass }: { heroClass: CardClass }) {
  const store = useBuilderStore();
  const toast = useToast();
  const cardsQuery = useCards(heroClass);
  const [filters, setFilters] = useState<CardFilterState>(EMPTY_FILTERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const cardMap = useMemo(
    () => new Map((cardsQuery.data ?? []).map((c) => [c.dbfId, c])),
    [cardsQuery.data],
  );
  const lookup = useMemo<CardLookup>(() => (dbfId) => cardMap.get(dbfId), [cardMap]);

  const filtered = useMemo(() => {
    const all = cardsQuery.data ?? [];
    const q = filters.q.trim().toLowerCase();
    return all.filter((c) => {
      if (store.format === 'STANDARD' && !c.standard) return false;
      if (filters.owner === 'CLASS' && c.cardClass === 'NEUTRAL') return false;
      if (filters.owner === 'NEUTRAL' && c.cardClass !== 'NEUTRAL') return false;
      if (filters.cost !== null && (filters.cost === 7 ? c.cost < 7 : c.cost !== filters.cost))
        return false;
      if (filters.type && c.type !== filters.type) return false;
      if (filters.rarity && c.rarity !== filters.rarity) return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.text ?? '').toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [cardsQuery.data, filters, store.format]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [filters, store.format]);

  const inDeck = useMemo(() => new Map(store.cards.map((c) => [c.dbfId, c.count])), [store.cards]);
  const shape = { heroClass, format: store.format, cards: store.cards };
  const blockedReason = (card: Card) => {
    const r = canAddCard(shape, card, lookup);
    return r.ok ? undefined : r.reason;
  };
  const onAdd = (card: Card) => {
    const result = store.addCard(card, lookup);
    if (!result.ok && result.reason) toast.push(result.reason);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex flex-col gap-3" aria-label="Card browser">
        <CardFilters value={filters} onChange={setFilters} resultCount={filtered.length} />
        {cardsQuery.isPending && <Spinner label="Loading cards" />}
        {cardsQuery.isError && (
          <EmptyState title="Could not load cards" description={errorMessage(cardsQuery.error)} />
        )}
        {cardsQuery.data && (
          <CardGrid
            cards={filtered}
            visibleCount={visibleCount}
            onShowMore={() => setVisibleCount((n) => n + PAGE_SIZE)}
            inDeckCount={(dbfId) => inDeck.get(dbfId) ?? 0}
            blockedReason={blockedReason}
            onAdd={onAdd}
          />
        )}
      </section>
      <div className="lg:sticky lg:top-18 lg:self-start">
        <DeckPanel lookup={lookup} />
      </div>
    </div>
  );
}
