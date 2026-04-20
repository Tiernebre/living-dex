# Branding & visual system

This app is a Pokémon Living Dex tracker. The UI should feel like an in-game
trainer card / Pokédex — warm, colorful, a little playful — not a generic
dashboard. When adding new surfaces, match this vocabulary rather than
inventing a fresh one.

## Core elements

### Pokéball
The `Pokeball` component in `web/src/App.tsx` is the master brand mark. Use it
in headers, status lines, and hero decorations (large, low-opacity) for
instant "this is Pokémon" recognition. Accepts `size` and `color` props —
tint it to match the surrounding game's accent when relevant.

### Per-game accent colors
Each Gen 3 cart has an established tint (mirrored in `index.html` under
`[data-game="..."]`):

| Game      | Tint     | Mascot (National #) |
| --------- | -------- | ------------------- |
| Ruby      | `#dc2626` | Groudon (383)       |
| Sapphire  | `#2563eb` | Kyogre (382)        |
| Emerald   | `#059669` | Rayquaza (384)      |
| FireRed   | `#ea580c` | Charizard (6)       |
| LeafGreen | `#16a34a` | Venusaur (3)        |

Later gens (roadmap-only today) have tints + mascots defined in
`CHALLENGE_CHAIN` in `App.tsx`. Use the mascot thumbnail (via `thumbnailUrl`,
which points at HybridShivam's CDN) as the visual shorthand for a game. For
paired versions (HG/SS, B/W, D/P) overlap both mascots with a negative
`margin-left`.

### Card pattern: tinted trainer card
See `ChainCard` for the reference implementation. The pattern:

1. **Rounded 14px corners**, generous padding (`14px 16px`).
2. **Left edge accent strip** in the game tint (4px-wide absolute strip).
3. **Background**: soft diagonal gradient from
   `color-mix(tint 12%, bg-elevated)` into `bg-elevated`.
4. **Border**: `color-mix(tint 35%, var(--border))` — tinted but subtle.
5. **Decorative glow**: a radial gradient blob bottom-right at ~8% opacity
   in the tint color, for loaded/active states.
6. **Mascot thumbnail** on the left (64px single, 52px paired with overlap).
7. **Title in uppercase, weight 800**, colored
   `color-mix(tint 80%, var(--text))`.
8. **Status line** prefixed with a tiny Pokéball (`size={12}`) tinted to
   the game.

### Hero / stat block
See the `trainer-hero` section in `Dashboard`. The big counter uses a
warm red→orange gradient via `background-clip: text` — treat this gradient
as the "Living Dex headline" look. A large Pokéball at ~15% opacity floats
in the top-right corner as decoration.

### Badges
- **Dex goal** (end-of-gen marker): small pill, filled with the game's tint,
  white text, prefixed with ★.
- **Live**: green `#16a34a` pill with a pulsing white dot. Used when mGBA is
  running that specific cart.
- Avoid generic gray/neutral badges — tint to convey the game or state.

## Rules of thumb

- **Prefer game tints to neutral grays.** If a surface relates to a specific
  game, pull from its accent color. Global-dashboard surfaces can use the
  red→blue trainer-card gradient to stay neutral across games.
- **Mascots over box art.** We intentionally don't use official box art
  (licensing, inconsistent sources). The legendary mascot thumbnail is the
  canonical per-game icon.
- **Use `color-mix(in srgb, <tint> N%, var(--...))`** for tinted surfaces so
  they adapt to light/dark themes automatically.
- **Rounded corners, drop-shadows, subtle gradients** — avoid flat
  rectangles. Aim for the soft, tactile feel of a trainer card.
- **Pokéball iconography is the unifier.** When in doubt, add a small
  Pokéball — it's the strongest signal that this is a Pokémon app.
