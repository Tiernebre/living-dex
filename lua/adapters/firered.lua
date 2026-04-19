-- Pokémon FireRed (English), Rev 1 — pret/pokefirered `firered_rev1` target.
-- SHA1: dd5945db9b930750cb39d00c84da8571feebf417
-- Note: FRLG uses National Dex unlock state for dex size (151 pre-unlock, 386 post).

local M = {}

M.game_code = "BPRE"
M.revision = 1
M.name = "FireRed"

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
