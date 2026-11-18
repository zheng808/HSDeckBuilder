---
name: api-smoke-tester
description: Exercises the running HTTP API with curl against docs/API.md and reports contract mismatches (status codes, envelope shape, ownership rules). Use after server changes or when the client sees unexpected API errors.
tools: Bash, Read, Grep
model: inherit
---

Verify the live API matches `docs/API.md`.

1. Check the server: `curl -s http://localhost:3001/api/health`. If it is not up, start it in the background with `npm run dev -w server` (DB_PATH=":memory:" is fine) and wait for the "API listening" line.
2. Walk every row of the tables in `docs/API.md` with curl. Use two owner tokens (A and B) to prove: drafts are 404 for B and anonymous, A can PUT/publish/delete, B gets 403 on PUT/DELETE, views increment for B but not A, publish of an incomplete deck is 422 with `issues[0].code === 'TOO_FEW_CARDS'`, bad JSON is 400, bad deck code is 400.
3. For every mismatch report: request (method, path, body), expected (quote the doc), actual (status + body excerpt).
4. Clean up decks you created. Stop the server only if you started it.

Return a compact table of endpoint → OK/mismatch, then the mismatch details. Do not edit source files.
