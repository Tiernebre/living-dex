# Living Dex

Software to help with running my Living Dex Challenge.

## The Living Dex

I grew up playing the generation 3 and 4 Pokemon games and want to fully go back and complete many different goals:

- Gold Symbols in Battle Frontier
- A full "living dex".
- Clearing Mt Battle and Orre Colosseum in the GameCube games.
- Battle Tower streak
- Fully completed contest and ribbon run.

#### Emulators

Will be using mgba for the game boy games, and Dolphin for the gamecube ones.

#### Rules

- Emulation and speed up is allowed, otherwise I'd go insane with the time investment required.
- Set mode for battles, with level cap enforcement using the lowest level gym leader's pokemon as the cap.
- Every Pokemon in the living dex must be caught with a Pokeball.
    - Safari Zone pokemon will need to utilize breeding.
- Only the vanilla games can be played.

#### Challenges

- You must play the games in the order they were originally released — as if you were back living in that year — from Ruby/Sapphire through Black / White 2.
  - Release order: Ruby/Sapphire → Colosseum → FireRed/LeafGreen → Emerald → XD: Gale of Darkness → Diamond/Pearl → Platinum → HeartGold/SoulSilver → Black/White → Black 2/White 2.
- You cannot start a game until the **primary** game(s) from the previous release stage are completed. The tooling treats this as a state machine and locks out later games on the dashboard.
- Each release has a **primary** game and, where a paired version exists, a **secondary** game:
  - The **primary** game is played to full completion — a 4★ trainer card is required.
  - The **secondary** (paired) game only needs to be completed through the Elite Four / championship. No 4★ card required.
- Primary games:
  - **Sapphire** (secondary: Ruby)
  - **LeafGreen** (secondary: FireRed)
  - **Emerald** (no pair)
  - **Diamond** (secondary: Pearl)
  - **Platinum** (no pair)
  - **HeartGold** (secondary: SoulSilver)
  - **White** (secondary: Black)
  - **Black 2** (secondary: White 2)
- Each "end of gen" game must have a completed national dex to represent the final tally of that gen.
  - i.e. Emerald, HG/SS, Black 2 / White 2.

## Architecture & References

See [`docs/technical-foundation.md`](docs/technical-foundation.md) for the architecture, target ROM revisions, decomp references, prior art, and design decisions.

## Repository Layout

```
lua/                 mGBA collector (one adapter per supported game)
  core/              ROM detect, socket, envelope, memory helpers
  adapters/          ruby / sapphire / emerald / firered / leafgreen
  main.lua           entry — load from mGBA Tools → Scripting
hub/                 Deno process: TCP from Lua, save-file watcher, WS to UI
  decoder/           Gen 3 (and future Gen 4) decoders
  sources/           lua-tcp, save-watcher
  protocol.ts        shared types
  state.ts           in-memory store + subscription
web/                 React + Vite + Zustand UI
scripts/             one-off tools (ROM SHA verifier)
roms/                ROM dumps (gitignored)
saves/               emulator saves (tracked in VCS)
```

## Running

```
# One-time: install web deps
cd web && npm install && cd ..

# Start hub + web UI together (Ctrl-C stops both)
deno task dev

# Then in mGBA: Tools → Scripting → Load script → lua/main.lua
```

For a full end-to-end bring-up checklist against Pokémon Ruby, see [`docs/booting-ruby.md`](docs/booting-ruby.md).

