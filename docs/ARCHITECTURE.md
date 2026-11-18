# Architecture

## Goals

Small, understandable, runnable in one command, with the deck-building rules in exactly one place. No accounts, no cloud services, no native modules.

## Shape

```
browser ──(fetch /api, x-owner-token)──▶ Hono API ──▶ node:sqlite (decks.db)
   │                                        │
   │ imports @hsdeck/shared                 │ imports @hsdeck/shared
   ▼                                        ▼
 validate / stats / deck code         validate / stats / deck code
                                            │
                                            └─▶ CardStore (server/data/cards.json in memory)
```

### shared/ — the domain

- `types.ts`: `Card`, `Deck`, `DeckSummary`, enums.
- `constants.ts`: deck size, copy limits, `STANDARD_SETS` (rotation), default hero ids, dust costs.
- `deck-rules.ts`: `validateDeck(deck, lookup, {requireComplete})` returns coded issues; `canAddCard` for the builder; `deckStats` for curve/dust/averages; immutable `addCardEntry`/`removeCardEntry`.
- `deckstring.ts`: Hearthstone deck-code codec (varint + base64), tolerant of sideboard bytes.
- `schemas.ts`: zod schemas for every request body and query string. The server validates with them; the client types against them.

Consumed as TypeScript source (`main: src/index.ts`): tsx runs it on the server, Vite bundles it for the browser. No build step.

### server/

- `app.ts` composes CORS, logging, routes, the error handler, and (in production) static serving of `client/dist` with SPA fallback.
- `cards/card-store.ts`: loads the trimmed card dump, computes `standard` from `STANDARD_SETS`, links same-name reprints (`countAsCopyOfDbfId`) and hides non-canonical prints from browsing.
- `decks/deck-repo.ts`: SQLite CRUD; cards are stored as JSON in a column (decks are read whole, never queried by card).
- `decks/deck-routes.ts`: drafts validated with `requireComplete:false`, publish with `true`; the response envelope always includes `deckCode`, `validation`, `stats` so the client never recomputes server truth.
- Ownership: SHA-256 of the `x-owner-token` header stored per deck. Drafts are 404 to anyone else (no existence leak).

### client/

- Routing: `/` (published decks), `/build` + `/build/:id` (builder), `/decks/:id` (public view), `/my` (your decks).
- Server state: TanStack Query hooks (`src/api/hooks.ts`); cards for a class+format are fetched once and filtered in memory.
- Builder state: zustand store; every add goes through `canAddCard` so the UI explains refusals.
- Deck codes: encoded client-side for copy; decoded server-side so hero skins resolve to a class.

## Decisions and alternatives considered

| Decision                                  | Why                                                                                      | Alternative rejected                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Vite + React SPA with a separate Hono API | Clear API boundary, trivial deploy (one Node process serves both), easy to swap UI later | Next.js full-stack: more framework surface than the problem needs            |
| Hono                                      | Tiny, typed, Web-standard Request/Response, `app.request()` makes tests trivial          | Express (callback style, weaker types), Fastify (more config)                |
| `node:sqlite`                             | Zero dependencies, zero native build, single file DB                                     | Prisma/Drizzle + better-sqlite3 (codegen or native builds for a 1-table app) |
| Card catalogue in memory from JSON        | ~6.5k cards, static; filtering is microseconds                                           | Cards table in SQLite (sync complexity for no gain)                          |
| Owner token instead of accounts           | Publishing "lets other people view" without signup friction                              | Auth from day one (Clerk/Auth.js): worth doing once decks need profiles      |
| Same-name reprint linking                 | Matches game behaviour for copy limits; keeps the browser free of duplicates             | Trusting `countAsCopyOfDbfId` only (covers ~40% of reprints)                 |

## Known trade-offs

- The client bundle (~130 kB gzipped) includes zod because `@hsdeck/shared` exports the request schemas from the same entry as the deck rules. If that matters, add a `./rules` subpath export to `shared/package.json` and import it from the client.
- Views are counted per request (no de-duplication), which is fine for a hobby app and trivially gamed.

## Path to real auth

1. Add a `users` table and an auth provider (Auth.js or Clerk).
2. Add `user_id` to `decks`; on first login, claim decks whose `owner_hash` matches the browser's token.
3. Replace `requireOwnerHash` with a session check; keep the token path for anonymous drafts if desired.

## Deployment

`npm run build && npm start` runs one Node process serving `/api` and the SPA. Any Node host (Fly, Railway, Render, a VM) works; mount a volume for `decks.db` or point `DB_PATH` at it.

The `Dockerfile` packages exactly that: a multi-stage build (install, build the client, prune dev dependencies) into a `node:22-alpine` image running as the `node` user with `/data` as the SQLite volume. Locally it is built and run with Podman; the release workflow publishes it to GHCR on every push to `main`, and `fly.toml` plus the manual Fly workflow deploy that image with a persistent volume.
