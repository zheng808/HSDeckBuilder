---
name: ship-check
description: Full verification gate before calling work done — format check, typecheck all workspaces, run all tests, build the client — and report results honestly. Use before committing, opening a PR, or declaring a feature finished.
allowed-tools: Bash
---

# Ship check

Run, in order, and stop at the first failure:

```bash
npm run format:check
npm run typecheck
npm test
npm run build -w client
```

Then report a four-line table (step → pass/fail → key output). If a step fails, include the first error verbatim, fix it if it is clearly in scope, and re-run from the top. Do not describe the work as done while any line is red. Do not run `git commit`; the user decides when to commit.
