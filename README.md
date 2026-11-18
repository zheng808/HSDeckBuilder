# Hearthstone Deck Builder

[![CI](https://github.com/zheng808/HSDeckBuilder/actions/workflows/ci.yml/badge.svg)](https://github.com/zheng808/HSDeckBuilder/actions/workflows/ci.yml) **Live: [hsdeckbuilder.fly.dev](https://hsdeckbuilder.fly.dev)** (Fly.io) · **[44-253-144-163.sslip.io](https://44-253-144-163.sslip.io)** (AWS, OpenTofu)

[![Release image](https://github.com/zheng808/HSDeckBuilder/actions/workflows/release.yml/badge.svg)](https://github.com/zheng808/HSDeckBuilder/actions/workflows/release.yml)

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

## Accounts and publishing

Guests can build without signing in: the browser generates a random owner token and sends it with every write, so only that browser can edit its drafts. Sign in with GitHub or Google (OAuth, server-side sessions in SQLite) to keep decks across devices; decks made as a guest are claimed on first sign-in. Signed-in users get a public profile (`/users/:id`) and can like decks. Decks are private drafts until published; published decks are visible to everyone at `/decks/:id` and on the home page.

To enable sign-in, register an OAuth app per provider with callback `<APP_URL>/api/auth/callback/<provider>` and set `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `APP_URL`, `AUTH_SECRET` and `ADMIN_LOGINS` (see `server/.env.example`). Sign-in stays hidden until a provider is configured.

## Pro lists and the collector

Tournament lists are imported from `server/data/pro-decks.json`. Creator lists arrive through a collector: `server/data/pro-sources.json` names YouTube channels, `npm run collect:pro` (or the weekly "Collect pro lists" workflow) pulls their recent uploads through the YouTube Data API, extracts deck codes from descriptions, validates them, and queues them. Admins (`ADMIN_LOGINS`) approve or reject candidates at `/admin/pro-queue`; approved lists become published decks with a creator badge and a link to the video. Needs `YOUTUBE_API_KEY`.

## Pipeline and deployment

- **CI** (`.github/workflows/ci.yml`): Prettier check, typecheck, tests and client build on every branch push and pull request.
- **Release image** (`.github/workflows/release.yml`): on every push to `main`, runs CI and then builds the production Docker image and publishes it to GitHub Container Registry as `ghcr.io/zheng808/hsdeckbuilder:latest` (and a commit-sha tag). No secrets needed.
- **Deploy to Fly.io** (`.github/workflows/deploy-fly.yml`): the app runs at [https://hsdeckbuilder.fly.dev](https://hsdeckbuilder.fly.dev) as a single `shared-cpu-1x` machine in `sjc` with a 1 GB volume named `data` (see `fly.toml`). Deploy locally with `flyctl deploy --remote-only --ha=false`, or add a `FLY_API_TOKEN` repository secret (`flyctl tokens create deploy`) and run the manual workflow. Seed pro lists on the machine with `flyctl ssh console -C "npm run import:pro-decks"`.

Run the published image anywhere with Podman (or Docker; same commands with `docker`):

```bash
podman run -d -p 3001:3001 -v hsdeck-data:/data ghcr.io/zheng808/hsdeckbuilder:latest
```

Build it locally with `podman build --format docker -t hsdeckbuilder .` (the `--format docker` flag keeps the `HEALTHCHECK`; CI builds the same `Dockerfile` with Buildx on the GitHub runner). The API serves the built client on the same port and stores decks in `/data/decks.db`. Seed pro lists into a running container with `podman exec <container> npm run import:pro-decks`.

## AWS route (OpenTofu)

[infra/aws](infra/aws/) is an OpenTofu stack that runs the same container on AWS: a small VPC, a Graviton `t4g.micro` instance with an EBS data volume (daily snapshots), an Elastic IP with automatic HTTPS on an `sslip.io` hostname, Session Manager instead of SSH, and a GitHub OIDC role so the "Deploy to AWS" workflow redeploys after every release. Deployed on 2026-11-18 at [https://44-253-144-163.sslip.io](https://44-253-144-163.sslip.io) (account-specific; yours will differ). `tofu init && tofu apply` in that directory; details, cost (~$11/month) and teardown in [infra/aws/README.md](infra/aws/README.md).

## Configuration

Copy `server/.env.example` to `server/.env` if you need to change the port, database path or CORS origins.

## Known limitations

Tourist cards, sideboards (E.T.C. / Zilliax), and the Twist format are not modelled. Standard rotation is a hand-maintained list in `shared/src/constants.ts`.
