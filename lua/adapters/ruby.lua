-- Pokémon Ruby (English), Rev 2 — pret/pokeruby `ruby_rev2` target.
-- SHA1: 5b64eacf892920518db4ec664e62a086dd5f5bc8
-- Offsets TODO: pull from pret/pokeruby symbols branch (ruby_rev2) and cross-reference
-- with Ironmon-Tracker's GameSettings.lua and Kaphotics's scripts.

local M = {}

M.game_code = "AXVE"
M.revision = 2
M.name = "Ruby"

M.addrs = {
  party = 0x0,            -- TODO: gPlayerParty
  party_count = 0x0,      -- TODO: gPlayerPartyCount
  box_list = 0x0,         -- TODO: gPokemonStoragePtr or equivalent
  current_box = 0x0,      -- TODO
  enemy_party = 0x0,      -- TODO: gEnemyParty
  daycare = 0x0,          -- TODO: gSaveBlock1Ptr->daycare
  trainer = 0x0,          -- TODO: gSaveBlock2Ptr (name, TID, playtime)
  dex_seen = 0x0,         -- TODO
  dex_caught = 0x0,       -- TODO
  save_block_a = 0x0,     -- TODO: SRAM save slot A
  save_block_b = 0x0,     -- TODO: SRAM save slot B
}

M.sizes = {
  pokemon_struct = 100,
  party_slots = 6,
  box_slots = 30,
  box_count = 14,
  dex_entries = 386,
}

return M
