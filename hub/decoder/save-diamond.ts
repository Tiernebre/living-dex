// Parse a Pokémon Diamond .sav file (NDS, 512 KB, two 0x40000 slots).
// D/P share the same SaveBlock layout; Platinum shifts most offsets and is
// NOT covered here.
//
// File layout — each slot (0x00000 and 0x40000) contains two independently
// written blocks concatenated:
//   +0x00000  general block  (0xC100 bytes)   — trainer card, party, pokédex
//   +0x0C100  storage block  (0x121E0 bytes)  — 18 PC boxes + box names
// Remaining bytes to 0x40000 hold Hall of Fame, mystery gift, etc.
//
// 16-byte block footer at the end of each block:
//   -0x10  u32 save counter        (per-block; both blocks usually match)
//   -0x0C  u32 block size          (0xC100 or 0x121E0)
//   -0x08  u32 magic 0x20060623    (signature that the block was ever saved)
//   -0x04  u16 block id            (0 = general, 1 = storage)
//   -0x02  u16 crc16-ccitt         (not validated here — we trust the magic)
//
// Active slot = slot whose general-block save counter is higher; we tie-break
// toward slot 0 so a single-save file still parses. An unwritten slot is
// entirely 0xFF so its magic check fails and we fall through to the other.
//
// References: PKHeX SAV4.cs + SAV4DP.cs + PK4.cs; pret/pokediamond header
// layouts in include/save.h, include/pokedex.h, include/pc_storage.h.

import { decodePokemon4, decodeGen4Name } from "./gen4.ts";
import type { Bag, BoxInfo, DecodedPokemon, GameStem, SaveInfo } from "../protocol.ts";

const SLOT_SIZE = 0x40000;
const GENERAL_SIZE = 0xC100;
const STORAGE_SIZE = 0x121E0;
const DP_MAGIC = 0x20060623;

// Per-block offsets within the general (small) block. Matches pokediamond
// PlayerData / Pokedex layouts and PKHeX SAV4DP.cs.
const OFS_TRAINER_NAME = 0x64;   // 16 bytes, 8 UCS-2 chars + 0xFFFF terminator
const OFS_TID = 0x74;            // u16
const OFS_SID = 0x76;            // u16
const OFS_GENDER = 0x7C;         // u8 (0=male, 1=female)
const OFS_PLAYTIME_HOURS = 0x86; // u16
const OFS_PLAYTIME_MINS = 0x88;  // u8
const OFS_PLAYTIME_SECS = 0x89;  // u8
const OFS_PARTY_COUNT = 0x94;    // u32
const OFS_PARTY = 0x98;          // 6 × 236-byte PartyPokemon
const OFS_POKEDEX = 0x12DC;      // u32 magic (0xBEEFCAFE) + flag bitfields
const POKEDEX_MAGIC = 0xBEEFCAFE;
const POKEDEX_SPECIES_COUNT = 493;
const POKEDEX_BYTES = Math.ceil(POKEDEX_SPECIES_COUNT / 8);

// Party / Box Pokémon sizes.
const PARTY_MON_SIZE = 236;
const BOX_MON_SIZE = 136;

// Storage block layout: u32 current box, 18×30 BoxPokemon, 18 × 40-byte box
// names, then wallpaper bytes + unlock flag in the remaining padding.
const BOXES_COUNT = 18;
const SLOTS_PER_BOX = 30;
const STORAGE_BOX_BASE = 0x0004;
const STORAGE_NAMES_BASE = STORAGE_BOX_BASE + BOXES_COUNT * SLOTS_PER_BOX * BOX_MON_SIZE; // 0x11EA4
const BOX_NAME_SIZE = 40;

type Block = { base: number; counter: number };

function readBlockFooter(buf: Uint8Array, base: number, expectedSize: number, expectedId: number): Block | null {
  const view = new DataView(buf.buffer, buf.byteOffset + base, expectedSize);
  const counter = view.getUint32(expectedSize - 0x10, true);
  const size = view.getUint32(expectedSize - 0x0C, true);
  const magic = view.getUint32(expectedSize - 0x08, true);
  const id = view.getUint16(expectedSize - 0x04, true);
  if (magic !== DP_MAGIC || size !== expectedSize || id !== expectedId) return null;
  return { base, counter };
}

export function parseDiamondSave(buf: Uint8Array, game: GameStem = "diamond"): SaveInfo | null {
  if (buf.length < 2 * SLOT_SIZE) return null;

  // Within each slot, the general block lives at slot+0 and the storage block
  // at slot+GENERAL_SIZE. Each block's own footer picks its own winner — they
  // are written independently, so in principle one slot can hold the newer
  // general and the other the newer storage.
  const pickBlock = (offsetInSlot: number, expectedSize: number, expectedId: number): Block | null => {
    const a = readBlockFooter(buf, offsetInSlot, expectedSize, expectedId);
    const b = readBlockFooter(buf, SLOT_SIZE + offsetInSlot, expectedSize, expectedId);
    if (a && b) return b.counter > a.counter ? b : a;
    return a ?? b;
  };
  const general = pickBlock(0, GENERAL_SIZE, 0);
  const storage = pickBlock(GENERAL_SIZE, STORAGE_SIZE, 1);

  if (!general) return null;
  const g = buf.subarray(general.base, general.base + GENERAL_SIZE);
  const gView = new DataView(g.buffer, g.byteOffset, g.byteLength);

  const playerName = decodeGen4Name(g.subarray(OFS_TRAINER_NAME, OFS_TRAINER_NAME + 16));
  const playerGender: "male" | "female" = gView.getUint8(OFS_GENDER) === 0 ? "male" : "female";
  const tid = gView.getUint16(OFS_TID, true);
  const sid = gView.getUint16(OFS_SID, true);
  const trainerId = ((sid << 16) | tid) >>> 0;
  const playTime = {
    hours: gView.getUint16(OFS_PLAYTIME_HOURS, true),
    minutes: gView.getUint8(OFS_PLAYTIME_MINS),
    seconds: gView.getUint8(OFS_PLAYTIME_SECS),
    frames: 0,
  };

  const partyCount = Math.min(6, gView.getUint32(OFS_PARTY_COUNT, true));
  const party: (DecodedPokemon | null)[] = Array(6).fill(null);
  for (let i = 0; i < partyCount; i++) {
    const off = OFS_PARTY + i * PARTY_MON_SIZE;
    party[i] = decodePokemon4(g.subarray(off, off + PARTY_MON_SIZE));
  }

  // Pokédex caught flags. Magic present = pokédex unlocked; otherwise leave
  // empty so the UI doesn't render a fake "caught nothing" row.
  const pokedexOwned: number[] = [];
  if (gView.getUint32(OFS_POKEDEX, true) === POKEDEX_MAGIC) {
    const caughtBase = OFS_POKEDEX + 4;
    for (let i = 0; i < POKEDEX_BYTES; i++) {
      const b = gView.getUint8(caughtBase + i);
      if (b === 0) continue;
      for (let bit = 0; bit < 8; bit++) {
        if (b & (1 << bit)) {
          const species = i * 8 + bit + 1;
          if (species <= POKEDEX_SPECIES_COUNT) pokedexOwned.push(species);
        }
      }
    }
  }

  let boxes: BoxInfo[] = [];
  let currentBox = 0;
  if (storage) {
    const s = buf.subarray(storage.base, storage.base + STORAGE_SIZE);
    const sView = new DataView(s.buffer, s.byteOffset, s.byteLength);
    currentBox = sView.getUint32(0, true) & 0xFF;
    boxes = Array.from({ length: BOXES_COUNT }, (_, b) => {
      const nameOff = STORAGE_NAMES_BASE + b * BOX_NAME_SIZE;
      const name = decodeGen4Name(s.subarray(nameOff, nameOff + BOX_NAME_SIZE)) || `Box ${b + 1}`;
      const slots: (DecodedPokemon | null)[] = Array(SLOTS_PER_BOX).fill(null);
      for (let i = 0; i < SLOTS_PER_BOX; i++) {
        const off = STORAGE_BOX_BASE + (b * SLOTS_PER_BOX + i) * BOX_MON_SIZE;
        slots[i] = decodePokemon4(s.subarray(off, off + BOX_MON_SIZE));
      }
      return { name, slots };
    });
  }

  // Fields from SaveInfo that are Gen 3-only or not yet decoded for DP —
  // return empty/null rather than fake data so the UI shows them as absent.
  const emptyBag: Bag = { pc: [], items: [], balls: [], tms: [], berries: [], key: [] };

  return {
    game,
    playerName,
    playerGender,
    trainerId,
    playTime,
    savedAtMs: Date.now(),
    party,
    boxes,
    currentBox,
    pokedexOwned,
    enteredHof: false,
    battleTowerBestStreak: 0,
    hallOfFame: [],
    secretBases: [],
    feebasSeed: null,
    mirageRnd: null,
    lotteryRnd: null,
    localTimeOffset: null,
    bag: emptyBag,
  };
}
