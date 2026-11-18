import { useParams } from 'react-router';
import { useProfile } from '../api/hooks';
import { errorMessage, isApiError } from '../api/client';
import { Avatar } from '../components/auth/Avatar';
import { DeckSummaryCard } from '../components/deck/DeckSummaryCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';

export function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const profile = useProfile(id);

  if (profile.isPending) return <Spinner label="Loading profile" />;
  if (profile.isError || !profile.data) {
    const notFound = isApiError(profile.error) && profile.error.status === 404;
    return (
      <EmptyState
        title={notFound ? 'User not found' : 'Could not load profile'}
        description={
          notFound ? 'This profile does not exist or was removed.' : errorMessage(profile.error)
        }
      />
    );
  }
  const { user, decks } = profile.data;
  const since = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="card-surface flex items-center gap-4 p-5">
        <Avatar name={user.name} src={user.avatarUrl} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{user.name}</h1>
          <p className="text-sm text-ink-muted">
            Member since {since} · {decks.length} published deck{decks.length === 1 ? '' : 's'}
          </p>
        </div>
      </header>
      <section aria-label={`Decks by ${user.name}`}>
        {decks.length === 0 ? (
          <EmptyState title="No published decks yet" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((d) => (
              <DeckSummaryCard key={d.id} deck={d} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
