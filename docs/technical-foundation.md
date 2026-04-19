# Technical Foundation

This document captures the architecture, references, and prior art that inform the Living Dex tooling. It is the source of truth for design decisions; `README.md` stays a short project overview.

## Philosophy

Our challenge is about **efficient hunting, breeding, and progression** toward a complete living dex — not blind-run purity. The tooling is expected to surface information the games don't: IVs, EVs, nature, hidden power, egg stats, PID/encounter metadata. This is the deliberate inverse of IronMon-style trackers, which hide that data by design.

Guiding rules:
- Read-only. The tooling never writes to emulator memory or save files.
- Transparent. When data is stale or unreliable (e.g. checksum failure), say so in the UI rather than render lies.
- Local-first. The hub, UI, and state all run on the player's machine. Public sharing is a deliberate export step, not a live feed.
- Cross-generation. The architecture accommodates Gen 3 (GBA) and Gen 4 (DS) in one unified dashboard.

## Architecture

Two data sources, one decoder, one UI. The hub is the single point of Pokémon-data interpretation.

```
┌──────────────┐   TCP (raw bytes)   ┌───────────────────┐
│  mGBA + Lua  │ ──────────────────► │                   │
│  (collector, │                     │                   │   WebSocket   ┌─────────┐
│   per-game   │                     │    Deno hub       │ ────────────► │ Browser │
│   adapter)   │                     │  (decoder +       │               │   UI    │
└──────────────┘                     │   state store)    │               └─────────┘
                                     │                   │
┌──────────────┐  file watch + read  │                   │
│ saves/*.sav  │ ──────────────────► │                   │
│              │                     │                   │
└──────────────┘                     └───────────────────┘
```

**mGBA Lua script (live source)**
- Per-frame callback reads relevant RAM regions: party, current PC box, enemy party (wild/trainer battles), daycare slots.
- Ships **raw bytes** over a raw TCP socket — no decoding, no JSON beyond a thin envelope identifying the region and game.
- Diffs against the previous snapshot and sends only changed regions.

**Save file watcher (save source)**
- Watches `saves/*.sav` for changes; re-parses on write.
- Handles save sector layout, double-buffer selection, and per-sector checksums before handing raw Pokémon blobs to the decoder.
- Surfaces `.sav` for any supported game — Gen 3 and Gen 4 alike — regardless of which emulator wrote it.

**Deno hub (decoder + relay)**
- **Single source of truth for decoding.** One TypeScript implementation per generation: Gen 3 (100-byte struct, PID/OTID XOR key, `PID mod 24` block shuffle, substructure checksum), Gen 4 (136-byte struct, PID-keyed block shuffle, LCRNG stream cipher).
- Consumes raw blobs from either source, decodes, normalizes to one schema, tags every record with `source: "live"` or `source: "save@<timestamp>"`.
- Holds the latest authoritative snapshot so a browser reconnect gets immediate state.
- Listens for mGBA on one TCP port, watches `saves/` on disk, serves UI (HTTP + WebSocket) on another port.

**Web UI**
- Reactive stores subscribe to the WebSocket feed.
- Views: live party, active encounter overlay, PC box browser, living dex progress board (cross-gen).
- Every panel respects provenance — a Gen 4 box read from a save shows "as of 12 min ago" while the Gen 3 active party shows live.
- A static export step generates the public-facing showcase site from a snapshot.

## Save Analysis

Saves are not a fallback — they are a co-equal data source. For most living-dex questions ("what do I have, where is it, what's my dex progress") they are often the **better** source.

| Data                      | Live (mGBA) | Save parse                  |
| ------------------------- | ----------- | --------------------------- |
| Party / current box       | real-time   | as of last in-game save     |
| All PC boxes at once      | requires swapping | ✅ single pass         |
| Enemy in battle           | ✅          | ❌ (not in save)            |
| Daycare / egg             | real-time   | as of last save             |
| Dex seen/caught flags     | ✅          | ✅                          |
| PID / IV / EV / ribbons   | ✅          | ✅                          |
| Playtime, badges, money   | ✅          | ✅                          |

Save parsing is also the **only** realistic path to Gen 4 under our constraints: melonDS doesn't yet have production-grade scripting, and saves work identically across melonDS, DeSmuME, and real-hardware dumps.

The save parser cross-validates checksums before emitting. A checksum mismatch does not produce "best effort" state — it produces a flagged record that the UI renders as stale/unreliable.

## Target Games

We target the latest revision of each game for its bug fixes. Emerald only ever shipped one English revision.

### Gen 3 (GBA — live + save)

| Game      | Game Code | Target Revision | SHA1                                       | Decomp                                                  |
| --------- | --------- | --------------- | ------------------------------------------ | ------------------------------------------------------- |
| Ruby      | AXVE      | Rev 2           | `5b64eacf892920518db4ec664e62a086dd5f5bc8` | [pret/pokeruby](https://github.com/pret/pokeruby)       |
| Sapphire  | AXPE      | Rev 2           | `89b45fb172e6b55d51fc0e61989775187f6fe63c` | [pret/pokeruby](https://github.com/pret/pokeruby)       |
| Emerald   | BPEE      | Rev 0           | `f3ae088181bf583e55daf962a92bb46f4f1d07b7` | [pret/pokeemerald](https://github.com/pret/pokeemerald) |
| FireRed   | BPRE      | Rev 1           | `dd5945db9b930750cb39d00c84da8571feebf417` | [pret/pokefirered](https://github.com/pret/pokefirered) |
| LeafGreen | BPGE      | Rev 1           | `7862c67bdecbe21d1d69ce082ce34327e1c6ed5e` | [pret/pokefirered](https://github.com/pret/pokefirered) |

ROMs are verified with `scripts/verify-rom.ts` / `deno task verify-roms`. The Lua collector also reads the ROM header at startup and refuses to run on an unrecognized revision rather than reading garbage.

### Gen 4 (DS — save-first, live as optional Phase 3)

Phase 2 targets DPPt and HGSS via save-file parsing. Emulator-agnostic — works with melonDS, DeSmuME, or hardware save dumps. Revisions and decomps to be pinned when we reach Phase 2.

| Game                  | Decomp (reference)                                              |
| --------------------- | --------------------------------------------------------------- |
| Diamond / Pearl       | [pret/pokediamond](https://github.com/pret/pokediamond)         |
| Platinum              | [pret/pokeplatinum](https://github.com/pret/pokeplatinum)       |
| HeartGold / SoulSilver| [pret/pokeheartgold](https://github.com/pret/pokeheartgold)     |

## Offset & Structure Sources

- Each decomp's **`symbols` branch**, e.g. [pret/pokeemerald@symbols](https://github.com/pret/pokeemerald/tree/symbols) — authoritative per-revision RAM/ROM symbol tables.
- [**PKHeX**](https://github.com/kwsch/PKHeX) (MIT) — canonical reference implementation for Pokémon data structures and save formats, Gen 1–9. We do not link it as a runtime dependency; we port the relevant algorithms to TypeScript using PKHeX as our ground truth for anything ambiguous in documentation.
- Ironmon-Tracker's `ironmon_tracker/constants/GameSettings.lua` and `Memory.lua` — already-tested Lua cross-reference for Gen 3 addresses.
- Kaphotics's Gen 3 Lua scripts (linked from PokeLua credits) — canonical early prior art for Gen 3 memory reads.

## Data Structure References

- [Bulbapedia: Pokémon data structure (Generation III)](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_data_structure_(Generation_III)) — 100-byte struct, substructure ordering by `PID mod 24`, XOR key from `PID ^ OTID`, checksum layout.
- [Bulbapedia: Pokémon data structure (Generation IV)](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_data_structure_(Generation_IV)) — 136-byte struct, block shuffle, LCRNG stream cipher.
- [Bulbapedia: Save data structure (Generation III)](https://bulbapedia.bulbagarden.net/wiki/Save_data_structure_(Generation_III)) — save block layout, double-buffer, per-section checksums.
- [Bulbapedia: Save data structure (Generation IV)](https://bulbapedia.bulbagarden.net/wiki/Save_data_structure_(Generation_IV)) — 512 KB save layout for DPPt/HGSS.
- [Project Pokémon — Gen 4 save documentation](https://projectpokemon.org/home/docs/gen-4/) — cross-references and community research notes.
- [mGBA scripting documentation](https://mgba.io/docs/scripting.html) — Lua API for memory reads, frame callbacks, sockets, and the constraint that mGBA Lua **cannot draw overlays** (the reason we push to a browser UI).

## Prior Art and Influences

### PokeScan — [Veridiann/PokeScan](https://github.com/Veridiann/PokeScan)
A macOS IV overlay for Pokémon Emerald using mGBA Lua → TCP → Swift app. Architecturally nearly identical to our Gen 3 live path. We borrow:
- **Project structure** — `lua/core/` + `lua/adapters/` + single sender entry.
- **Catch criteria profiles** — JSON-configurable alerts ("Timid Ralts with ≥25 SpA IV", "any shiny").

### PokéBot Gen3 — [40Cakes/pokebot-gen3](https://github.com/40Cakes/pokebot-gen3)
Python bot using `libmgba-py` to drive the emulator externally. Different host model (we stay inside mGBA Lua for simplicity), but we borrow:
- **pret `symbols` branches** as the offset source.
- **HTTP API** pattern, validating our hub-broadcast design.
- **PKHeX `.pk3` export** — candidate feature for snapshotting Pokémon into a portable format for the public showcase.

### PKHeX — [kwsch/PKHeX](https://github.com/kwsch/PKHeX)
Reference implementation for all Pokémon data structures and save formats, Gen 1–9. Primary source of truth for both our Gen 3 save parser and Gen 4 save parser. Also the conceptual ancestor of our save-analysis feature — a full living dex viewer, offline from any emulator.

### Ironmon-Tracker — [besteon/Ironmon-Tracker](https://github.com/besteon/Ironmon-Tracker)
BizHawk/mGBA Lua tracker for IronMon challenge runs. Opposite philosophy (hides IVs/EVs by design), but we borrow:
- Per-game Lua memory constants as Gen 3 offset cross-reference.
- Confirmation that **mGBA Lua cannot draw on-screen**, reinforcing the browser-UI choice.

### PokeLua — [Real96/PokeLua](https://github.com/Real96/PokeLua)
RNG-focused Lua scripts covering Gen 1–5 across multiple emulators. We borrow:
- **Checksum validation** — Gen 3/4 save sections have checksums; if they fail, memory/save is mid-write or otherwise unreliable. Surface "reads unreliable" rather than emit bad data.
- Links to **Kaphotics's Gen 3 Lua scripts** on Project Pokémon as additional offset reference.

### pokéroo — [barneyboo/pokered-scripts](https://github.com/barneyboo/pokered-scripts)
FireRed gameplay bot (not a tracker), less directly applicable. Its TODO list ("send status updates via sockets", "redirect logging to consume outside of mGBA") independently converges on our socket-out architecture.

## Key Design Decisions

**Decoding lives in the hub, not in the collector.** Lua ships raw bytes; TypeScript decodes. This is the single change that makes live and save sources share a decoder. Unit-testable in pure TS, emulator-independent.

**In-emulator Lua vs. `libmgba-py`.** We use in-emulator Lua for Gen 3 live. The `libmgba-py` approach (pokebot-gen3) gives more power but adds a Python runtime and drives the emulator externally — unnecessary for a read-only tracker.

**Deno over Bun/Node.** Built-in TCP, WebSocket, and filesystem watching in the standard library, first-class TypeScript, explicit permission flags scoping network/file access, and a stability bias that suits a tool we'll return to months later.

**One hub process.** TCP for mGBA, filesystem watcher for saves, HTTP/WS for browser — all one Deno process, one port for the user. Reconnects on any side don't disturb the others.

**Diff-based emission (live path).** Lua does the diff so we aren't pushing 30 KB of JSON at 60 Hz. Only changed regions move across TCP.

**Save parsing is not a fallback.** It's a first-class source. Saves unlock full-PC dashboarding, cross-gen viewing, and Gen 4 entirely. The UI distinguishes `live` from `save@<timestamp>` provenance per record.

**Fail-loud on mismatch.** Unknown ROM header → adapter refuses to start. Save section checksum failure → UI shows a warning rather than render possibly-wrong stats.

**Gen 4 without melonDS scripting.** By leaning on save parsing, Phase 2 Gen 4 is emulator-agnostic. If pre-catch IV checking during Gen 4 encounters becomes important later, Phase 3 revisits live reads via BizHawk's melonDS core.

## Phase Plan

**Phase 1a — Gen 3 live.** mGBA Lua collector (per-game adapter: Ruby, Sapphire, Emerald, FireRed, LeafGreen) → Deno hub Gen 3 decoder → web UI. Active party, current box, wild encounter IV overlay, daycare peek.

**Phase 1b — Gen 3 save analysis.** Reuse the Phase 1a decoder. Add save-file watcher + Gen 3 save sector handler. Unlocks full-PC browsing, cross-save comparison, offline dex view.

**Phase 2 — Gen 4 save analysis.** New Gen 4 decoder (136-byte struct, LCRNG cipher) + Gen 4 save handler. Cross-gen living dex dashboard becomes real. Works across melonDS, DeSmuME, hardware dumps — emulator-agnostic.

**Phase 3 (optional) — Gen 4 live.** BizHawk + melonDS core + Lua. Only pursued if in-encounter IV checking for Gen 4 becomes a priority. Same hub, same decoder, new collector.

## Open Questions

- Frontend framework (Svelte vs. React).
- Phase 1a adapter rollout: all five Gen 3 adapters stubbed up front, or FireRed (the verified dump) end-to-end first and others added as dumps come in?
- Scope of the public showcase site: current living dex only, or a snapshot history with per-mon provenance (game, box, date caught)?
- Save-file watcher cadence: inotify/FSEvents-level on change, or poll-interval fallback for cross-platform robustness?
