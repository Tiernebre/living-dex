// Gen 3 Pokémon struct decoder.
// References: Bulbapedia "Pokémon data structure (Generation III)" and PKHeX.
//
// 100-byte party entry layout:
//   0x00 u32   personality value (PID)
//   0x04 u32   OT ID
//   0x08 u8[10] nickname (Gen 3 encoding, 0xFF terminated)
//   0x12 u8    language
//   0x13 u8    misc flags (egg/bad-egg/has-species, etc.)
//   0x14 u8[7] OT name
//   0x1B u8    markings
//   0x1C u16   checksum (sum of u16 LE across decrypted 48 bytes)
//   0x1E u16   unused
//   0x20 u8[48] four 12-byte substructures (encrypted; order = PID % 24)
//   0x50 u32   status condition   ┐
//   0x54 u8    level              │ party-only tail
//   0x55 u8    pokerus            │
//   0x56 u16   current HP         │
//   0x58 u16   max HP             │
//   0x5A u16   atk/def/spe/spa/spd stats ┘
//
// Substructure XOR key = PID ^ OTID, repeated every 4 bytes across the 48.

import type { DecodedPokemon } from "../protocol.ts";

const HEADER_SIZE = 0x20;
const SUBSTRUCT_BLOCK = 48;
const SUBSTRUCT_SIZE = 12;

type Slot = "G" | "A" | "E" | "M";

// 24 permutations of {G, A, E, M} indexed by PID % 24.
// Source: Bulbapedia — "Pokémon data substructures in Generation III".
export const SUBSTRUCTURE_ORDERS: ReadonlyArray<readonly [Slot, Slot, Slot, Slot]> = [
  ["G", "A", "E", "M"], ["G", "A", "M", "E"], ["G", "E", "A", "M"], ["G", "E", "M", "A"],
  ["G", "M", "A", "E"], ["G", "M", "E", "A"], ["A", "G", "E", "M"], ["A", "G", "M", "E"],
  ["A", "E", "G", "M"], ["A", "E", "M", "G"], ["A", "M", "G", "E"], ["A", "M", "E", "G"],
  ["E", "G", "A", "M"], ["E", "G", "M", "A"], ["E", "A", "G", "M"], ["E", "A", "M", "G"],
  ["E", "M", "G", "A"], ["E", "M", "A", "G"], ["M", "G", "A", "E"], ["M", "G", "E", "A"],
  ["M", "A", "G", "E"], ["M", "A", "E", "G"], ["M", "E", "G", "A"], ["M", "E", "A", "G"],
];

const NATURES = [
  "Hardy", "Lonely", "Brave", "Adamant", "Naughty",
  "Bold", "Docile", "Relaxed", "Impish", "Lax",
  "Timid", "Hasty", "Serious", "Jolly", "Naive",
  "Modest", "Mild", "Quiet", "Bashful", "Rash",
  "Calm", "Gentle", "Sassy", "Careful", "Quirky",
];

// Gen 3 English character table. Only the glyphs we expect in nicknames/OT names
// are mapped; unknown bytes before the 0xFF terminator become "?".
// Source: Bulbapedia "Character encoding (Generation III)".
const CHAR_TABLE: Record<number, string> = (() => {
  const t: Record<number, string> = { 0x00: " " };
  for (let i = 0; i < 10; i++) t[0xA1 + i] = String.fromCharCode(0x30 + i); // 0-9
  const punct: Record<number, string> = {
    0xAB: "!", 0xAC: "?", 0xAD: ".", 0xAE: "-", 0xAF: "·",
    0xB0: "…", 0xB1: "“", 0xB2: "”", 0xB3: "‘", 0xB4: "’",
    0xB5: "♂", 0xB6: "♀", 0xB7: "$", 0xB8: ",", 0xB9: "×",
    0xBA: "/", 0xEF: ":", 0xF0: "Ä", 0xF1: "Ö", 0xF2: "Ü",
    0xF3: "ä", 0xF4: "ö", 0xF5: "ü",
  };
  Object.assign(t, punct);
  for (let i = 0; i < 26; i++) t[0xBB + i] = String.fromCharCode(0x41 + i); // A-Z
  for (let i = 0; i < 26; i++) t[0xD5 + i] = String.fromCharCode(0x61 + i); // a-z
  return t;
})();

function decodeName(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    if (b === 0xFF) break;
    out += CHAR_TABLE[b] ?? "";
  }
  return out;
}

function readU16LE(bytes: Uint8Array, o: number): number {
  return bytes[o] | (bytes[o + 1] << 8);
}

function readU32LE(bytes: Uint8Array, o: number): number {
  return (
    (bytes[o]) |
    (bytes[o + 1] << 8) |
    (bytes[o + 2] << 16) |
    (bytes[o + 3] << 24)
  ) >>> 0;
}

function isAllZero(bytes: Uint8Array): boolean {
  for (const b of bytes) if (b !== 0) return false;
  return true;
}

function decryptSubstructures(enc: Uint8Array, key: number): Uint8Array {
  const out = new Uint8Array(SUBSTRUCT_BLOCK);
  for (let i = 0; i < SUBSTRUCT_BLOCK; i += 4) {
    const word = readU32LE(enc, i);
    const dec = (word ^ key) >>> 0;
    out[i] = dec & 0xFF;
    out[i + 1] = (dec >>> 8) & 0xFF;
    out[i + 2] = (dec >>> 16) & 0xFF;
    out[i + 3] = (dec >>> 24) & 0xFF;
  }
  return out;
}

function sumChecksum(decrypted: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < SUBSTRUCT_BLOCK; i += 2) {
    sum = (sum + readU16LE(decrypted, i)) & 0xFFFF;
  }
  return sum;
}

function pickSubstruct(decrypted: Uint8Array, order: readonly Slot[], which: Slot): Uint8Array {
  const idx = order.indexOf(which);
  return decrypted.subarray(idx * SUBSTRUCT_SIZE, (idx + 1) * SUBSTRUCT_SIZE);
}

export function decodePokemon(bytes: Uint8Array): DecodedPokemon | null {
  if (bytes.length < HEADER_SIZE + SUBSTRUCT_BLOCK) return null;
  if (isAllZero(bytes)) return null;

  const pid = readU32LE(bytes, 0x00);
  const otid = readU32LE(bytes, 0x04);
  const storedChecksum = readU16LE(bytes, 0x1C);
  const key = (pid ^ otid) >>> 0;

  const decrypted = decryptSubstructures(bytes.subarray(0x20, 0x20 + SUBSTRUCT_BLOCK), key);
  if (sumChecksum(decrypted) !== storedChecksum) return null;

  const order = SUBSTRUCTURE_ORDERS[pid % 24];
  const G = pickSubstruct(decrypted, order, "G");
  const A = pickSubstruct(decrypted, order, "A");
  const M = pickSubstruct(decrypted, order, "M");
  const E = pickSubstruct(decrypted, order, "E");

  const species = readU16LE(G, 0);
  if (species === 0) return null;

  const ivsRaw = readU32LE(M, 4);
  const ivs = {
    hp:  ivsRaw        & 0x1F,
    atk: (ivsRaw >>> 5)  & 0x1F,
    def: (ivsRaw >>> 10) & 0x1F,
    spe: (ivsRaw >>> 15) & 0x1F,
    spa: (ivsRaw >>> 20) & 0x1F,
    spd: (ivsRaw >>> 25) & 0x1F,
  };
  const evs = {
    hp: E[0], atk: E[1], def: E[2], spe: E[3], spa: E[4], spd: E[5],
  };

  // Party tail: if all zero, this is a BoxPokemon (80 bytes effective) — use G's growth level.
  const hasPartyTail = bytes.length >= 0x55 && bytes[0x54] !== 0;
  const level = hasPartyTail ? bytes[0x54] : 0;

  const moves = [
    { id: readU16LE(A, 0), pp: A[8] },
    { id: readU16LE(A, 2), pp: A[9] },
    { id: readU16LE(A, 4), pp: A[10] },
    { id: readU16LE(A, 6), pp: A[11] },
  ].filter((m) => m.id !== 0);

  return {
    pid,
    species,
    nickname: decodeName(bytes.subarray(0x08, 0x12)),
    level,
    ivs,
    evs,
    nature: NATURES[pid % 25],
    moves,
  };
}
