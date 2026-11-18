import { useLikeDeck, useMe, useUnlikeDeck } from '../../api/hooks';
import { errorMessage } from '../../api/client';
import { cn, formatCount } from '../../lib/format';
import { useToast } from '../ui/Toast';

interface LikeButtonProps {
  deckId: string;
  likes: number;
  liked: boolean;
  className?: string;
}

/** Heart toggle with count. Guests are told to sign in; nothing is colour-only. */
export function LikeButton({ deckId, likes, liked, className }: LikeButtonProps) {
  const me = useMe();
  const like = useLikeDeck();
  const unlike = useUnlikeDeck();
  const toast = useToast();
  const busy = like.isPending || unlike.isPending;
  const signedIn = Boolean(me.data?.user);

  const onClick = () => {
    if (!signedIn) {
      toast.push('Sign in to like decks. Use "Sign in" at the top right.');
      return;
    }
    const action = liked ? unlike : like;
    action.mutate(deckId, { onError: (err) => toast.error(errorMessage(err)) });
  };

  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={liked ? `Unlike this deck (${likes} likes)` : `Like this deck (${likes} likes)`}
      disabled={busy}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors disabled:opacity-50',
        liked
          ? 'border-gold bg-gold/15 text-ink'
          : 'border-line bg-surface-2 text-ink-muted hover:text-ink',
        className,
      )}
    >
      <span aria-hidden>{liked ? '♥' : '♡'}</span>
      <span>{liked ? 'Liked' : 'Like'}</span>
      <span className="text-ink-muted">{formatCount(likes)}</span>
    </button>
  );
}

/** Read-only like count for list cards. */
export function LikeCount({ likes, className }: { likes: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span aria-hidden>♥</span>
      <span>
        {formatCount(likes)} like{likes === 1 ? '' : 's'}
      </span>
    </span>
  );
}
