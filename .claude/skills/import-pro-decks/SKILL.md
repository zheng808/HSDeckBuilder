---
name: import-pro-decks
description: Add or refresh pro, tournament and streamer deck lists (server/data/pro-decks.json → npm run import:pro-decks). Use after a Masters Tour, Worlds, a meta report, or when the user pastes deck codes from a creator. Covers sourcing rules and attribution.
allowed-tools: Bash, Read, Edit, Grep
argument-hint: '[event name or path to a JSON file]'
---

# Import pro lists

Pro lists are ordinary published decks with a `source` (`tournament | streamer | creator | community`). Only the importer can set `source`, so the badge is trustworthy. Entries are keyed by event + player + canonical deck code, so re-running is safe.

## Sourcing rules (do not skip)

- Deck codes are factual card lists; the guide text around them is not. Copy codes and names, never prose.
- Always fill `url` with where the list was published and keep the player's name as published.
- Do **not** scrape sites programmatically. HSGuru (formerly d0nkey.top) returns 403 to bots; ask the author on their Discord for a feed if volume is needed. HSReplay has no public aggregate API and must not be scraped.
- Good manual sources: HSGuru tournament lineups and Worlds pages, HearthPwn finals coverage, official Blizzard esports posts, creators' own video descriptions (YouTube Data API is allowed for allowlisted channels).

## Steps

1. Open `server/data/pro-decks.json`. Add an event object (`event`, `type`, `url`, `date`) with `decks: [{ player, placement?, name?, archetype?, code, url? }]`. `$ARGUMENTS` may name the event or a separate JSON file.
2. Validate without touching the real DB:
   ```bash
   rm -f /tmp/import-check.db /tmp/import-check.db-wal /tmp/import-check.db-shm; DB_PATH=/tmp/import-check.db npm run import:pro-decks -w server
   ```
   Every skipped line names the problem (bad code, unknown hero, deck-rule failure such as a Wild card in a Standard code). Fix the entry or drop it; do not "repair" codes by guessing.
3. Import for real: `npm run import:pro-decks` (uses `DB_PATH`, default `server/decks.db`). The dev API picks the rows up immediately.
4. Check `GET /api/decks?kind=pro` and the home page "Pro lists" tab.
5. To edit or unpublish an imported deck through the API, send `x-owner-token: system-pro-import` (or the `IMPORT_OWNER_TOKEN` you set).

## Gotchas

- Codes from the game client are wrapped in `###` comment lines; only the `AAE…` line goes in `code`.
- Sideboards (E.T.C., Zilliax) are ignored on import; the main 30 still validate.
- `archetype` defaults to `name`; keep archetype labels consistent (e.g. "Face Hunter", not "face hunter v2") because the home page groups by exact label (case-insensitive).
