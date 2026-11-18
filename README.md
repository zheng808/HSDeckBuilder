# Hearthstone Deck Builder

[![CI](https://github.com/zheng808/HSDeckBuilder/actions/workflows/ci.yml/badge.svg)](https://github.com/zheng808/HSDeckBuilder/actions/workflows/ci.yml) [![Release image](https://github.com/zheng808/HSDeckBuilder/actions/workflows/release.yml/badge.svg)](https://github.com/zheng808/HSDeckBuilder/actions/workflows/release.yml)

Build a 30-card deck for any of the 11 classes, see it validated live against the real deck-building rules (copy limits, class cards, Standard vs Wild, Death Knight runes), publish it, and browse decks other people have shared. Browse imported pro and tournament lists, open one in the builder, and publish your remix with a card-by-card diff against the original. Supports Hearthstone deck codes both ways.

## Quick start

```bash
# Node 22.13+ (uses the built-in SQLite module; no native builds)
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3001/api (see [docs/API.md](docs/API.md))

Card data ships in `server/data/` (generated from [HearthstoneJSON](https://hearthstonejson.com/)); refresh it with `npm run seed:cards`.

## Scripts

| Command                      | What it does                                                          |
| ---------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                | API with file watching + Vite dev server with `/api` proxy            |
| `npm run check`              | Typecheck all workspaces, run all tests, build the client             |
| `npm test`                   | Vitest in `shared/` (deck rules, deck codes) and `server/` (HTTP API) |
| `npm run build && npm start` | Production build; the API serves the built client on :3001            |
| `npm run seed:cards`         | Re-download and trim card data                                        |
| `npm run format`             | Prettier                                                              |

## Layout

```
shared/   domain types, zod schemas, deck rules, deck-code codec, Standard rotation
server/   Hono API, SQLite deck storage, in-memory card catalogue
client/   React UI: card browser, deck panel, mana curve, publish & browse
docs/     architecture, brainstorm, backlog (deploy plan + features), API contract
.claude/  Claude Code skills, agents, workflows, hooks and rules for this repo
```

## How publishing works (no accounts yet)

The browser generates a random owner token on first visit and sends it with every write. Decks are private drafts until you publish; published decks are visible to everyone at `/decks/:id` and on the home page. Only the browser holding the token can edit, unpublish or delete. See "Path to real auth" in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Pipeline and deployment

- **CI** (`.github/workflows/ci.yml`): Prettier check, typecheck, tests and client build on every branch push and pull request.
- **Release image** (`.github/workflows/release.yml`): on every push to `main`, runs CI and then builds the production Docker image and publishes it to GitHub Container Registry as `ghcr.io/zheng808/hsdeckbuilder:latest` (and a commit-sha tag). No secrets needed.
- **Deploy to Fly.io** (`.github/workflows/deploy-fly.yml`): manual workflow; add a `FLY_API_TOKEN` repository secret, create the app and a 1 GB volume named `data` as described in `fly.toml`, then run the workflow or `flyctl deploy` locally.

Run the published image anywhere with Docker:

```bash
docker run -d -p 3001:3001 -v hsdeck-data:/data ghcr.io/zheng808/hsdeckbuilder:latest
```

The API serves the built client on the same port and stores decks in `/data/decks.db`. Seed pro lists into a running container with `docker exec <container> npm run import:pro-decks`.

## Configuration

Copy `server/.env.example` to `server/.env` if you need to change the port, database path or CORS origins.

## Known limitations

Tourist cards, sideboards (E.T.C. / Zilliax), and the Twist format are not modelled. Standard rotation is a hand-maintained list in `shared/src/constants.ts`.
