# Hearthstone Deck Builder

Web app to build 30-card Hearthstone decks per class, validate them for Standard or Wild, publish them, and browse other people's decks.

## Stack (keep it boring)

- `shared/` — TypeScript domain package: types, zod schemas, **deck rules**, deck-code codec, Standard rotation list. Consumed as source by both sides.
- `server/` — Hono on Node 22, built-in `node:sqlite` for decks, in-memory card catalogue from `server/data/cards.json` (generated from HearthstoneJSON).
- `client/` — React 19 + Vite 7 + Tailwind v4 + react-router v7 + TanStack Query + zustand.
- npm workspaces, strict TS, Prettier, Vitest.

## Commands

```bash
npm install              # once
npm run dev              # API :3001 + web :5173 (proxy /api)
npm run check            # typecheck + tests + client build  ← run before saying "done"
npm test -w shared       # deck rules / deck code tests
npm test -w server       # API tests (in-memory SQLite, real card data)
npm run seed:cards       # refresh server/data/*.json from HearthstoneJSON
npm run import:pro-decks # import server/data/pro-decks.json (tournament/streamer lists)
npm run build && npm start   # production: server serves client/dist
```

## Deployment

- Live: https://hsdeckbuilder.fly.dev (Fly.io app `hsdeckbuilder`, region sjc, volume `data` at /data). CI + GHCR image on every push to `main`; `flyctl deploy --remote-only --ha=false` to ship. Pro lists are seeded on the machine with `flyctl ssh console -C "npm run import:pro-decks"`.

## AWS (OpenTofu)

- `infra/aws/`: VPC + EC2 (Graviton) + EBS data volume + EIP + Caddy HTTPS on `<ip>.sslip.io` + DLM snapshots + GitHub OIDC deploy role. `/aws-infra` skill for operations; rules in `.claude/rules/infra.md`. Never apply/destroy without an explicit request.

## Where things live

- Deck legality: `shared/src/deck-rules.ts` (`validateDeck`, `canAddCard`, `deckStats`). Rules of record: `.claude/skills/deck-rules/SKILL.md`.
- Rotation: `STANDARD_SETS` in `shared/src/constants.ts` (hand-maintained; `/refresh-cards`).
- API contract: `docs/API.md`; routes in `server/src/{cards,decks}/*-routes.ts`; tests in `server/src/__tests__/api.test.ts`.
- Ownership: anonymous `x-owner-token` header, hashed in SQLite (no accounts yet). Imported pro lists belong to `IMPORT_OWNER_TOKEN` (default `system-pro-import`).
- Pro lists / remix: `server/src/decks/pro-import.ts`, `server/data/pro-decks.json`; `basedOnId` + `diffDecks` power the "based on" diff.
- Builder state: `client/src/store/builder-store.ts`; data hooks: `client/src/api/hooks.ts`.
- Design notes, ideas and the prioritised backlog: `docs/ARCHITECTURE.md`, `docs/BRAINSTORM.md`, `docs/BACKLOG.md` (deploy-to-GitHub plan is Epic A).

## Conventions

See `.claude/rules/` (project-wide plus per-workspace rules, loaded automatically). In short: domain logic only in `shared/`; change contracts schema → route → test → docs → client; fixed error envelope; `npm run check` must be green.

## Claude Code helpers

- Skills: `/run-app`, `/ship-check`, `/add-endpoint`, `/refresh-cards`, `/deck-rules`, `/import-pro-decks`.
- Agents: `code-reviewer` (general quality), `deck-rules-auditor`, `api-smoke-tester`, `ui-reviewer`.
- Workflows: `review-changes`, `feature-plan` (Workflow tool; `.claude/workflows/`).
- Hooks: generated data and lockfile are write-protected; edited files are Prettier-formatted; contract changes trigger reminders.
