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

