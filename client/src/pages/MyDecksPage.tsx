import { Link } from 'react-router';
import { DECK_SIZE, type DeckSummary } from '@hsdeck/shared';
import { useDeleteDeck, useMe, useMyDecks, usePublishDeck, useUnpublishDeck } from '../api/hooks';
import { errorMessage } from '../api/client';
import { classColor } from '../lib/class-meta';
import { relativeTime, viewsLabel } from '../lib/format';
import { ClassBadge } from '../components/ClassBadge';
import { FormatBadge } from '../components/FormatBadge';
import { SignInLinks } from '../components/auth/SignInLinks';
import { AuthorLink } from '../components/deck/AuthorLink';
import { SourceBadge } from '../components/deck/SourceBadge';
import { Button, buttonClasses } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { useToast } from '../components/ui/Toast';

export function MyDecksPage() {
  const decks = useMyDecks();
  const me = useMe();
  const signedIn = Boolean(me.data?.user);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My decks</h1>
          <p className="text-sm text-ink-muted">
            {signedIn
              ? 'Your decks. Drafts are private until you publish them.'
              : 'Decks created from this browser. Drafts are private until you publish them.'}
          </p>
        </div>
        <Link to="/build" className={buttonClasses('primary', 'sm')}>
          New deck
        </Link>
      </div>
      {me.data && !signedIn && (
        <div className="card-surface flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">
            Decks on this device are tied to this browser.{' '}
            <span className="text-ink-muted">Sign in to keep them across devices.</span>
          </p>
          <SignInLinks returnTo="/my" />
        </div>
      )}
      {decks.isPending && <Spinner label="Loading your decks" />}
      {decks.isError && (
        <EmptyState title="Could not load your decks" description={errorMessage(decks.error)} />
      )}
      {decks.data && decks.data.items.length === 0 && (
        <EmptyState
          title="No decks yet"
          description="Build one and save it as a draft, or import a deck code."
          action={
            <Link to="/build" className={buttonClasses('secondary', 'sm')}>
              Build a deck
            </Link>
          }
        />
      )}
      {decks.data && decks.data.items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {decks.data.items.map((d) => (
            <li key={d.id}>
              <DeckRow deck={d} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeckRow({ deck }: { deck: DeckSummary }) {
  const toast = useToast();
  const publish = usePublishDeck();
  const unpublish = useUnpublishDeck();
  const remove = useDeleteDeck();
  const busy = publish.isPending || unpublish.isPending || remove.isPending;
  const complete = deck.cardCount === DECK_SIZE;

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="card-surface flex flex-wrap items-center gap-3 overflow-hidden pr-3">
      <span
        className="h-14 w-1.5 shrink-0 self-stretch"
        style={{ backgroundColor: classColor(deck.heroClass) }}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
        <div className="flex items-center gap-2">
          <Link
            to={deck.published ? `/decks/${deck.id}` : `/build/${deck.id}`}
            className="truncate font-semibold hover:underline"
          >
            {deck.name}
          </Link>
          <FormatBadge format={deck.format} />
          <span
            className={
              deck.published
                ? 'rounded bg-success/15 px-1.5 text-xs text-success'
                : 'rounded bg-surface-3 px-1.5 text-xs text-ink-muted'
            }
          >
            {deck.published ? 'Published' : 'Draft'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <ClassBadge cls={deck.heroClass} className="text-xs" />
          {deck.archetype && <span className="text-ink">{deck.archetype}</span>}
          {deck.source && <SourceBadge source={deck.source} />}
          {deck.author && <AuthorLink author={deck.author} fallbackName={deck.authorName} />}
          <span>
            {deck.cardCount}/{DECK_SIZE} cards
          </span>
          <span>{viewsLabel(deck.views)}</span>
          <span>updated {relativeTime(deck.updatedAt)}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Link to={`/build/${deck.id}`} className={buttonClasses('secondary', 'sm')}>
          Edit
        </Link>
        {deck.published ? (
          <>
            <Link to={`/decks/${deck.id}`} className={buttonClasses('ghost', 'sm')}>
              View
            </Link>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void run(() => unpublish.mutateAsync(deck.id), 'Deck unpublished.')}
            >
              Unpublish
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || !complete}
            title={complete ? 'Publish this deck' : `Needs ${DECK_SIZE} cards to publish`}
            onClick={() => void run(() => publish.mutateAsync(deck.id), 'Deck published!')}
          >
            Publish
          </Button>
        )}
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`Delete "${deck.name}"? This cannot be undone.`))
              void run(() => remove.mutateAsync(deck.id), 'Deck deleted.');
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
