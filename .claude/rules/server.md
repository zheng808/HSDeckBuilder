---
paths:
  - 'server/**'
---

# Rules for server/

- Framework is Hono on `@hono/node-server`; storage is Node's built-in `node:sqlite` (no ORM, no native deps). Use positional `?` parameters.
- Validate every body/query with `parseJsonBody` / `parseWith` from `src/http/errors.ts`; throw `ApiError` for domain failures. Never `c.json({error: ...})` by hand.
- Mutating deck routes call `requireOwnerHash`; read routes use `optionalOwnerHash` to decide visibility.
- Card data is in-memory (`CardStore`). Reprints with the same name are linked at load time; keep `linkReprints` behaviour when touching the store.
- Tests build the app with `createApp({ db: openDatabase(':memory:'), quiet: true })` and use `app.request(...)`; no network listeners in tests.
- Run `npm test -w server` and `npm run typecheck -w server` before finishing.
