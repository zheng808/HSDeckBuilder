# Brainstorm & roadmap

## The product in one sentence

A fast, no-signup Hearthstone deck builder where you pick a class, drag 30 legal cards together, publish, and share a link or deck code.

## MVP (built)

- Class picker (11 classes) and Standard / Wild toggle.
- Card browser with search, cost, type and rarity filters; lazy card art.
- Deck panel: live count, copy limits, class legality, rune limit, mana curve, dust cost.
- Save drafts, publish complete decks, unpublish, delete.
- Public deck page with deck code copy; "open in builder" to clone.
- Import a deck code from the game.
- Home page: browse published decks by class, format, search, newest/popular.

## Next

Tracked as a prioritised backlog in [BACKLOG.md](BACKLOG.md): Epic A publishes the repo to a personal GitHub account and deploys it; Epic B holds the product features listed below in rough value order.

## Ideas parked

- Collection import (needs Blizzard OAuth) → "craftable with my dust" filter.
- Meta snapshots / win rates (no public data source without HSReplay partnership).
- Live draft (Arena) mode.

## Stack brainstorm (why this one)

- **Frontend**: React + Vite + Tailwind. Considered Next.js (server components, heavier), Remix/React Router framework mode (fine, but SPA is enough), SvelteKit (not the requested React).
- **Backend**: Hono + `node:sqlite`. Considered Express + Prisma + Postgres (great for growth, overkill today), Fastify (fine), NestJS (too much ceremony), Supabase (hosted dependency, lock-in for a hobby app).
- **Data**: HearthstoneJSON for cards and art (free, no key). Blizzard API needs OAuth and has rate limits; HSReplay is private.
- **Monorepo**: npm workspaces (already installed); pnpm/turbo can come later.
