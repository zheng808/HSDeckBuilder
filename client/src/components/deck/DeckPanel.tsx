import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  DECK_SIZE,
  deckStats,
  encodeDeckstring,
  sortDeckEntries,
  validateDeck,
  type CardLookup,
  type DeckInput,
} from '@hsdeck/shared';
import { useCreateDeck, usePublishDeck, useUnpublishDeck, useUpdateDeck } from '../../api/hooks';
import { errorMessage } from '../../api/client';
import type { DecodeResponse } from '../../api/types';
import { getAuthorName, setAuthorName as persistAuthorName } from '../../lib/author-name';
import { classLabel } from '../../lib/class-meta';
import { useBuilderStore } from '../../store/builder-store';
import { FormatToggle } from '../FormatToggle';
import { ClassBadge } from '../ClassBadge';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { DeckMetaFields } from './DeckMetaFields';
import { DeckCardRow } from './DeckCardRow';
import { DeckValidation } from './DeckValidation';
import { ImportDeckCodeDialog } from './ImportDeckCodeDialog';
import { ManaCurve } from './ManaCurve';

interface DeckPanelProps {
  lookup: CardLookup;
}

export function DeckPanel({ lookup }: DeckPanelProps) {
  const store = useBuilderStore();
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateDeck();
  const update = useUpdateDeck();
  const publish = usePublishDeck();
  const unpublish = useUnpublishDeck();
  const [authorName, setAuthorNameState] = useState(getAuthorName);
  const [importOpen, setImportOpen] = useState(false);

  const heroClass = store.heroClass;
  const shape = useMemo(
    () => (heroClass ? { heroClass, format: store.format, cards: store.cards } : null),
    [heroClass, store.format, store.cards],
  );
  const draft = useMemo(
    () => (shape ? validateDeck(shape, lookup, { requireComplete: false }) : null),
    [shape, lookup],
  );
  const complete = useMemo(() => (shape ? validateDeck(shape, lookup) : null), [shape, lookup]);
  const stats = useMemo(() => deckStats(store.cards, lookup), [store.cards, lookup]);
  const sorted = useMemo(() => sortDeckEntries(store.cards, lookup), [store.cards, lookup]);

  if (!heroClass || !shape || !draft || !complete) return null;

  const busy = create.isPending || update.isPending || publish.isPending || unpublish.isPending;
  const defaultName = `${classLabel(heroClass)} deck`;

  const payload = (): DeckInput => ({
    name: store.name.trim() || defaultName,
    heroClass,
    format: store.format,
    cards: store.cards,
    description: store.description,
    authorName: authorName.trim() || 'Anonymous',
    archetype: store.archetype,
    basedOnId: store.basedOnId,
  });

  const save = async (): Promise<string> => {
    const body = payload();
    if (store.deckId) {
      const res = await update.mutateAsync({ id: store.deckId, patch: body });
      store.markSaved(res.deck);
      return res.deck.id;
    }
    const res = await create.mutateAsync(body);
    store.markSaved(res.deck);
    navigate(`/build/${res.deck.id}`, { replace: true });
    return res.deck.id;
  };

  const onSave = async () => {
    try {
      await save();
      toast.success('Deck saved.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const onPublish = async () => {
    try {
      const id = store.dirty || !store.deckId ? await save() : store.deckId;
      const res = await publish.mutateAsync(id);
      store.markSaved(res.deck);
      toast.success('Deck published!');
      navigate(`/decks/${id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const onUnpublish = async () => {
    if (!store.deckId) return;
    try {
      const res = await unpublish.mutateAsync(store.deckId);
      store.markSaved(res.deck);
      toast.push('Deck is now a private draft.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const onCopyCode = async () => {
    try {
      const code = encodeDeckstring({ format: store.format, heroClass, cards: store.cards });
      await navigator.clipboard.writeText(code);
      toast.success('Deck code copied to clipboard.');
    } catch {
      toast.error('Could not copy to the clipboard.');
    }
  };

  const onImport = (decoded: DecodeResponse) => {
    store.importCards(decoded.heroClass, decoded.format, decoded.cards);
    navigate('/build', { replace: true });
    if (decoded.unknownDbfIds.length > 0) {
      toast.error(
        `Imported, but ${decoded.unknownDbfIds.length} card id(s) were not recognised: ${decoded.unknownDbfIds.join(', ')}`,
      );
    } else {
      toast.success(`Imported ${decoded.cards.reduce((n, c) => n + c.count, 0)} cards.`);
    }
  };

  const onNewDeck = () => {
    if (store.dirty && !window.confirm('Discard unsaved changes and start a new deck?')) return;
    store.reset();
    navigate('/build');
  };

  return (
    <aside className="card-surface flex flex-col gap-3 p-3" aria-label="Your deck">
      <div className="flex items-center justify-between gap-2">
        <ClassBadge cls={heroClass} />
        <FormatToggle size="sm" value={store.format} onChange={store.setFormat} />
      </div>

      <DeckMetaFields
        defaultName={defaultName}
        authorName={authorName}
        onAuthorNameChange={(v) => {
          setAuthorNameState(v);
          persistAuthorName(v);
        }}
        lookup={lookup}
      />

      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold" aria-live="polite">
          {stats.cardCount}/{DECK_SIZE} cards
        </span>
        <span className="text-xs text-ink-muted">
          {stats.dustCost.toLocaleString()} dust · avg {stats.averageCost.toFixed(1)}
        </span>
      </div>

      <ManaCurve curve={stats.manaCurve} />

      <ul
        className="flex max-h-[45vh] flex-col gap-1 overflow-y-auto pr-1"
        aria-label="Cards in deck"
      >
        {sorted.length === 0 && (
          <li className="py-4 text-center text-sm text-ink-muted">
            Click cards on the left to add them.
          </li>
        )}
        {sorted.map((entry) => (
          <li key={entry.dbfId}>
            <DeckCardRow
              card={lookup(entry.dbfId)}
              dbfId={entry.dbfId}
              count={entry.count}
              onRemove={(id) => store.removeCard(id, lookup)}
            />
          </li>
        ))}
      </ul>

      <DeckValidation issues={draft.issues} cardCount={stats.cardCount} />

      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => void onSave()}
          loading={create.isPending || update.isPending}
          disabled={busy || !draft.ok}
        >
          {store.deckId ? 'Save' : 'Save draft'}
        </Button>
        {store.published ? (
          <Button
            variant="secondary"
            onClick={() => void onUnpublish()}
            loading={unpublish.isPending}
            disabled={busy}
          >
            Unpublish
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => void onPublish()}
            loading={publish.isPending}
            disabled={busy || !complete.ok}
            title={
              complete.ok
                ? 'Publish this deck for everyone'
                : complete.issues.map((i) => i.message).join(' ')
            }
          >
            Publish
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void onCopyCode()}
          disabled={store.cards.length === 0}
        >
          Copy deck code
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
          Import code
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={store.clearCards}
          disabled={store.cards.length === 0}
        >
          Clear cards
        </Button>
        <Button variant="ghost" size="sm" onClick={onNewDeck}>
          New deck
        </Button>
      </div>
      {store.deckId && store.published && (
        <Link
          to={`/decks/${store.deckId}`}
          className="text-center text-xs text-gold hover:underline"
        >
          View the published page
        </Link>
      )}
      {store.dirty && <p className="text-center text-xs text-ink-faint">Unsaved changes</p>}

      <ImportDeckCodeDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={onImport}
      />
    </aside>
  );
}
