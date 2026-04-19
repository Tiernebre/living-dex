-- Pokémon Sapphire (English), Rev 2 — pret/pokeruby `sapphire_rev2` target.
-- SHA1: 89b45fb172e6b55d51fc0e61989775187f6fe63c
-- Symbols sourced from pret/pokeruby `symbols` branch, file `pokesapphire_rev2.sym`.
-- Ruby and Sapphire rev 2 are the same engine build — addresses match byte-for-byte.

local M = {}

M.game_code = "AXPE"
M.revision = 2
M.name = "Sapphire"

local SAVE_BLOCK_1 = 0x02025734
local SAVE_BLOCK_2 = 0x02024EA4
local POKEMON_STORAGE = 0x020300A0

M.addrs = {
  party = 0x03004360,
  party_count = 0x03004350,
  enemy_party = 0x030045C0,
  battle_flags = 0x03001BAD,
  current_box = POKEMON_STORAGE + 0x0000,
  box_list = POKEMON_STORAGE + 0x0004,
  daycare = SAVE_BLOCK_1 + 0x2F9C,
  trainer = SAVE_BLOCK_2 + 0x0000,
  dex_caught = SAVE_BLOCK_2 + 0x0028,
  dex_seen = SAVE_BLOCK_2 + 0x005C,
  save_block_a = SAVE_BLOCK_1,
  save_block_b = SAVE_BLOCK_2,
}

M.sizes = {
  pokemon_struct = 100,
  box_struct = 80,
  party_slots = 6,
  box_slots = 30,
  box_count = 14,
  dex_entries = 386,
  dex_flags_bytes = 49,
  daycare_bytes = 0x112,
  trainer_bytes = 14,
}

return M
