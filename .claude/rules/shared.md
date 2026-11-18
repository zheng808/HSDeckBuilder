---
paths:
  - 'shared/**'
---

# Rules for shared/

- Everything here runs in both Node and the browser: no `node:` imports, no DOM APIs beyond `btoa`/`atob`.
- Functions are pure and take a `CardLookup` (`(dbfId) => Card | undefined`) rather than reaching for data.
- Any change to deck legality needs a test in `shared/src/__tests__/deck-rules.test.ts` using the fixtures in `fixtures.ts`.
- `deckstring.ts` follows https://hearthsim.info/docs/deckstrings/ exactly; keep decode tolerant of trailing sideboard bytes and keep encode writing the trailing `0`.
- `STANDARD_SETS` in `constants.ts` is the only place rotation is encoded. Update it with a dated comment.
