-- Living Dex — mGBA collector entry point.
-- Load in mGBA: Tools → Scripting → Load script → lua/main.lua
--
-- Responsibilities:
--   1. Identify the running ROM (game code + revision).
--   2. Load the matching adapter. Refuse to run on unrecognized ROMs.
--   3. Connect to the Deno hub over TCP.
--   4. On each frame callback, read relevant RAM regions, diff, emit deltas.

package.path = package.path .. ";./lua/?.lua;./lua/?/init.lua"

local rom = require("core.rom")
local socket_client = require("core.socket")
local envelope = require("core.envelope")
local memory = require("core.memory")

local ADAPTERS = {
  ["AXVE"] = { [2] = "adapters.ruby" },
  ["AXPE"] = { [2] = "adapters.sapphire" },
  ["BPEE"] = { [0] = "adapters.emerald" },
  ["BPRE"] = { [1] = "adapters.firered" },
  ["BPGE"] = { [1] = "adapters.leafgreen" },
}

local function resolve_adapter(code, revision)
  local by_code = ADAPTERS[code]
  if not by_code then return nil end
  local module_name = by_code[revision]
  if not module_name then return nil end
  return require(module_name)
end

-- region checksums so we only emit when something actually changes
local last = {}

local function emit_region(region_id, index, addr, length)
  if addr == 0 or length == 0 then return end
  local bytes = memory.read_bytes(addr, length)
  local ck = memory.checksum(bytes)
  local key = region_id .. ":" .. index
  if last[key] == ck then return end
  last[key] = ck
  socket_client.send(envelope.frame(envelope.TYPE.REGION, region_id, index, bytes))
end

local adapter = nil
local frame_cb_id = nil

local function on_frame()
  if not adapter then return end
  if not socket_client.is_connected() then return end

  local a = adapter.addrs
  local s = adapter.sizes

  -- whole party (6 slots × 100 bytes)
  emit_region(envelope.REGION.PARTY, 0, a.party, s.pokemon_struct * s.party_slots)

  -- battle state flag (u8 gMain.inBattle; bit 1 set = in battle)
  emit_region(envelope.REGION.BATTLE, 0, a.battle_flags or 0, 1)

  -- enemy party (wild encounter / trainer battle)
  emit_region(envelope.REGION.ENEMY_PARTY, 0, a.enemy_party, s.pokemon_struct * s.party_slots)

  -- current map location (mapGroup, mapNum)
  emit_region(envelope.REGION.LOCATION, 0, a.location or 0, 2)

  -- daycare slot
  emit_region(envelope.REGION.DAYCARE, 0, a.daycare, 200) -- TODO: real size per adapter

  -- current box only (cheap). Full-box sweep is handled by save-file parsing.
  -- TODO: resolve current_box index, then read that single box (30 × 100 bytes).
end

local function boot()
  local code, revision = rom.read()
  console:log(string.format("[living-dex] detected ROM: %s rev %d", code, revision))

  adapter = resolve_adapter(code, revision)
  if not adapter then
    console:error(string.format(
      "[living-dex] unsupported ROM: %s rev %d. Only the latest revisions are supported — see docs/technical-foundation.md.",
      code, revision
    ))
    return
  end

  console:log(string.format("[living-dex] loaded adapter: %s", adapter.name))

  if not socket_client.connect() then
    console:error("[living-dex] hub not reachable on 127.0.0.1:8889 — start `deno task dev` first")
    return
  end

  socket_client.send(envelope.hello(adapter.game_code, adapter.revision))
  frame_cb_id = callbacks:add("frame", on_frame)
end

local function shutdown()
  if frame_cb_id then
    callbacks:remove(frame_cb_id)
    frame_cb_id = nil
  end
  socket_client.close()
  adapter = nil
end

callbacks:add("shutdown", shutdown)

boot()
