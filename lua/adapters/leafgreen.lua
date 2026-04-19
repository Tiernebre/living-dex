-- Pokémon LeafGreen (English), Rev 1 — pret/pokefirered `leafgreen_rev1` target.
-- SHA1: 7862c67bdecbe21d1d69ce082ce34327e1c6ed5e

local M = {}

M.game_code = "BPGE"
M.revision = 1
M.name = "LeafGreen"

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
