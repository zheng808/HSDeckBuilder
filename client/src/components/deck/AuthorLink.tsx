import { Link } from 'react-router';
import type { DeckAuthor } from '@hsdeck/shared';
import { cn } from '../../lib/format';
import { Avatar } from '../auth/Avatar';

interface AuthorLinkProps {
  author: DeckAuthor | null | undefined;
  /** Shown when the deck has no account author. */
  fallbackName: string;
  /** Render as a link to the profile. Pass false inside another link (no nested anchors). */
  asLink?: boolean;
  className?: string;
}

/** "by <avatar> Name" linking to the author's profile, or plain text for anonymous decks. */
export function AuthorLink({ author, fallbackName, asLink = true, className }: AuthorLinkProps) {
  if (!author) return <span className={className}>by {fallbackName}</span>;
  const inner = (
    <>
      <span>by</span>
      <Avatar name={author.name} src={author.avatarUrl} size="sm" />
      <span className="truncate text-ink">{author.name}</span>
    </>
  );
  const base = cn('inline-flex max-w-full items-center gap-1', className);
  if (!asLink) return <span className={base}>{inner}</span>;
  return (
    <Link to={`/users/${author.id}`} className={cn(base, 'hover:underline')}>
      {inner}
    </Link>
  );
}
