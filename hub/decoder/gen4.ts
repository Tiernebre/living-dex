// Gen 4 Pokémon struct decoder (D/P/Pt + HG/SS share the 136-byte BoxPokemon
// layout and encryption scheme — HGSS only differs in the party-stat tail and
// adds extra fields in block D).
// References: Bulbapedia "Pokémon data structure (Generation IV)", PKHeX
// PKM4.cs + PokeCrypto.DecryptArray45, pokediamond/include/pokemon.h.
//
// 136-byte BoxPokemon layout:
//   0x00 u32   PID
//   0x04 u16   unused (zero)
//   0x06 u16   checksum (u16-sum of bytes 0x08..0x87 after decrypt)
//   0x08 u8[128] four 32-byte blocks A/B/C/D — shuffled by ((PID>>13)&31)%24,
//                then each u16 XOR'd with an LCRNG stream seeded by checksum.
//
// 236-byte Party Pokemon adds a 100-byte stats tail at 0x88..0xEB, encrypted
// with the SAME LCRNG but seeded with the PID. Box-storage entries stop at
// 0x88 and use hasPartyTail = false.

import type { DecodedPokemon } from "../protocol.ts";

const BOX_SIZE = 136;
const PARTY_SIZE = 236;
const BLOCK_SIZE = 32;
const BLOCKS_BASE = 0x08;
const PARTY_TAIL_BASE = 0x88;
const PARTY_TAIL_SIZE = 100;

// 24 permutations of {A,B,C,D} indexed by ((PID >> 13) & 0x1F) % 24.
// Source: Bulbapedia "Pokémon data substructures in Generation IV".
type Block = "A" | "B" | "C" | "D";
const BLOCK_ORDERS: ReadonlyArray<readonly [Block, Block, Block, Block]> = [
  ["A", "B", "C", "D"], ["A", "B", "D", "C"], ["A", "C", "B", "D"], ["A", "C", "D", "B"],
  ["A", "D", "B", "C"], ["A", "D", "C", "B"], ["B", "A", "C", "D"], ["B", "A", "D", "C"],
  ["B", "C", "A", "D"], ["B", "C", "D", "A"], ["B", "D", "A", "C"], ["B", "D", "C", "A"],
  ["C", "A", "B", "D"], ["C", "A", "D", "B"], ["C", "B", "A", "D"], ["C", "B", "D", "A"],
  ["C", "D", "A", "B"], ["C", "D", "B", "A"], ["D", "A", "B", "C"], ["D", "A", "C", "B"],
  ["D", "B", "A", "C"], ["D", "B", "C", "A"], ["D", "C", "A", "B"], ["D", "C", "B", "A"],
];

const NATURES = [
  "Hardy", "Lonely", "Brave", "Adamant", "Naughty",
  "Bold", "Docile", "Relaxed", "Impish", "Lax",
  "Timid", "Hasty", "Serious", "Jolly", "Naive",
  "Modest", "Mild", "Quiet", "Bashful", "Rash",
  "Calm", "Gentle", "Sassy", "Careful", "Quirky",
];

// Gen 4 character table. Each glyph is a u16 code unit — we only map the
// ASCII-equivalent printable subset we actually see in names. Unmapped bytes
// are dropped silently (the games use plenty of symbols we can't render here).
// 0x0121-0x012A '0'-'9' · 0x012B-0x0144 'A'-'Z' · 0x0145-0x015E 'a'-'z'.
// 0x01DE is the in-game half-width space used in the default BOX 1..18 names
// and between words in trainer/Pokémon names.
// Source: pokeheartgold/data/text/charbase.csv (the DP/Pt/HGSS charmaps match
// for the Latin block).
const GEN4_CHARMAP: Record<number, string> = (() => {
  const m: Record<number, string> = {};
  m[0x01DE] = " ";
  for (let i = 0; i < 10; i++) m[0x0121 + i] = String.fromCharCode(48 + i);
  for (let i = 0; i < 26; i++) m[0x012B + i] = String.fromCharCode(65 + i);
  for (let i = 0; i < 26; i++) m[0x0145 + i] = String.fromCharCode(97 + i);
  m[0x01AB] = ".";
  m[0x01AC] = ",";
  m[0x01AD] = "!";
  m[0x01AE] = "?";
  m[0x01B0] = "♂";
  m[0x01B1] = "♀";
  m[0x01B2] = "/";
  m[0x01B3] = "'";
  m[0x01B4] = '"';
  m[0x01B5] = "“";
  m[0x01B6] = "”";
  m[0x01B7] = "‘";
  m[0x01B8] = "’";
  m[0x01B9] = "(";
  m[0x01BA] = ")";
  m[0x01C0] = "-";
  return m;
})();

export function decodeGen4Name(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    if (code === 0xFFFF || code === 0x0000) break;
    out += GEN4_CHARMAP[code] ?? "";
  }
  return out;
}

// LCRNG advance used for Gen 4 save encryption:
//   seed = (seed * 0x41C64E6D + 0x6073) mod 2^32
// Each u16 of ciphertext is XOR'd with (seed >>> 16) from the NEXT seed — i.e.
// we advance first, then XOR. JS bitwise ops are signed 32-bit, so the
// multiply is done by splitting both operands into u16 halves and combining
// via plain Number arithmetic (safe since each partial product is ≤ 2^32-1).
function advance(seed: number): number {
  const sh = seed >>> 16;
  const sl = seed & 0xFFFF;
  const lowProduct = sl * 0x4E6D;
  const midProduct = sh * 0x4E6D + sl * 0x41C6 + (lowProduct >>> 16);
  const mul = ((((midProduct & 0xFFFF) << 16) >>> 0) | (lowProduct & 0xFFFF)) >>> 0;
  return (mul + 0x6073) >>> 0;
}

function cryptRegion(bytes: Uint8Array, seedInit: number): Uint8Array {
  const out = new Uint8Array(bytes.length);
  let seed = seedInit;
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    seed = advance(seed);
    const rand = seed >>> 16;
    const word = bytes[i] | (bytes[i + 1] << 8);
    const dec = word ^ rand;
    out[i] = dec & 0xFF;
    out[i + 1] = (dec >>> 8) & 0xFF;
  }
  return out;
}

function readU16(bytes: Uint8Array, o: number): number {
  return bytes[o] | (bytes[o + 1] << 8);
}

function readU32(bytes: Uint8Array, o: number): number {
  return ((bytes[o]) | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0;
}

function sumChecksum(decrypted: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < decrypted.length; i += 2) {
    sum = (sum + readU16(decrypted, i)) & 0xFFFF;
  }
  return sum;
}

function isAllZero(bytes: Uint8Array): boolean {
  for (const b of bytes) if (b !== 0) return false;
  return true;
}

function pickBlock(unshuffled: Uint8Array, order: readonly Block[], which: Block): Uint8Array {
  const idx = order.indexOf(which);
  return unshuffled.subarray(idx * BLOCK_SIZE, (idx + 1) * BLOCK_SIZE);
}

export function decodePokemon4(bytes: Uint8Array): DecodedPokemon | null {
  if (bytes.length < BOX_SIZE) return null;
  if (isAllZero(bytes)) return null;

  const pid = readU32(bytes, 0x00);
  const storedChecksum = readU16(bytes, 0x06);

  const shuffled = cryptRegion(bytes.subarray(BLOCKS_BASE, BLOCKS_BASE + 4 * BLOCK_SIZE), storedChecksum);
  if (sumChecksum(shuffled) !== storedChecksum) return null;

  const order = BLOCK_ORDERS[((pid >>> 13) & 0x1F) % 24];
  const A = pickBlock(shuffled, order, "A");
  const B = pickBlock(shuffled, order, "B");
  const C = pickBlock(shuffled, order, "C");
  const D = pickBlock(shuffled, order, "D");

  const species = readU16(A, 0x00);
  if (species === 0) return null;
  const heldItem = readU16(A, 0x02);
  void heldItem;
  const tid = readU16(A, 0x04);
  const sid = readU16(A, 0x06);
  const otId = ((sid << 16) | tid) >>> 0;
  const experience = readU32(A, 0x08);
  const ability = A[0x0D];
  void ability;
  const evs = { hp: A[0x10], atk: A[0x11], def: A[0x12], spe: A[0x13], spa: A[0x14], spd: A[0x15] };
  const contest = {
    cool: A[0x16], beauty: A[0x17], cute: A[0x18], smart: A[0x19], tough: A[0x1A], sheen: A[0x1B],
  };

  const moves = [
    { id: readU16(B, 0x00), pp: B[0x08] },
    { id: readU16(B, 0x02), pp: B[0x09] },
    { id: readU16(B, 0x04), pp: B[0x0A] },
    { id: readU16(B, 0x06), pp: B[0x0B] },
  ].filter((m) => m.id !== 0);

  const ivsRaw = readU32(B, 0x10);
  const ivs = {
    hp:  ivsRaw        & 0x1F,
    atk: (ivsRaw >>> 5)  & 0x1F,
    def: (ivsRaw >>> 10) & 0x1F,
    spe: (ivsRaw >>> 15) & 0x1F,
    spa: (ivsRaw >>> 20) & 0x1F,
    spd: (ivsRaw >>> 25) & 0x1F,
  };
  const isEgg = ((ivsRaw >>> 30) & 1) === 1;

  // Gen 4 lost Gen 3's IV-bit ability flag. Keep abilityBit = 0 so the
  // DecodedPokemon shape matches.
  const abilityBit = 0 as const;

  const nickname = decodeGen4Name(C.subarray(0x00, 0x16));
  const originGame = C[0x17];

  const otName = decodeGen4Name(D.subarray(0x00, 0x10));
  const metLocation = readU16(D, 0x1A);
  const metLevelByte = D[0x1E];
  const metLevel = metLevelByte & 0x7F;
  const otGender: "male" | "female" = ((metLevelByte >>> 7) & 1) === 0 ? "male" : "female";

  // Party tail is encrypted with seed=PID. Level lives at +0x04 (u8).
  // Box-storage entries are only 136 bytes, so skip when not present.
  let level = 0;
  if (bytes.length >= PARTY_TAIL_BASE + PARTY_TAIL_SIZE) {
    const tail = cryptRegion(bytes.subarray(PARTY_TAIL_BASE, PARTY_TAIL_BASE + PARTY_TAIL_SIZE), pid);
    level = tail[0x04];
  }

  return {
    pid,
    species,
    nickname,
    level,
    experience,
    abilityBit,
    ivs,
    evs,
    nature: NATURES[pid % 25],
    contest,
    moves,
    otName,
    otId,
    otGender,
    metLevel,
    metLocation: metLevel === 0 ? null : metLocation,
    originGame,
    isEgg,
  };
}
