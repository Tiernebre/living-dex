-- Pokémon Sapphire (English), Rev 2 — pret/pokeruby `sapphire_rev2` target.
-- SHA1: 89b45fb172e6b55d51fc0e61989775187f6fe63c

local M = {}

M.game_code = "AXPE"
M.revision = 2
M.name = "Sapphire"

M.addrs = {
  party = 0x0,
  party_count = 0x0,
  box_list = 0x0,
  current_box = 0x0,
  enemy_party = 0x0,
  daycare = 0x0,
  trainer = 0x0,
  dex_seen = 0x0,
  dex_caught = 0x0,
  save_block_a = 0x0,
  save_block_b = 0x0,
}

M.sizes = {
  pokemon_struct = 100,
  party_slots = 6,
  box_slots = 30,
  box_count = 14,
  dex_entries = 386,
}

return M
