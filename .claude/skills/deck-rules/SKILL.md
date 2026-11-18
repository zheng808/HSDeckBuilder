---
name: deck-rules
description: Reference for the Hearthstone deck-building rules this app enforces (30 cards, copy limits, class/neutral, Standard vs Wild, Death Knight runes, reprints) and the known gaps. Read before touching validateDeck, canAddCard, the card store, or deck codes.
---

# Deck rules implemented (shared/src/deck-rules.ts)

| Rule                                                                                      | Where                               | Notes                                                     |
| ----------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| Exactly 30 cards to publish; drafts may be smaller, never larger                          | `validateDeck` (`requireComplete`)  | `TOO_FEW_CARDS` / `TOO_MANY_CARDS`                        |
| Max 2 copies; legendaries max 1                                                           | `maxCopies`, `TOO_MANY_COPIES`      | counted by `canonicalDbfId` (reprints collapse)           |
| Only the deck's class or Neutral                                                          | `cardPlayableInClass`               | multi-class cards use `classes[]` and are **not** neutral |
| Standard = card's set ∈ `STANDARD_SETS`; Wild = anything                                  | `cardLegalInFormat`, `constants.ts` | server computes `card.standard` at load                   |
| Death Knight: total runes ≤ 3, where the deck's runes are the per-rune max over its cards | `requiredRunes`, `RUNES_EXCEEDED`   |                                                           |
| Unknown card ids are an error                                                             | `UNKNOWN_CARD`                      | happens when data rotates out a card                      |

Fabled bundles: `server/scripts/fetch-cards.ts#findBundles` pulls uncollectible, elite `<parent>t<n>` tokens of collectible cards whose text says **Fabled** into `cards.json` with `bundledWith`; `/api/cards` returns them (so deck lookups resolve) and the builder's picker hides them; they cost no dust. The builder adds and removes a verified bundle as a unit.

Reprints: `server/src/cards/card-store.ts#linkReprints` groups cards by name, elects a canonical print (Core → Standard-legal → oldest), sets `countAsCopyOfDbfId` on the rest, and hides them from `/api/cards`. Decks may still contain the hidden ids (deck codes from the game use them).

Dust: `dustCostOf` — Core and FREE cards cost 0; else 40/100/400/1600.

Deck codes: `shared/src/deckstring.ts`, spec https://hearthsim.info/docs/deckstrings/. Format id 2 = Standard, anything else decodes as Wild. Sideboards are ignored.

# Known gaps (say so if asked, don't silently "fix")

- **Tourist** cards (Perils in Paradise) that unlock another class's cards are not modelled.
- **Sideboards** (E.T.C., Zilliax modules) are ignored on decode and never encoded.
- **Twist / Classic** formats are not offered.
- Same-name grouping assumes same name ⇒ same card; HearthstoneJSON has a handful of genuinely different cards sharing a name.
- Only Sylvanas and Broxigar bundles are enforced as complete; other Fabled companions are accepted when present but never auto-added, because the data cannot tell deck-slot companions from play-generated ones. Add pairs to `REQUIRED_COMPANIONS` as tournament codes reveal them.
- Rotation (`STANDARD_SETS`) is a hand-maintained list; see the refresh-cards skill.
