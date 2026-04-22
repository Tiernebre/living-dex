// Parse a Pokémon XD: Gale of Darkness save (GameCube .gci memory card file).
// Sister format to Colosseum but materially different: GeniusCrypto (subtract
// a 4-key schedule from each u16 BE) instead of SHA-1 keystream; 2 slots of
// 0x28000 instead of 3 × 0x1E000; XK3 mon struct (196 B) instead of CK3 (312 B);
// block offsets live in a sub-offset table rather than at fixed slot addresses.
// Reference: PKHeX SAV3XD.cs + XDCrypto.cs + GeniusCrypto.cs + XK3.cs.
//
// File layout (after an optional 0x40 GCI header):
//   0x00000..0x06000   memory-card banner/icon/comment region (ignored)
//   0x06000..0x2E000   save slot 0
//   0x2E000..0x56000   save slot 1   (each slot = 0x28000 bytes)
//
// Per slot:
//   0x00000..0x00008   header (magic + big-endian u32 saveCounter at +0x04)
//   0x00008..0x00010   4 × u16 BE encryption keys
//   0x00010..0x27FD8   encrypted body
//   0x27FD8..0x28000   trailing unencrypted region
//
// Active slot = the one with the highest u32 BE saveCounter at slot+0x04.
//
// Cipher (GeniusCrypto): read 4 × u16 BE keys k[0..3] from slot+0x08. For each
// u16 BE value V in the encrypted range: plaintext = V - k[i & 3]. After every
// 4 u16s, advance the keys: add biases [0x43, 0x29, 0x17, 0x13] to k[0..3],
// then nibble-shuffle across the 4×4 diagonal (see advanceKeys below).
//
// Inside the decrypted slot:
//   [0x20, 0x40)        16 × u16 BE  subLength[i]
//   [0x40, 0x80)        16 × u32     subOffsets[i] — stored as { u16 BE low,
//                                    u16 BE high } in memory order (mixed
//                                    endian between halves)
//
// Then all real sections sit at subOffsets[i] + 0xA8 relative to slot start:
//   Config    = subOffsets[0] + 0xA8   — GC game idx, region, language, playtime
//   Trainer1  = subOffsets[1] + 0xA8   — OT name, TID/SID, gender, money
//   Party     = Trainer1 + 0x30        — 6 × 196 B XK3 slots (no stored count)
//   Box       = subOffsets[2] + 0xA8   — 8 boxes, each 20 B name + 30 × 196 B
//   Memo      = subOffsets[5] + 0xA8   — StrategyMemo (dex-ish)
//   Shadow    = subOffsets[7] + 0xA8   — ShadowInfoTable (Purification data)
//
// Japanese saves use f32 BE playtime at Config+0x20; NTSC_U/PAL use f64 BE at
// Config+0x30. Detect via subLength[7] == 0x1E00 (JP has a shorter shadow table).

import type { BoxInfo, DecodedPokemon, GameStem, SaveInfo } from "../protocol.ts";

const GCI_HEADER_SIZE = 0x40;
const SAVE_SIZE = 0x56000;
const SLOT_START = 0x6000;
const SLOT_SIZE = 0x28000;
const SLOT_COUNT = 2;

const KEY_OFFSET = 0x08;
const ENCRYPT_BEGIN = 0x10;
const ENCRYPT_END = 0x27FD8;

const SUBLEN_OFFSET = 0x20;
const SUBOFF_OFFSET = 0x40;
const SUBOFF_BASE = 0xA8;

const TRAINER_NAME_CHARS = 10;
const XK3_SIZE = 196;
const PARTY_SLOTS = 6;
const PARTY_SUBOFFSET = 0x30;

const BOX_COUNT = 8;
const SLOTS_PER_BOX = 30;
const BOX_NAME_BYTES = 16;
const BOX_NAME_CHARS = 8;
const BOX_HEADER_SIZE = 0x14;
const BOX_STRIDE = SLOTS_PER_BOX * XK3_SIZE + BOX_HEADER_SIZE;

const NATURES = [
  "Hardy", "Lonely", "Brave", "Adamant", "Naughty",
  "Bold", "Docile", "Relaxed", "Impish", "Lax",
  "Timid", "Hasty", "Serious", "Jolly", "Naive",
  "Modest", "Mild", "Quiet", "Bashful", "Rash",
  "Calm", "Gentle", "Sassy", "Careful", "Quirky",
];

// Colosseum/XD text is UCS-2 big-endian, same as save-colosseum.ts — glyphs
// for the ASCII range are Unicode code points, and two Nintendo PUA glyphs
// map to ♂/♀.
function decodeGCString(bytes: Uint8Array, maxChars: number): string {
  let out = "";
  const limit = Math.min(bytes.length, maxChars * 2);
  for (let i = 0; i + 1 < limit; i += 2) {
    const code = (bytes[i] << 8) | bytes[i + 1];
    if (code === 0) break;
    if (code === 0x246D) out += "♂";
    else if (code === 0x246E) out += "♀";
    else out += String.fromCharCode(code);
  }
  return out;
}

// Nibble-rotate the keys across a 4x4 diagonal after biasing each by a fixed
// constant. Matches GeniusCrypto.AdvanceKeys in PKHeX exactly; see the ASCII
// diagram in that file for the permutation.
function advanceKeys(k: Uint16Array): void {
  const k3 = (k[3] + 0x13) & 0xFFFF;
  const k2 = (k[2] + 0x17) & 0xFFFF;
  const k1 = (k[1] + 0x29) & 0xFFFF;
  const k0 = (k[0] + 0x43) & 0xFFFF;
  k[3] = (((k0 >> 12) & 0xF) | ((k1 >> 8) & 0xF0) | ((k2 >> 4) & 0xF00) | ( k3        & 0xF000)) & 0xFFFF;
  k[2] = (((k0 >> 8)  & 0xF) | ((k1 >> 4) & 0xF0) | ( k2        & 0xF00) | ((k3 << 4)  & 0xF000)) & 0xFFFF;
  k[1] = (((k0 >> 4)  & 0xF) | ( k1       & 0xF0) | ((k2 << 4)  & 0xF00) | ((k3 << 8)  & 0xF000)) & 0xFFFF;
  k[0] = (( k0        & 0xF) | ((k1 << 4) & 0xF0) | ((k2 << 8)  & 0xF00) | ((k3 << 12) & 0xF000)) & 0xFFFF;
}

function decryptSlot(slot: Uint8Array): void {
  const keys = new Uint16Array(4);
  for (let i = 0; i < 4; i++) {
    keys[i] = (slot[KEY_OFFSET + i * 2] << 8) | slot[KEY_OFFSET + i * 2 + 1];
  }
  let keyIdx = 0;
  for (let off = ENCRYPT_BEGIN; off < ENCRYPT_END; off += 2) {
    const cipher = (slot[off] << 8) | slot[off + 1];
    const plain = (cipher - keys[keyIdx]) & 0xFFFF;
    slot[off] = (plain >> 8) & 0xFF;
    slot[off + 1] = plain & 0xFF;
    if (++keyIdx === 4) {
      keyIdx = 0;
      advanceKeys(keys);
    }
  }
}

// PKHeX reads each sub-offset as { u16 BE low, u16 BE high } — the low half
// lives in the first two bytes, the high half in the next two. Effectively a
// little-endian u32 composed of two big-endian u16s.
function readSubOffset(slot: Uint8Array, i: number): number {
  const base = SUBOFF_OFFSET + i * 4;
  const low  = (slot[base]     << 8) | slot[base + 1];
  const high = (slot[base + 2] << 8) | slot[base + 3];
  return (high * 0x10000 + low) >>> 0;
}

function readSubLength(slot: Uint8Array, i: number): number {
  const base = SUBLEN_OFFSET + i * 2;
  return (slot[base] << 8) | slot[base + 1];
}

// Gen 3 origin bits in GBA save use 1=S, 2=R, 3=E, 4=FR, 5=LG; GameCube games
// use their own GCVersion enum (0=None, 1=FR, 2=LG, 8=S, 9=R, 10=E, 11=CXD).
// Remap to the GBA-flavored numbers the rest of the app already understands,
// with 15 reserved for Colosseum/XD-native (matches data.ts ORIGIN_GAME_LABEL).
function gcVersionToAppOrigin(gc: number): number {
  switch (gc) {
    case 1: return 4;   // FR
    case 2: return 5;   // LG
    case 8: return 1;   // S
    case 9: return 2;   // R
    case 10: return 3;  // E
    case 11: return 15; // CXD
    default: return 0;
  }
}

// 196-byte XK3 struct. All multi-byte fields are big-endian. Like CK3, there's
// no substructure shuffling or per-mon checksum — every field sits at a fixed
// offset. Unlike CK3, the layout is much tighter: u8 IVs, u8 contest stats, no
// redundant 0x60 Level / OT-gender duplications.
function decodeXK3(bytes: Uint8Array): DecodedPokemon | null {
  if (bytes.length < XK3_SIZE) return null;
  const species = (bytes[0] << 8) | bytes[1];
  if (species === 0) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const metLocation = view.getUint16(0x08, false);
  const metLevel = view.getUint8(0x0E);
  const otGender: "male" | "female" = view.getUint8(0x10) === 0 ? "male" : "female";
  const level = view.getUint8(0x11);

  const flags = view.getUint8(0x1D);
  const isEgg = (flags & (1 << 7)) !== 0;
  const abilityBit: 0 | 1 = (flags & (1 << 6)) !== 0 ? 1 : 0;

  const experience = view.getUint32(0x20, false);
  const sid = view.getUint16(0x24, false);
  const tid = view.getUint16(0x26, false);
  const otId = ((sid << 16) | tid) >>> 0;
  const pid = view.getUint32(0x28, false);
  const originGame = gcVersionToAppOrigin(view.getUint8(0x34));

  const otName = decodeGCString(bytes.subarray(0x38, 0x38 + 22), 10);
  // 0x4E is the "display" nickname PKHeX sets to the original language glyphs;
  // the player-edited nickname lives at 0x64 and is what gets shown in-game.
  const nickname = decodeGCString(bytes.subarray(0x64, 0x64 + 22), 10);

  // Moves: u16 BE id at +0, u8 pp at +2, u8 pp-ups at +3; 4-byte stride × 4.
  const moves = [
    { id: view.getUint16(0x80, false), pp: view.getUint8(0x82) },
    { id: view.getUint16(0x84, false), pp: view.getUint8(0x86) },
    { id: view.getUint16(0x88, false), pp: view.getUint8(0x8A) },
    { id: view.getUint16(0x8C, false), pp: view.getUint8(0x8E) },
  ].filter((m) => m.id !== 0);

  // EVs are stored as u16 BE but clamped to a byte (PKHeX Math.Min with 0xFF).
  const evs = {
    hp:  Math.min(0xFF, view.getUint16(0x9C, false)),
    atk: Math.min(0xFF, view.getUint16(0x9E, false)),
    def: Math.min(0xFF, view.getUint16(0xA0, false)),
    spa: Math.min(0xFF, view.getUint16(0xA2, false)),
    spd: Math.min(0xFF, view.getUint16(0xA4, false)),
    spe: Math.min(0xFF, view.getUint16(0xA6, false)),
  };
  // IVs are u8 each, low 5 bits meaningful.
  const ivs = {
    hp:  view.getUint8(0xA8) & 0x1F,
    atk: view.getUint8(0xA9) & 0x1F,
    def: view.getUint8(0xAA) & 0x1F,
    spa: view.getUint8(0xAB) & 0x1F,
    spd: view.getUint8(0xAC) & 0x1F,
    spe: view.getUint8(0xAD) & 0x1F,
  };
  // Contest stats are u8 each; sheen sits at 0x12 (next to level), not beside
  // the other five like CK3 packs them.
  const contest = {
    cool:   view.getUint8(0xAE),
    beauty: view.getUint8(0xAF),
    cute:   view.getUint8(0xB0),
    smart:  view.getUint8(0xB1),
    tough:  view.getUint8(0xB2),
    sheen:  view.getUint8(0x12),
  };

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

export function parseXDSave(buf: Uint8Array, game: GameStem = "xd"): SaveInfo | null {
  // Accept raw 0x56000 payloads or 0x56040 GCI-wrapped files.
  let data: Uint8Array;
  if (buf.length === SAVE_SIZE + GCI_HEADER_SIZE) data = buf.subarray(GCI_HEADER_SIZE);
  else if (buf.length === SAVE_SIZE) data = buf;
  else return null;

  // Pick the slot with the largest u32 BE counter at slot+0x04.
  let bestSlot = -1;
  let bestCounter = -1;
  for (let s = 0; s < SLOT_COUNT; s++) {
    const base = SLOT_START + s * SLOT_SIZE;
    const counter = (
      (data[base + 4] << 24) |
      (data[base + 5] << 16) |
      (data[base + 6] << 8) |
      data[base + 7]
    ) >>> 0;
    if (counter > bestCounter) {
      bestCounter = counter;
      bestSlot = s;
    }
  }
  if (bestSlot < 0) return null;

  const slot = new Uint8Array(SLOT_SIZE);
  slot.set(
    data.subarray(SLOT_START + bestSlot * SLOT_SIZE, SLOT_START + (bestSlot + 1) * SLOT_SIZE),
  );
  decryptSlot(slot);

  const configBase = readSubOffset(slot, 0) + SUBOFF_BASE;
  const trainerBase = readSubOffset(slot, 1) + SUBOFF_BASE;
  const boxBase = readSubOffset(slot, 2) + SUBOFF_BASE;
  const partyBase = trainerBase + PARTY_SUBOFFSET;

  // JP saves use a shorter shadow-info table; this flag also picks f32 vs f64
  // for playtime. Matches PKHeX's subLength[7] == 0x1E00 check.
  const japanese = readSubLength(slot, 7) === 0x1E00;

  const view = new DataView(slot.buffer, slot.byteOffset, slot.byteLength);

  const playerName = decodeGCString(
    slot.subarray(trainerBase + 0x00, trainerBase + 0x00 + TRAINER_NAME_CHARS * 2),
    TRAINER_NAME_CHARS,
  );

  const rawSeconds = japanese
    ? view.getFloat32(configBase + 0x20, false)
    : view.getFloat64(configBase + 0x30, false);
  const totalSeconds = Number.isFinite(rawSeconds) ? Math.max(0, Math.floor(rawSeconds)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // XD reverses TID/SID compared to GBA: SID sits at the lower offset, TID at
  // the higher one; the combined 32-bit trainer ID uses SID << 16 | TID.
  const sid = view.getUint16(trainerBase + 0x2C, false);
  const tid = view.getUint16(trainerBase + 0x2E, false);
  const trainerId = ((sid << 16) | tid) >>> 0;

  const playerGender: "male" | "female" =
    view.getUint8(trainerBase + 0x8E0) === 0 ? "male" : "female";

  const party: (DecodedPokemon | null)[] = Array(PARTY_SLOTS).fill(null);
  for (let i = 0; i < PARTY_SLOTS; i++) {
    const off = partyBase + i * XK3_SIZE;
    party[i] = decodeXK3(slot.subarray(off, off + XK3_SIZE));
  }

  const boxes: BoxInfo[] = [];
  for (let b = 0; b < BOX_COUNT; b++) {
    const base = boxBase + b * BOX_STRIDE;
    const name =
      decodeGCString(slot.subarray(base, base + BOX_NAME_BYTES), BOX_NAME_CHARS) ||
      `Box ${b + 1}`;
    const slots: (DecodedPokemon | null)[] = Array(SLOTS_PER_BOX).fill(null);
    for (let i = 0; i < SLOTS_PER_BOX; i++) {
      const monOff = base + BOX_HEADER_SIZE + i * XK3_SIZE;
      slots[i] = decodeXK3(slot.subarray(monOff, monOff + XK3_SIZE));
    }
    boxes.push({ name, slots });
  }

  // XD, like Colosseum, doesn't surface Hoenn trainer-card flavor (HoF, Secret
  // Bases, Feebas/Mirage/Lottery RNG, local time, bag pockets). Empty defaults.
  return {
    game,
    playerName,
    playerGender,
    trainerId,
    playTime: { hours, minutes, seconds, frames: 0 },
    savedAtMs: Date.now(),
    party,
    boxes,
    currentBox: 0,
    pokedexOwned: [],
    enteredHof: false,
    battleTowerBestStreak: 0,
    hallOfFame: [],
    secretBases: [],
    feebasSeed: null,
    mirageRnd: null,
    lotteryRnd: null,
    localTimeOffset: null,
    bag: { pc: [], items: [], balls: [], tms: [], berries: [], key: [] },
  };
}
