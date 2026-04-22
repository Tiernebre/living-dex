// Parse a Pokémon Colosseum save (GameCube .gci memory card file).
// Unrelated to the GBA Gen 3 .sav layout — different slot structure, different
// encryption, different Pokémon struct (CK3, 312 bytes, all big-endian).
// Reference: PKHeX SAV3Colosseum.cs + CK3.cs + StringConverter3GC.cs.
//
// File layout (after an optional 0x40 GCI header):
//   0x00000..0x06000   memory-card banner/icon/comment region (ignored)
//   0x06000..0x24000   save slot 0
//   0x24000..0x42000   save slot 1
//   0x42000..0x60000   save slot 2   (each slot = 0x1E000 bytes)
//
// Per slot, all u32/u16/f32 are BIG-endian:
//   [0x00000, 0x00018)  plain header — u32 magic, u32 saveCounter @ 0x04,
//                       u32 unk, u32 headerChecksum, u32 unk, u32 unk
//   [0x00018, 0x1DFD8)  encrypted body (SHA-1 keystream, 6142 × 20-byte blocks)
//   [0x1DFD8, 0x1DFEC)  plain "unknown" 20-byte region
//   [0x1DFEC, 0x1E000)  plain body SHA-1 digest — also the decryption key
//
// Cipher: starting digest = ~body_sha1. For each 20-byte ciphertext block in
// [0x18, 0x1DFD8): decrypt by XORing with the current digest, then set the
// next digest = SHA1(ciphertext_of_that_block). (Encryption is symmetric but
// hashes the resulting ciphertext after XOR'ing the plaintext.)
//
// Active slot = the one with the highest u32 BE saveCounter at slot+0x04.
//
// Inside the decrypted slot (offsets are slot-relative):
//   0x028  f32 BE  play time in seconds
//   0x078  20 B    player OT name (UTF-16BE, u16=0000 terminator)
//   0x0A4  u16 BE  SID    |  trainerId = (SID << 16) | TID
//   0x0A6  u16 BE  TID    |  (order is reversed from GBA)
//   0x0A8  6 × 312 B  party (no explicit count — scan for species != 0)
//   0x0B90 3 × 0x24A4 B  PC — each box has a 16-byte UTF-16BE name in its
//                        first 0x14 bytes, then 30 × 312 B mons
//   0x0AF8 u8       player gender (0=male, 1=female)
//
// CK3 (312 bytes, per-mon) is stored plain — no GBA-style substructure
// shuffling or checksum. Full field map in decodeCK3 below.

import { createHash } from "node:crypto";
import type { BoxInfo, DecodedPokemon, GameStem, SaveInfo } from "../protocol.ts";

const GCI_HEADER_SIZE = 0x40;
const SAVE_SIZE = 0x60000;
const SLOT_START = 0x6000;
const SLOT_SIZE = 0x1E000;
const SLOT_COUNT = 3;

const ENCRYPT_BEGIN = 0x18;
const ENCRYPT_END = 0x1DFD8;
const BODY_SHA1_OFFSET = 0x1DFEC;
const SHA1_SIZE = 20;

const TRAINER_NAME_OFFSET = 0x78;
const TRAINER_NAME_CHARS = 10;
const PLAYTIME_OFFSET = 0x28;
const SID_OFFSET = 0xA4;
const TID_OFFSET = 0xA6;
const PARTY_OFFSET = 0xA8;
const PARTY_SLOTS = 6;
const GENDER_OFFSET = 0xAF8;
const BOXES_OFFSET = 0xB90;

const CK3_SIZE = 312;
const BOXES_COUNT = 3;
const SLOTS_PER_BOX = 30;
const BOX_STRIDE = SLOTS_PER_BOX * CK3_SIZE + 0x14; // 0x24A4
const BOX_NAME_CHARS = 8;
const BOX_MONS_OFFSET = 0x14;

const NATURES = [
  "Hardy", "Lonely", "Brave", "Adamant", "Naughty",
  "Bold", "Docile", "Relaxed", "Impish", "Lax",
  "Timid", "Hasty", "Serious", "Jolly", "Naive",
  "Modest", "Mild", "Quiet", "Bashful", "Rash",
  "Calm", "Gentle", "Sassy", "Careful", "Quirky",
];

// Colosseum text is UCS-2 big-endian: each glyph is a u16 code unit that, for
// ASCII-range printables, is the Unicode code point. Two Nintendo private-use
// glyphs get mapped to the Unicode symbols the rest of the app uses.
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

// In-place SHA-1 keystream decryption. digest_0 = ~body_sha1; each 20-byte
// block is XOR'd with the current digest, and digest_{n+1} = SHA1(cipher_n).
function decryptSlot(slot: Uint8Array): void {
  let digest = new Uint8Array(SHA1_SIZE);
  for (let i = 0; i < SHA1_SIZE; i++) {
    digest[i] = ~slot[BODY_SHA1_OFFSET + i] & 0xFF;
  }
  for (let i = ENCRYPT_BEGIN; i < ENCRYPT_END; i += SHA1_SIZE) {
    const block = slot.subarray(i, i + SHA1_SIZE);
    const nextDigest = new Uint8Array(
      createHash("sha1").update(block).digest().buffer as ArrayBuffer,
    );
    for (let j = 0; j < SHA1_SIZE; j++) slot[i + j] ^= digest[j];
    digest = nextDigest;
  }
}

// 312-byte CK3 struct. All multi-byte fields are big-endian. Unlike GBA PK3
// there's no PID^OTID substructure XOR, no checksum, no 24-permutation order —
// every field sits at a fixed offset.
function decodeCK3(bytes: Uint8Array): DecodedPokemon | null {
  if (bytes.length < CK3_SIZE) return null;
  const species = (bytes[0] << 8) | bytes[1];
  if (species === 0) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const pid = view.getUint32(0x04, false);
  const originGame = view.getUint8(0x08);
  const metLocation = view.getUint16(0x0C, false);
  const metLevel = view.getUint8(0x0E);
  const otGender: "male" | "female" = view.getUint8(0x10) === 0 ? "male" : "female";
  const sid = view.getUint16(0x14, false);
  const tid = view.getUint16(0x16, false);
  const otId = ((sid << 16) | tid) >>> 0;

  const otName = decodeGCString(bytes.subarray(0x18, 0x18 + 22), 10);
  const nickname = decodeGCString(bytes.subarray(0x2E, 0x2E + 22), 10);

  const experience = view.getUint32(0x5C, false);
  const level = view.getUint8(0x60);

  // Moves: u16 BE id, u8 pp, u8 pp-ups — 6 bytes × 4 at 0x78.
  const moves = [
    { id: view.getUint16(0x78, false), pp: view.getUint8(0x7A) },
    { id: view.getUint16(0x7C, false), pp: view.getUint8(0x7E) },
    { id: view.getUint16(0x80, false), pp: view.getUint8(0x82) },
    { id: view.getUint16(0x84, false), pp: view.getUint8(0x86) },
  ].filter((m) => m.id !== 0);

  // EVs and IVs are stored as u16 BE but only the low byte (EV, max 255) or
  // low 5 bits (IV, max 31) are meaningful — the rest is pad.
  const evs = {
    hp:  view.getUint16(0x98, false) & 0xFF,
    atk: view.getUint16(0x9A, false) & 0xFF,
    def: view.getUint16(0x9C, false) & 0xFF,
    spa: view.getUint16(0x9E, false) & 0xFF,
    spd: view.getUint16(0xA0, false) & 0xFF,
    spe: view.getUint16(0xA2, false) & 0xFF,
  };
  const ivs = {
    hp:  view.getUint16(0xA4, false) & 0x1F,
    atk: view.getUint16(0xA6, false) & 0x1F,
    def: view.getUint16(0xA8, false) & 0x1F,
    spa: view.getUint16(0xAA, false) & 0x1F,
    spd: view.getUint16(0xAC, false) & 0x1F,
    spe: view.getUint16(0xAE, false) & 0x1F,
  };

  // Contest stats are u8 each; sheen is separated by 9 bytes of ribbon counts.
  const contest = {
    cool:   view.getUint8(0xB2),
    beauty: view.getUint8(0xB3),
    cute:   view.getUint8(0xB4),
    smart:  view.getUint8(0xB5),
    tough:  view.getUint8(0xB6),
    sheen:  view.getUint8(0xBC),
  };

  const isEgg = view.getUint8(0xCB) === 1;
  const abilityBit: 0 | 1 = view.getUint8(0xCC) === 0 ? 0 : 1;

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

export function parseColosseumSave(
  buf: Uint8Array,
  game: GameStem = "colosseum",
): SaveInfo | null {
  // Accept raw 0x60000 payloads or 0x60040 GCI-wrapped files.
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

  const view = new DataView(slot.buffer, slot.byteOffset, slot.byteLength);

  const playerName = decodeGCString(
    slot.subarray(TRAINER_NAME_OFFSET, TRAINER_NAME_OFFSET + TRAINER_NAME_CHARS * 2),
    TRAINER_NAME_CHARS,
  );
  // Playtime is an f32 BE count of seconds; guard against NaN from corrupt slots.
  const rawSeconds = view.getFloat32(PLAYTIME_OFFSET, false);
  const totalSeconds = Number.isFinite(rawSeconds) ? Math.max(0, Math.floor(rawSeconds)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const sid = view.getUint16(SID_OFFSET, false);
  const tid = view.getUint16(TID_OFFSET, false);
  const trainerId = ((sid << 16) | tid) >>> 0;
  const playerGender: "male" | "female" =
    view.getUint8(GENDER_OFFSET) === 0 ? "male" : "female";

  const party: (DecodedPokemon | null)[] = Array(PARTY_SLOTS).fill(null);
  for (let i = 0; i < PARTY_SLOTS; i++) {
    const off = PARTY_OFFSET + i * CK3_SIZE;
    party[i] = decodeCK3(slot.subarray(off, off + CK3_SIZE));
  }

  const boxes: BoxInfo[] = [];
  for (let b = 0; b < BOXES_COUNT; b++) {
    const base = BOXES_OFFSET + b * BOX_STRIDE;
    const name =
      decodeGCString(slot.subarray(base, base + BOX_NAME_CHARS * 2), BOX_NAME_CHARS) ||
      `Box ${b + 1}`;
    const slots: (DecodedPokemon | null)[] = Array(SLOTS_PER_BOX).fill(null);
    for (let i = 0; i < SLOTS_PER_BOX; i++) {
      const monOff = base + BOX_MONS_OFFSET + i * CK3_SIZE;
      slots[i] = decodeCK3(slot.subarray(monOff, monOff + CK3_SIZE));
    }
    boxes.push({ name, slots });
  }

  // Colosseum doesn't have any of the Hoenn-specific flavor the Gen 3 GBA
  // parsers surface (Hall of Fame, Secret Bases, Feebas/Mirage/Lottery RNG,
  // Feebas seed, local-time offset, bag pockets). Return null/empty for those.
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
