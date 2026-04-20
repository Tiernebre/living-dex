# Living Dex — agent notes

Project overview: see [`README.md`](README.md).
Architecture and decomp references: [`docs/technical-foundation.md`](docs/technical-foundation.md).

## UI / design

**Read [`docs/branding.md`](docs/branding.md) before touching any web UI.**
This app is styled to feel like an in-game trainer card / Pokédex — Pokéball
iconography, per-game tint colors, legendary mascot thumbnails as per-game
icons, tinted-gradient cards with left-edge accent strips. Don't introduce
generic gray/neutral dashboard components; pull from the existing visual
vocabulary in `ChainCard`, the `trainer-hero` section, and the `Pokeball`
component (all in `web/src/App.tsx`).

## Routes

- `/` — cross-save dashboard (progress across the whole challenge chain)
- `/:game` — per-save view, where `:game` is a stem like `ruby`, `sapphire`, etc.
- `/:game/pokemon/:key` — individual Pokémon detail page, key is `${otIdHex}-${pidHex}`

## Saves

Saves are watched out of `saves/*.sav` by `hub/sources/save-watcher.ts` and
aggregated into `HubState.saves: Partial<Record<GameStem, SaveInfo>>`. Adding
a new game means writing a parser in `hub/decoder/` and registering it in the
watcher's `PARSERS` map. Ruby & Sapphire share `parseRubySave` (same RS
format); Emerald and FR/LG need their own parsers.
