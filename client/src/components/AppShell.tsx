import { NavLink, Outlet } from 'react-router';
import { cn } from '../lib/format';

const links = [
  { to: '/', label: 'Decks', end: true },
  { to: '/build', label: 'Build' },
  { to: '/my', label: 'My Decks' },
];

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <NavLink to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="inline-block size-3 rotate-45 bg-gold" aria-hidden />
            <span>
              HS <span className="text-gold">Deck Builder</span>
            </span>
          </NavLink>
          <nav aria-label="Main" className="flex items-center gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:text-ink',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-line py-4 text-center text-xs text-ink-faint">
        Card data and art from HearthstoneJSON. Hearthstone is a trademark of Blizzard
        Entertainment.
      </footer>
    </div>
  );
}
