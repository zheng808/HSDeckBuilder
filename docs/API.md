# HTTP API

Base path: `/api`. JSON in and out. Errors are `{ "error": { "code": string, "message": string, "issues"?: DeckIssue[] } }`.

## Ownership (no accounts yet)

The client generates a random **owner token** (UUID) once and stores it in `localStorage`.
Every write sends it as the `x-owner-token` header. The server stores only a SHA-256 hash.
A deck is editable by whoever presents the token it was created with. This is deliberately
simple; see `docs/ARCHITECTURE.md` for the path to real accounts.

## Accounts, sessions and ownership

Sign-in is OAuth (GitHub, Google) with server-side sessions in SQLite and an `hs_session` httpOnly cookie (SameSite=Lax, Secure in production, 30 days). Guests keep using the owner token. A deck is owned by its `author` (user) when `deck.author` is set, otherwise by the owner token that created it. On sign-in, every deck owned by the token the browser sent along is **claimed** by the user.

| Method | Path                                              | Auth                 | Notes                                                                                                                                                                                        |
| ------ | ------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/auth/providers`                             | –                    | `{ providers: ("github"\|"google")[] }` — only providers with credentials configured.                                                                                                        |
| GET    | `/api/auth/login/:provider?ownerToken=&returnTo=` | –                    | Redirects to the provider. Stores state, the owner token (for claiming) and `returnTo` (same-origin path only) in a signed cookie.                                                           |
| GET    | `/api/auth/callback/:provider`                    | –                    | Provider redirect target. Creates/updates the user, claims token-owned decks, sets the session cookie, redirects to `returnTo` (default `/`). On failure redirects to `/?auth_error=<code>`. |
| GET    | `/api/auth/me`                                    | cookie               | `{ user: User \| null }`.                                                                                                                                                                    |
| POST   | `/api/auth/logout`                                | cookie               | Clears the session. 204.                                                                                                                                                                     |
| POST   | `/api/auth/claim`                                 | cookie + owner token | Claims the token's decks for the signed-in user. `{ claimed: number }`.                                                                                                                      |
| GET    | `/api/users/:id`                                  | –                    | Public profile: `{ user: DeckAuthor & { createdAt }, decks: DeckSummary[] }` (published only).                                                                                               |

Ownership rules everywhere else: "owner" means the session user (if the deck has an author) or the matching owner token (if it doesn't). `x-owner-token` remains accepted on every request.

## Likes

| Method | Path                  | Auth               | Notes                                                              |
| ------ | --------------------- | ------------------ | ------------------------------------------------------------------ |
| PUT    | `/api/decks/:id/like` | cookie (signed-in) | Idempotent like. Returns `{ likes, liked: true }`. 401 for guests. |
| DELETE | `/api/decks/:id/like` | cookie             | Removes the like. `{ likes, liked: false }`.                       |

`GET /api/decks/:id` includes `liked: boolean` for the viewer. `DeckSummary`/`Deck` carry `likes` and `author`. `GET /api/decks` accepts `sort=liked` and `author=<userId>`.

## Pro-list collection (admin)

Admins are users whose provider login is listed in `ADMIN_LOGINS` (comma-separated, e.g. `github:zheng808`). The collector reads `server/data/pro-sources.json` (YouTube channels), fetches recent uploads through the YouTube Data API (`YOUTUBE_API_KEY`), extracts deck codes from descriptions, decodes/validates them and stores candidates.

| Method | Path                                                              | Auth                                       | Notes                                                                                                                                                       |
| ------ | ----------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/admin/candidates?status=pending\|approved\|rejected&limit=` | admin                                      | `{ items: ProCandidate[] }`.                                                                                                                                |
| POST   | `/api/admin/candidates/:id/approve`                               | admin                                      | Body `{ name?, archetype? }`. Imports as a published deck with `source.type = "creator"`; returns `{ candidate, deck }`. 422 if the list is not importable. |
| POST   | `/api/admin/candidates/:id/reject`                                | admin                                      | `{ candidate }`.                                                                                                                                            |
| POST   | `/api/admin/collect`                                              | admin or `x-admin-token: $ADMIN_API_TOKEN` | Runs the collectors now. `{ scanned, added, skipped }`. Also runnable as `npm run collect:pro -w server`.                                                   |

## Cards

| Method | Path                | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/meta`         | `{ classes, formats, standardSets, cardCount, dataFetchedAt }`                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| GET    | `/api/cards`        | Query: `class` (deck class: returns class + neutral + multi-class cards), `format` (`STANDARD` filters to standard-legal), `q` (name/text substring), `cost` (exact mana cost; the client buckets 7+ itself), `type`, `rarity`, `set`. Returns `Card[]` sorted by cost then name. Core reprints shadow their originals (originals are hidden). Bundled companion cards (`bundledWith` set) **are** returned so a deck's cards always resolve; pickers must hide them (they are added with their legendary). |
| GET    | `/api/cards/:dbfId` | One card or 404.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Decks

| Method | Path                       | Auth                 | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/decks`               | –                    | Published decks. Query: `class`, `format`, `q` (name/author), `sort=newest\|popular`, `limit` (≤100), `offset`. Returns `{ items: DeckSummary[], total }`.                                                                                                                                                                                                                                                                                             |
| GET    | `/api/decks/:id`           | owner if unpublished | Returns `{ deck: Deck, isOwner: boolean, deckCode: string, validation: ValidationResult, stats: DeckStats, basedOn: DeckSummary \| null, diff: DeckDiff \| null }`. `basedOn` is the deck named by `deck.basedOnId` when it is visible to the viewer, and `diff` is `diffDecks(basedOn.cards, deck.cards)` from `@hsdeck/shared` (cards added/removed relative to the base). Increments `views` for published decks when the viewer is not the owner.  |
| POST   | `/api/decks`               | owner                | Body: `DeckInput` (`name`, `heroClass`, `format`, `cards`, `description?`, `authorName?`, `archetype?`, `basedOnId?`). Draft decks may be incomplete but must otherwise be legal (validated with `requireComplete: false`). Card ids that are hidden reprints are remapped to the canonical print. `basedOnId` must name a published deck or one you own, else 400. `source` cannot be set through the API. Returns the same shape as GET, status 201. |
| PUT    | `/api/decks/:id`           | owner                | Body: `DeckUpdate` (partial). Same validation. If the deck is published and the update makes it incomplete/illegal → 422.                                                                                                                                                                                                                                                                                                                              |
| DELETE | `/api/decks/:id`           | owner                | 204.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| POST   | `/api/decks/:id/publish`   | owner                | Requires a complete, legal deck (`requireComplete: true`) else 422 with `issues`.                                                                                                                                                                                                                                                                                                                                                                      |
| POST   | `/api/decks/:id/unpublish` | owner                |                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| GET    | `/api/my/decks`            | owner                | All decks (drafts + published) for this token, newest first. `{ items: DeckSummary[] }`                                                                                                                                                                                                                                                                                                                                                                |
| POST   | `/api/deckcode/decode`     | –                    | Body `{ code }`. Returns `{ format, heroClass, heroDbfId, cards, unknownDbfIds: number[] }`; `cards` use canonical ids (hidden reprints such as the original print of a Core card are remapped). 400 on invalid code, 422 when the hero can't be mapped to a class.                                                                                                                                                                                    |

Status codes: 400 validation (zod) errors, 401 missing owner token, 403 wrong owner, 404 not found, 422 deck rule violations.

## Pro lists (imported decks)

Tournament, streamer and creator lists are imported from `server/data/pro-decks.json` with `npm run import:pro-decks`. Each imported deck is a normal published deck whose `source` is set (`{ type, name, event?, placement?, url?, playedAt? }`) and whose owner is the token in `IMPORT_OWNER_TOKEN` (default `system-pro-import`). Re-running the import is idempotent: a list is keyed by event + player + canonical deck code. Only the importer can set `source`; the public API ignores it, so a "tournament" badge is trustworthy. Deck codes are factual card lists; always keep `url` pointing at where the list was published.

## Types

All payload types come from `@hsdeck/shared` (`Card`, `Deck`, `DeckSummary`, `DeckSource`, `DeckAuthor`, `User`, `ProCandidate`, `DeckInput`, `DeckUpdate`, `ValidationResult`, `DeckStats`, `DeckIssue`, `DeckDiff`).
