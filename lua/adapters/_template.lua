-- Adapter interface that every per-game module must implement.
-- Copy this file when adding a new game; fill in the offsets from the game's pret `symbols` branch.
--
-- Every adapter exposes:
--   M.game_code  string, 4-byte ROM code (AXVE, BPEE, ...)
--   M.revision   integer, ROM revision byte (0, 1, 2)
--   M.name       human-readable game name
--   M.addrs      table of RAM addresses (party, box, enemy, daycare, dex, ...)
--   M.sizes      table of byte lengths for each region
--
-- The hub decodes the raw bytes; adapters only say *where* and *how many*.

local M = {}

M.game_code = "XXXX"
M.revision = 0
M.name = "Template"

M.addrs = {
  party = 0x00000000,         -- start of party Pokémon array
  party_count = 0x00000000,   -- u8, number of party members
  box_list = 0x00000000,      -- start of all 14 boxes (PC storage)
  current_box = 0x00000000,   -- u8, currently selected box index
  enemy_party = 0x00000000,   -- enemy party array in battle
  daycare = 0x00000000,       -- daycare slot(s) + egg state
  trainer = 0x00000000,       -- trainer info block (OT name, TID, money, playtime)
  dex_seen = 0x00000000,      -- pokédex seen bitfield
  dex_caught = 0x00000000,    -- pokédex caught bitfield
  save_block_a = 0x00000000,  -- save SRAM mirror block A (for checksum verification)
  save_block_b = 0x00000000,  -- save SRAM mirror block B
}

M.sizes = {
  pokemon_struct = 100,       -- Gen 3 party/box entry size (encrypted)
  party_slots = 6,
  box_slots = 30,
  box_count = 14,
  dex_entries = 386,          -- may be 151 for FRLG pre-National
}

return M
