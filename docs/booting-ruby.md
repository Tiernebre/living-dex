# Booting Ruby — End-to-End Checklist

Steps to bring the full stack up against Pokémon Ruby (Rev 2) and verify that live party data flows all the way from mGBA to the browser.

## Prerequisites

- mGBA installed with Lua scripting support (stable builds ≥ 0.10 ship with it).
- Deno installed (for the hub).
- Node/npm installed (for the web UI).
- `roms/ruby.gba` present — must be the English Rev 2 dump (SHA1 `5b64eacf892920518db4ec664e62a086dd5f5bc8`). Other revisions are rejected; the only adapter that exists is for rev 2.

## 1. Verify the ROM

```
deno task verify-roms
```

Confirms `roms/ruby.gba` matches the expected SHA1. If this fails, the Lua adapter offsets will point at the wrong RAM and every decoded slot will look like garbage. Stop and re-dump before going further.

## 2. Start the hub

```
deno task dev
```

Expected log lines:

```
[lua-tcp] listening on 127.0.0.1:8889
[hub] http+ws on http://127.0.0.1:8080 (ws at /ws)
```

The hub listens on two ports: TCP 8889 for the mGBA collector, HTTP/WS 8080 for the browser. Start the hub **before** mGBA — the Lua script will fail to connect otherwise and you'll need to reload it.

## 3. Start the web UI

```
cd web && npm install && npm run dev
```

Open the Vite URL it prints (typically `http://localhost:5173`). Before mGBA connects, the UI should show "disconnected" and empty party slots.

## 4. Boot Ruby in mGBA

1. Launch mGBA and open `roms/ruby.gba`.
2. Load your save — the collector only emits meaningful data once a party exists.
3. `Tools → Scripting…` opens the scripting console.
4. `File → Load script…` and pick `lua/main.lua`.

Expected console output:

```
[living-dex] detected ROM: AXVE rev 2
[living-dex] loaded adapter: Ruby
```

If you see `unsupported ROM` here, you're on the wrong revision — see step 1.
If you see `hub not reachable on 127.0.0.1:8889`, the hub isn't running (step 2) or crashed.

On the hub side you should see `[lua-tcp] collector connected` followed by `[lua-tcp] hello: Ruby rev 2`.

## 5. Verify the golden path

With the game running:

- Browser UI flips to "connected" and shows game = Ruby rev 2.
- Walk one step in-game — this forces a frame tick where party RAM is read, diffed, and emitted.
- Party panel populates with real species, level, IVs, nature, nickname.
- Start a wild battle (tall grass works) — enemy party panel fills in too.

If the party slots render but the values look wrong (level 0, garbled nickname, species 0 for obviously-non-empty slots), the most likely causes in order:
1. Wrong ROM revision despite SHA check — re-verify.
2. Adapter addresses drifted — cross-check against `pokeruby_rev2.sym` in `pret/pokeruby` symbols branch.
3. Decoder substructure order or checksum logic — each decoded slot checksum-validates; if checksum fails the slot comes through as `null`, so "empty UI where a Pokémon should be" points here rather than "wrong values".

## 6. Shutting down

Close mGBA (or unload the script) first, then stop the hub. The hub logs `[lua-tcp] collector disconnected` and clears `game` state so the UI shows disconnected again.

## Known limitations

- Only the current party and enemy party are streamed live. Box Pokémon arrive via the save-file watcher, not the Lua collector — editing the PC in-game without saving will not update the UI.
- Non-English Ruby ROMs are not supported; the nickname table only maps English/Latin glyphs.
- Ruby and Sapphire rev 2 share the same RAM layout, so if the Ruby path works the Sapphire path almost certainly does too — but Emerald, FireRed, and LeafGreen adapters are still stubbed with zero offsets and will no-op.
