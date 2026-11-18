---
paths:
  - 'client/**'
---

# Rules for client/

- Data access goes through `src/api/client.ts` (fetch wrapper, owner-token header, `ApiError`) and the TanStack Query hooks in `src/api/hooks.ts`. Components never call `fetch` directly.
- Builder state lives in the zustand store `src/store/builder-store.ts`; add/remove go through `canAddCard`/`addCardEntry`/`removeCardEntry` from `@hsdeck/shared`.
- Styling is Tailwind v4 with the tokens declared in `src/index.css` (`@theme`). Class colours come from the per-class CSS variables; never hard-code hex values in components.
- Card art: `src/lib/card-art.ts` builds HearthstoneJSON render/tile URLs; always set `alt` and `loading="lazy"`.
- Accessibility: interactive things are `<button>`/`<a>`, have visible focus rings, and never rely on colour alone (format and class badges carry text).
- Charts (`ManaCurve` and any future chart) follow the dataviz skill: one hue per single series, no legend for one series, thin rounded bars, tooltip per mark, label only the extreme, and a visually-hidden table.
- `npm run build -w client` (which type-checks) must pass before finishing.
