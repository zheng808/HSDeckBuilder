# Backlog

Prioritised list of what comes next. Status: `todo` · `doing` · `done`. Size: S (hours) · M (a day or two) · L (a week+).
When the repo is on GitHub, each item can become an issue (`gh issue create --title "B-01 …" --body-file -`).

## Epic A — Publish to personal GitHub and deploy

Goal: the app lives in a public repo under your personal GitHub account and runs at a public URL. Owner: you. Repo: https://github.com/zheng808/HSDeckBuilder (first push 2026-11-18). Live at https://hsdeckbuilder.fly.dev since 2026-11-18. Hardening (A-06) and custom domain/OG tags (A-08) still open.

| ID   | Item                                               | Size | Status | Notes                                                                                                                                                                                                                                                                                                                   |
| ---- | -------------------------------------------------- | ---- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | Initialise git and make the first commit           | S    | done   | `git init -b main && git add -A && git commit`. `.gitignore` already excludes `node_modules`, `dist`, `server/*.db`, `.env`, `.claude/settings.local.json`. Decide whether to commit `server/data/*.json` (≈1.8 MB, lets the app run out of the box; recommended yes) or regenerate it in CI with `npm run seed:cards`. |
| A-02 | Add a LICENSE and attribution                      | S    | done   | MIT for the code. Keep the footer notice: card data and art from HearthstoneJSON; Hearthstone is a trademark of Blizzard Entertainment. Do not redistribute card art in the repo (it is hot-linked).                                                                                                                    |
| A-03 | Create the GitHub repo and push                    | S    | done   | `gh auth login` with the personal account (not the work GitLab/Azure DevOps identity), then `gh repo create hearthstone-deck-builder --public --source . --push`. CI (`.github/workflows/ci.yml`) runs format, typecheck, tests, build on every push.                                                                   |
| A-04 | Pick a host that supports a persistent SQLite file | S    | done   | Fly.io: app `hsdeckbuilder`, region `sjc`, 1 GB volume `data`, single machine with auto-stop. Live at https://hsdeckbuilder.fly.dev.                                                                                                                                                                                    |
| A-05 | Containerise                                       | S    | done   | `Dockerfile` (node:22-alpine, multi-stage, runs as `node`, `/data` volume), `.dockerignore`, `fly.toml`; built locally with Podman (`--format docker` keeps the health check).                                                                                                                                          |
| A-06 | Production hardening                               | M    | todo   | Rate-limit writes per owner token/IP, JSON body size limit, `hono/secure-headers`, turn request logging down in prod, nightly `decks.db` backup (Litestream to object storage or a scheduled `sqlite3 .backup`).                                                                                                        |
| A-07 | Deploy from CI                                     | S    | done   | `release.yml` runs CI then publishes `ghcr.io/zheng808/hsdeckbuilder` on every push to `main` (no secrets needed). `deploy-fly.yml` is a manual workflow that needs a `FLY_API_TOKEN` secret and the Fly app/volume from `fly.toml`.                                                                                    |
| A-08 | Custom domain, HTTPS, Open Graph                   | S    | todo   | Point a domain at the app; add OG meta tags for `/decks/:id` so shared links preview the deck name and class.                                                                                                                                                                                                           |

## Epic B — Product features (from docs/BRAINSTORM.md)

| ID   | Item                                                | Size | Status | Notes                                                                                                                                                     |
| ---- | --------------------------------------------------- | ---- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Accounts and profiles                               | L    | todo   | Auth.js or Clerk; `users` table; claim anonymous decks whose `owner_hash` matches the browser token on first login. See ARCHITECTURE "Path to real auth". |
| B-02 | Likes / bookmarks and "popular this week"           | M    | todo   | `deck_votes` table, daily aggregate, new `sort=trending`.                                                                                                 |
| B-03 | Render deck descriptions as Markdown                | S    | todo   | Sanitise; description field already exists.                                                                                                               |
| B-04 | Card detail popover                                 | S    | todo   | Full text, flavour, related cards (`referencedTags`).                                                                                                     |
| B-05 | Archetype tags (Aggro / Midrange / Control / Combo) | S    | todo   | Author-chosen, filterable on home.                                                                                                                        |
| B-06 | Sideboards (E.T.C., Zilliax)                        | M    | todo   | Deck-code sideboard section + validation.                                                                                                                 |
| B-07 | Tourist cards (cross-class legality)                | M    | todo   | Needs tourist metadata per card.                                                                                                                          |
| B-08 | Twist format                                        | S    | todo   | Own set list in `shared/src/constants.ts`.                                                                                                                |
| B-09 | Deck image export (PNG)                             | M    | todo   | Server-side render for sharing.                                                                                                                           |
| B-10 | PWA / offline card browsing                         | M    | todo   | Card data is static and cacheable.                                                                                                                        |
| B-11 | Localisation                                        | M    | todo   | HearthstoneJSON ships every locale; add a locale flag to `seed:cards`.                                                                                    |
| B-12 | Debounced search and client tests                   | S    | todo   | Vitest + Testing Library for the store and DeckPanel.                                                                                                     |
| B-13 | Trim client bundle                                  | S    | todo   | Add a `./rules` subpath export to `@hsdeck/shared` so zod stays server-only (~130 kB gzip today).                                                         |

## Epic C — Pro lists and the remix loop

Goal: give the site a reason to exist next to HSReplay without win-rate data: curated pro/tournament lists, and a remix loop (open a pro list, tweak, publish a variant with a "based on" link and a card diff). Decided 2026-11-17.

| ID   | Item                                          | Size | Status | Notes                                                                                                                                                        |
| ---- | --------------------------------------------- | ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C-01 | Source model + importer                       | S    | done   | `DeckSource` on decks, `server/data/pro-decks.json`, `npm run import:pro-decks` (idempotent), `/import-pro-decks` skill. Only the importer can set `source`. |
| C-02 | Pro lists tab + badges + archetype filter     | S    | done   | `GET /api/decks?kind=pro\|community&archetype=`, `GET /api/archetypes`, source badges on cards and deck pages.                                               |
| C-03 | Remix loop: based-on link + diff              | S    | done   | `basedOnId` on decks, `diffDecks` in `@hsdeck/shared`, diff shown in the builder ("Compare") and on the deck page.                                           |
| C-04 | Seed more tournament lineups by hand          | S    | todo   | Only five Worlds/Masters Tour 2026 lists are seeded (HSGuru blocks automated fetches). Add the rest from the lineup pages with attribution.                  |
| C-05 | Ask HSGuru for a lineup/streamer feed         | S    | todo   | Message the author on their Discord; a JSON feed would let a weekly GitHub Action refresh `pro-decks.json`.                                                  |
| C-06 | Creator collectors (YouTube Data API, Reddit) | M    | todo   | Allowlisted channels → regex `AAE…` codes from descriptions → candidates file → you approve → import.                                                        |
| C-07 | Archetype analytics from lists                | M    | todo   | Cluster by `deckSimilarity`, show core vs tech cards, card popularity week over week, cheapest list per archetype. Label as popularity, never win rate.      |
| C-08 | Lineage view                                  | S    | todo   | "N variants of this list" on pro deck pages (query decks by `basedOnId`).                                                                                    |
| C-09 | Automated weekly import in CI                 | S    | todo   | GitHub Action runs the importer against the production DB after C-05/C-06.                                                                                   |

## Epic D — AWS route with OpenTofu

Goal: experience AWS with infrastructure as code while keeping the app unchanged (one container + SQLite on EBS). Written 2026-11-18.

| ID   | Item                                                                                                                         | Size | Status | Notes                                                                                                                                                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | OpenTofu stack: VPC, EC2 (t4g.micro), EBS data volume, EIP, security group, IAM/SSM, Caddy HTTPS via sslip.io, DLM snapshots | M    | done   | `infra/aws`, validated with `tofu validate`; Infra workflow checks fmt/validate on every change.                                                                                                                                                              |
| D-02 | GitHub OIDC deploy role + "Deploy to AWS" workflow (SSM run of `deploy.sh` after each release)                               | S    | doing  | Role and workflow exist; the variable is set, but the first runs failed in `configure-aws-credentials` before calling AWS (no CloudTrail event). Preflight step now prints/validates the variable. Manual deploy via `tofu output -raw deploy_command` works. |
| D-03 | First `tofu apply` in the personal AWS account and smoke test                                                                | S    | done   | Applied 2026-11-18: 20 resources in us-west-2, live at https://44-253-144-163.sslip.io (Let's Encrypt cert via Caddy, pro lists seeded, SSM online). Set the `AWS_DEPLOY_ROLE_ARN` repo variable to enable the Deploy to AWS workflow.                        |
| D-04 | Custom domain + Route 53 + ACM/Caddy                                                                                         | S    | todo   | removes the sslip.io dependency; add `aws_route53_zone`/records.                                                                                                                                                                                              |
| D-05 | Remote state in S3 with locking                                                                                              | S    | todo   | bootstrap bucket once, add backend block.                                                                                                                                                                                                                     |
| D-06 | Move SQLite to RDS Postgres (optional, for ECS/App Runner)                                                                   | L    | todo   | only if you want the managed-database experience; storage is isolated in `deck-repo.ts`.                                                                                                                                                                      |

## Parked

Collection import (needs Blizzard OAuth), meta win rates (no public data), Arena draft mode.

## Done

- 2026-11-17 — MVP: builder, validation, publish/browse, deck codes, API tests, Claude Code tooling.
