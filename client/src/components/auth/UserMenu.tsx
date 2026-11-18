import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useLogout, useMe } from '../../api/hooks';
import { errorMessage } from '../../api/client';
import { cn } from '../../lib/format';
import { Button, buttonClasses } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { Avatar } from './Avatar';
import { SignInLinks } from './SignInLinks';

/** Sign-in popover for guests; avatar menu for signed-in users. Mounted in the top nav. */
export function UserMenu() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);

  // Close when navigating, clicking outside, or pressing Escape.
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (me.isPending)
    return <span className="h-8 w-20 animate-pulse rounded-md bg-surface-2" aria-hidden />;
  const user = me.data?.user ?? null;

  return (
    <div ref={rootRef} className="relative">
      {user ? (
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium transition-colors hover:bg-surface-2',
            open && 'bg-surface-2',
          )}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Avatar name={user.name} src={user.avatarUrl} size="sm" />
          <span className="max-w-32 truncate">{user.name}</span>
        </button>
      ) : (
        <button
          type="button"
          className={buttonClasses('secondary', 'sm')}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          Sign in
        </button>
      )}
      {open && (
        <div
          className="card-surface absolute right-0 z-50 mt-2 w-60 p-2 shadow-lg"
          role={user ? 'menu' : 'dialog'}
          aria-label={user ? 'Account menu' : 'Sign in'}
        >
          {user ? <SignedInMenu userId={user.id} isAdmin={user.isAdmin} /> : <GuestPanel />}
        </div>
      )}
    </div>
  );
}

function GuestPanel() {
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-xs text-ink-muted">
        Sign in to keep your decks across devices and like other people&apos;s lists.
      </p>
      <SignInLinks className="flex flex-col gap-1.5" />
    </div>
  );
}

function SignedInMenu({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const logout = useLogout();
  const toast = useToast();
  const item =
    'block w-full rounded px-2 py-1.5 text-left text-sm text-ink-muted hover:bg-surface-2 hover:text-ink';
  return (
    <div className="flex flex-col">
      <Link to="/my" role="menuitem" className={item}>
        My decks
      </Link>
      <Link to={`/users/${userId}`} role="menuitem" className={item}>
        Profile
      </Link>
      {isAdmin && (
        <Link to="/admin/pro-queue" role="menuitem" className={item}>
          Pro queue
        </Link>
      )}
      <hr className="my-1 border-line" />
      <Button
        variant="ghost"
        size="sm"
        role="menuitem"
        className="justify-start"
        loading={logout.isPending}
        onClick={() =>
          logout.mutate(undefined, {
            onSuccess: () => toast.push('Signed out.'),
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      >
        Sign out
      </Button>
    </div>
  );
}
