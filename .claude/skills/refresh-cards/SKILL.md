---
name: refresh-cards
description: Re-download Hearthstone card data from HearthstoneJSON, review new/removed sets, and update the Standard rotation (STANDARD_SETS). Use after an expansion, mini-set, or the yearly rotation, or when cards look missing.
allowed-tools: Bash, Read, Edit, Grep
argument-hint: '[--from /path/to/cards.collectible.json]'
---

# Refresh card data

1. Snapshot the current set list so you can diff it:
   ```bash
   node -e 'const c=require("./server/data/cards.json");const s={};for(const x of c)s[x.set]=(s[x.set]||0)+1;console.log(JSON.stringify(s))' > /tmp/sets-before.json
   ```
2. Fetch: `npm run seed:cards` (offline: `npm run seed:cards -w server -- --from <file>` using $ARGUMENTS if given). The script prints every set with its card count. The generated files are protected by a hook; never hand-edit them.
3. Diff the set list against `/tmp/sets-before.json`. New set codes usually mean an expansion or a mini-set (mini-sets reuse the parent code, so a count going from 183→~221 is a mini-set).
4. Decide whether `STANDARD_SETS` in `shared/src/constants.ts` must change:
   - A **new expansion** in the current year → add its code.
   - **Yearly rotation** (first expansion of a new year, usually March/April) → remove the sets from two years ago, keep last year's and Core.
   - Sort sets chronologically by max `dbfId` if unsure which year a code belongs to (newer sets have higher ids). Blizzard's "set rotation" announcement is the authority; say what you assumed.
5. Run `npm test` (the server tests sample Standard-legal cards, so a broken rotation list fails loudly) and `npm run typecheck`.
6. Report: cards before/after, sets added/removed, the exact `STANDARD_SETS` change, and `server/data/meta.json`'s `fetchedAt`.
