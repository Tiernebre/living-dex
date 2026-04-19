-- Pokémon Emerald (English), Rev 0 — pret/pokeemerald default target.
-- SHA1: f3ae088181bf583e55daf962a92bb46f4f1d07b7

local M = {}

M.game_code = "BPEE"
M.revision = 0
M.name = "Emerald"

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
