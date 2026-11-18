---
name: add-endpoint
description: Recipe for adding or changing an HTTP API endpoint end to end (zod schema → Hono route → test → docs/API.md → client hook). Use whenever the API surface changes.
---

# Add or change an API endpoint

Work through every step; the API is only "done" when the client can call it and the test proves it.

1. **Contract first.** Add/extend a zod schema in `shared/src/schemas.ts` and export the inferred type. Reuse `deckInputSchema`, `cardQuerySchema` patterns (`z.coerce` for query numbers).
2. **Route.** In `server/src/<area>/<area>-routes.ts` add the handler. Parse with `parseJsonBody(c, schema)` / `parseWith(schema, c.req.query(), 'query')`. Throw `ApiError` (`notFound`, `badRequest`, or `new ApiError(422, 'DECK_INVALID', msg, issues)`). Use `requireOwnerHash` for writes.
3. **Deck legality** always goes through `validateDeck` from `@hsdeck/shared`; never special-case in the route.
4. **Test** in `server/src/__tests__/api.test.ts` with `app.request(...)`: the happy path, the 4xx path, and ownership if applicable.
5. **Docs**: add the row to `docs/API.md` (method, path, auth, body/query, response, status codes).
6. **Client**: add a function in `client/src/api/client.ts` if needed and a hook/mutation in `client/src/api/hooks.ts` with the right query invalidation.
7. Run `npm run check`. Paste the test summary in your report.
