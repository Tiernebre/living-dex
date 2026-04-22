-- Pokémon Ruby (English), Rev 2 — pret/pokeruby `ruby_rev2` target.
-- SHA1: 5b64eacf892920518db4ec664e62a086dd5f5bc8
-- Symbols sourced from pret/pokeruby `symbols` branch, file `pokeruby_rev2.sym`.
-- Struct field offsets sourced from pret/pokeruby `include/global.h` on master.

local M = {}

M.game_code = "AXVE"
M.revision = 2
M.name = "Ruby"

-- Ruby/Sapphire keep SaveBlock1/2 at fixed EWRAM addresses (no DMA shuffle,
-- unlike FR/LG/Emerald where they're reached via gSaveBlock*Ptr).
local SAVE_BLOCK_1 = 0x02025734  -- gSaveBlock1, size 0x3AC0
local SAVE_BLOCK_2 = 0x02024EA4  -- gSaveBlock2, size 0x0890
local POKEMON_STORAGE = 0x020300A0  -- gPokemonStorage, size 0x83D0

M.addrs = {
  party = 0x03004360,                          -- gPlayerParty
  party_count = 0x03004350,                    -- gPlayerPartyCount (u8)
  enemy_party = 0x030045C0,                    -- gEnemyParty
  battle_flags = 0x03001BAD,                   -- gMain.inBattle (u8; bit 1 set = in battle)
  current_box = POKEMON_STORAGE + 0x0000,      -- PokemonStorage.currentBox (u8)
  box_list = POKEMON_STORAGE + 0x0004,         -- PokemonStorage.boxes[14][30]
  location = SAVE_BLOCK_1 + 0x0004,            -- SaveBlock1.location (WarpData: mapGroup s8, mapNum s8, ...)
  daycare = SAVE_BLOCK_1 + 0x2F9C,             -- SaveBlock1.daycare
  trainer = SAVE_BLOCK_2 + 0x0000,             -- playerName[8] @0, TID @0x0A, playTime @0x0E
  dex_caught = SAVE_BLOCK_2 + 0x0028,          -- SaveBlock2.pokedex (0x18) + owned (0x10)
  dex_seen = SAVE_BLOCK_2 + 0x005C,            -- SaveBlock2.pokedex (0x18) + seen (0x44)
  save_block_a = SAVE_BLOCK_1,
  save_block_b = SAVE_BLOCK_2,
  local_time = 0x03004038,                     -- gLocalTime (struct Time, 8 bytes), updated by RtcCalcLocalTime
}

M.sizes = {
  pokemon_struct = 100,   -- PartyPokemon
  box_struct = 80,        -- BoxPokemon (no status/HP/level/power cache)
  party_slots = 6,
  box_slots = 30,
  box_count = 14,
  dex_entries = 386,
  dex_flags_bytes = 49,   -- ceil(386 / 8)
  daycare_bytes = 0x112,  -- struct DayCare
  trainer_bytes = 14,     -- playerName[8] + gender + flag + TID[4]
}

return M
