# Technical Foundation

This document captures the architecture, references, and prior art that inform the Living Dex tooling. It is the source of truth for design decisions; `README.md` stays a short project overview.

## Philosophy

Our challenge is about **efficient hunting, breeding, and progression** toward a complete living dex — not blind-run purity. The tooling is expected to surface information the games don't: IVs, EVs, nature, hidden power, egg stats, PID/encounter metadata. This is the deliberate inverse of IronMon-style trackers, which hide that data by design.

Guiding rules:
- Read-only. The tooling never writes to emulator memory or save files.
- Transparent. When data is stale or unreliable (e.g. checksum failure), say so in the UI rather than render lies.
- Local-first. The hub, UI, and state all run on the player's machine. Public sharing is a deliberate export step, not a live feed.

## Architecture

```
┌──────────────┐   TCP    ┌───────────┐   WebSocket   ┌─────────┐
│  mGBA + Lua  │ ───────► │ Deno hub  │ ────────────► │ Browser │
│  (per-game   │          │  (relay + │               │   UI    │
│   adapter)   │          │   state)  │               └─────────┘
└──────────────┘          └───────────┘
```

**mGBA Lua script**
- Per-frame callback reads the relevant RAM regions: party, current PC box, enemy party (for wild/trainer battles), daycare slots.
- Decodes the 100-byte Pokémon struct including the PID/OTID-keyed, shuffled substructures.
- Diffs against the previous snapshot and sends only changed regions as JSON over a raw TCP socket.

**Deno hub**
- Listens for mGBA on one TCP port, serves the UI (HTTP + WebSocket) on another.
- Holds the latest authoritative snapshot so a browser reconnect gets immediate state.
- Optional: persist snapshots to disk for the showcase site.

**Web UI**
- Reactive stores subscribe to the WebSocket feed.
- Views: live party, active encounter overlay, PC box browser, living dex progress board.
- A static export step generates the public-facing showcase site from a snapshot.

## Target Games

We target the latest revision of each game for its bug fixes. Emerald only ever shipped one English revision.

| Game      | Game Code | Target Revision | SHA1                                       | Decomp                                                  |
| --------- | --------- | --------------- | ------------------------------------------ | ------------------------------------------------------- |
| Ruby      | AXVE      | Rev 2           | `5b64eacf892920518db4ec664e62a086dd5f5bc8` | [pret/pokeruby](https://github.com/pret/pokeruby)       |
| Sapphire  | AXPE      | Rev 2           | `89b45fb172e6b55d51fc0e61989775187f6fe63c` | [pret/pokeruby](https://github.com/pret/pokeruby)       |
| Emerald   | BPEE      | Rev 0           | `f3ae088181bf583e55daf962a92bb46f4f1d07b7` | [pret/pokeemerald](https://github.com/pret/pokeemerald) |
| FireRed   | BPRE      | Rev 1           | `dd5945db9b930750cb39d00c84da8571feebf417` | [pret/pokefirered](https://github.com/pret/pokefirered) |
| LeafGreen | BPGE      | Rev 1           | `7862c67bdecbe21d1d69ce082ce34327e1c6ed5e` | [pret/pokefirered](https://github.com/pret/pokefirered) |

Dumps are verified with `scripts/verify-rom.ts`. The Lua adapter also reads the ROM header at startup and refuses to run on an unrecognized revision rather than reading garbage.

Offsets come from three triangulated sources:
- Each decomp's **`symbols` branch**, e.g. [pret/pokeemerald@symbols](https://github.com/pret/pokeemerald/tree/symbols) — authoritative per-revision RAM/ROM symbol tables.
- Ironmon-Tracker's `ironmon_tracker/constants/GameSettings.lua` and `Memory.lua` — already-tested Lua cross-reference.
- Kaphotics's Gen 3 Lua scripts (linked from PokeLua credits) — canonical early prior art for Gen 3 memory reads.

## Data Structure References

- [Bulbapedia: Pokémon data structure (Generation III)](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_data_structure_(Generation_III)) — 100-byte struct, substructure ordering by `PID mod 24`, XOR key from `PID ^ OTID`, checksum layout.
- [Bulbapedia: Save data structure (Generation III)](https://bulbapedia.bulbagarden.net/wiki/Save_data_structure_(Generation_III)) — save block layout and checksum rules (used to validate reads).
- [mGBA scripting documentation](https://mgba.io/docs/scripting.html) — Lua API for memory reads, frame callbacks, sockets, and the constraint that mGBA Lua **cannot draw overlays** (the reason we push to a browser UI).

## Prior Art and Influences

### PokeScan — [Veridiann/PokeScan](https://github.com/Veridiann/PokeScan)
A macOS IV overlay for Pokémon Emerald using mGBA Lua → TCP → Swift app. Architecturally nearly identical to ours. We borrow:
- **Project structure** — `lua/core/` (JSON, socket) + `lua/adapters/` (per-game offsets) + a single sender entry script.
- **Catch criteria profiles** — JSON-configurable alerts ("Timid Ralts with ≥25 SpA IV", "any shiny"). Great fit for the living dex / efficiency focus.

### PokéBot Gen3 — [40Cakes/pokebot-gen3](https://github.com/40Cakes/pokebot-gen3)
Python bot using `libmgba-py` to drive the emulator externally. Different host model (we stay inside mGBA Lua for simplicity), but we borrow:
- **pret `symbols` branches** as the offset source.
- **HTTP API** pattern, which validates our hub-broadcast design.
- **PKHeX `.pk3` export** — candidate feature for snapshotting Pokémon into a portable format for the public showcase.

### Ironmon-Tracker — [besteon/Ironmon-Tracker](https://github.com/besteon/Ironmon-Tracker)
BizHawk/mGBA Lua tracker for IronMon challenge runs. Opposite philosophy (hides IVs/EVs by design), but we borrow:
- Per-game Lua memory constants as a cross-reference for adapter offsets.
- Confirmation that **mGBA Lua cannot draw on-screen**, reinforcing the browser-UI choice.

### PokeLua — [Real96/PokeLua](https://github.com/Real96/PokeLua)
RNG-focused Lua scripts covering Gen 1–5 across multiple emulators. We borrow:
- **Checksum validation** — the Gen 3 save block has per-section checksums; if they fail, memory is mid-write or otherwise unreliable. The hub should surface a "reads unreliable" flag rather than emit bad data.
- Links to **Kaphotics's Gen 3 Lua scripts** on Project Pokémon as additional offset reference.

### pokéroo — [barneyboo/pokered-scripts](https://github.com/barneyboo/pokered-scripts)
FireRed gameplay bot (not a tracker), less directly applicable. Its TODO list ("send status updates via sockets", "redirect logging to consume outside of mGBA") independently converges on our socket-out architecture.

## Key Design Decisions

**In-emulator Lua vs. `libmgba-py`.** We use in-emulator Lua. The `libmgba-py` approach (pokebot-gen3) gives more power but adds a Python runtime dependency and drives the emulator itself — unnecessary for a read-only tracker. Lua's per-frame callback plus the `socket` API is sufficient.

**Deno over Bun/Node.** Built-in TCP and WebSocket in the standard library, first-class TypeScript, explicit permission flags scoping network access, and a stability bias that suits a tool we'll return to months later.

**One hub process, one page.** The hub serves both the TCP endpoint for mGBA and the HTTP/WS endpoint for the browser. Single `deno task dev`, single port for the user, and reconnects on either side don't disturb the other.

**Diff-based emission.** Lua does the diff so we aren't pushing 30 KB of JSON at 60 Hz. Only changed party slots / current box / active enemy are sent.

**Fail-loud on mismatch.** Unknown ROM header → adapter refuses to start. Save block checksum failure → UI shows a warning rather than render possibly-wrong stats.

## Open Questions

- Frontend framework (Svelte vs. React).
- Rollout order: all five adapters stubbed up front, or FireRed (the verified dump) end-to-end first and others added as dumps come in.
- Scope of the public showcase site: static export of the current living dex, or a snapshot history with per-mon provenance (game, box, date caught)?
