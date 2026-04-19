// Gen 3 Pokémon struct decoder.
// Reference: Bulbapedia — Pokémon data structure (Generation III) + PKHeX source.
//
// 100-byte layout:
//   0x00  u32   personality value (PID)
//   0x04  u32   OT ID
//   0x08  char[10]  nickname (Gen 3 encoding)
//   0x12  u16   language
//   0x14  char[7]   OT name
//   0x1B  u8    markings
//   0x1C  u16   checksum of the 4 encrypted substructures
//   0x1E  u16   padding
//   0x20  u8[48] four 12-byte substructures (encrypted, order determined by PID % 24)
//   0x50  u8    status condition (party only)
//   0x51  u8    level (party only)
//   0x52  u8    pokerus remaining (party only)
//   0x53  u8    current HP lo (party only)
//   ... stats follow (party only)
//
// Substructure XOR key = PID ^ OTID, applied to each 12-byte block.
// Order of G/A/E/M within the 48 bytes is one of 24 permutations indexed by (PID % 24).

import type { DecodedPokemon } from "../protocol.ts";

export function decodePokemon(_bytes: Uint8Array): DecodedPokemon | null {
  // TODO: implement
  //  1. Read PID (u32 LE) at 0x00, OTID (u32 LE) at 0x04.
  //  2. If bytes are all zero or species == 0, return null (empty slot).
  //  3. XOR-decrypt the 48-byte substructure block with (PID ^ OTID), 4 bytes at a time.
  //  4. Verify checksum at 0x1C against sum of u16s in decrypted 48 bytes.
  //  5. Unshuffle the four 12-byte substructures per SUBSTRUCTURE_ORDERS[PID % 24].
  //  6. Parse G (growth), A (attacks), E (EVs/condition), M (misc) substructures.
  //  7. Decode the Gen 3 character-encoded nickname & OT name.
  //  8. For party mons, parse the 20-byte status/stats tail at 0x50.
  return null;
}

// The 24 permutations of {G, A, E, M} indexed by PID % 24.
// See Bulbapedia for the canonical table.
export const SUBSTRUCTURE_ORDERS: ReadonlyArray<readonly ["G" | "A" | "E" | "M", "G" | "A" | "E" | "M", "G" | "A" | "E" | "M", "G" | "A" | "E" | "M"]> = [
  // TODO: fill in all 24 rows from Bulbapedia / PKHeX.
];

// TODO: Gen 3 character encoding table (260+ glyphs) for nickname/OT decode.
