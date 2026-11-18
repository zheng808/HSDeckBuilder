---
name: run-app
description: Start the deck builder locally (Hono API on :3001 + Vite web on :5173), smoke-test it with curl, and stop it cleanly. Use when asked to run, start, demo, or verify the app end to end.
allowed-tools: Bash, Read
---

# Run the app

Prereqs: Node 22.13+ (`node -v`), `npm install` done once, `server/data/cards.json` present (else `npm run seed:cards`).

## Start

```bash
npm run dev            # both; API logs are prefixed [api], web with [web]
# or separately
npm run dev -w server  # http://localhost:3001  (watches src/)
npm run dev -w client  # http://localhost:5173  (proxies /api → 3001)
```

Run them in the background (`run_in_background`) so you can keep working; the API prints `API listening on http://localhost:3001 (N cards, db: …)` when ready.

## Smoke test (API)

```bash
curl -s http://localhost:3001/api/health
curl -s "http://localhost:3001/api/cards?class=MAGE&format=STANDARD&q=fireball" | head -c 400
TOKEN=smoke-$RANDOM$RANDOM
curl -s -X POST http://localhost:3001/api/decks -H "content-type: application/json" -H "x-owner-token: $TOKEN" \
  -d '{"name":"Smoke","heroClass":"MAGE","format":"STANDARD","cards":[],"authorName":"smoke"}'
```

Expected: health `{ok:true}`, a card array, and a 201 deck envelope `{deck, deckCode, validation, stats}`.

## Smoke test (web)

`curl -s http://localhost:5173/ | head -c 300` should return the Vite HTML shell.

**Drive the real UI headlessly** (no Playwright needed; uses the installed Google Chrome over the DevTools protocol):

```bash
DECK_ID=<a published deck id> node .claude/skills/run-app/drive.mjs
```

It opens the home page, picks Mage → Start building, adds four cards, names and saves the deck (exercising the owner token from the browser), opens the published deck page, visits My Decks, then switches to the Pro lists tab, opens a tournament deck, remixes it in the builder (Compare diff, remove a card, save) and checks the remix page shows "Based on" with the diff. Pro lists must be imported first (`npm run import:pro-decks`). Screenshots land in `/tmp/hs-deck-builder-shots/*.png`; **look at them** with the Read tool. It exits non-zero on console errors or a failed step (and writes `99-failure.png`). Seed a published deck first with the curl flow above (POST, PUT 30 cards, POST publish) if the DB is empty. Set `CHROME` if Chrome is installed somewhere other than `/Applications/Google Chrome.app`.

Manual check: open http://localhost:5173, pick Mage → Standard, add cards, Save, Publish, then open the deck from the home page in a private window (no owner token) to confirm it is public.

## Stop

Kill the background task you started (TaskStop) or `pkill -f "tsx --watch src/index.ts"; pkill -f vite`.

## Production-style run

```bash
npm run build && npm start   # server serves client/dist on :3001
```

Database file: `server/decks.db` (delete it to reset; it is git-ignored).
