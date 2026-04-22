// Parse a Gen 3 Emerald .sav file. Shares the Gen 3 save-sector skeleton with
// R/S (14 sectors per slot, 0x08012025 signature, A/B slot rotation by counter,
// sector IDs 0 = SaveBlock2, 1..4 = SaveBlock1 chunks, 5..13 = PokemonStorage)
// but Emerald's SaveBlock layout and several fields are XOR-encrypted with a
// per-save 32-bit `encryptionKey` stored at SaveBlock2+0xAC.
//
// Differences from R/S that drove this separate parser:
//   - SaveBlock2 adds encryptionKey @ 0xAC; BattleFrontier replaces BattleTower
//     at 0x64C (so the R/S bestBattleTowerWinStreak field no longer exists —
//     use gameStats[GAME_STAT_BATTLE_TOWER_SINGLES_STREAK] instead).
//   - SaveBlock1 bag pockets are 30/30/16/64/46 (R/S: 20/20/...), shifted
//     accordingly, and bag quantities are XOR'd with encryptionKey (PC items
//     are NOT; money, coins, and gameStats are XOR'd).
//   - SaveBlock1 vars/gameStats/secretBases moved: 0x139C/0x159C/0x1A9C
//     (R/S: 0x1340/0x1540/0x1A08). NUM_GAME_STATS grew from 50 to 64.
//   - Feebas seed source moved from easyChatPairs[0].unk2 (R/S @ 0x2DD6) to
//     dewfordTrends[0].rand (Emerald @ 0x2E66).
//
// References: pokeemerald/include/global.h (SaveBlock1/SaveBlock2/SecretBase),
// pokeemerald/src/save.c (sector layout, checksum algorithm),
// pokeemerald/src/load_save.c (encryptionKey apply),
// pokeemerald/src/overworld.c (GetGameStat XOR),
// pokeemerald/src/item.c (bag quantity XOR).

import { decodePokemon } from "./gen3.ts";
import { parseHallOfFame } from "./hall-of-fame.ts";
import type {
  Bag,
  BoxInfo,
  DecodedPokemon,
  GameStem,
  ItemSlot,
  SaveInfo,
  SecretBase,
  SecretBaseTeamMember,
} from "../protocol.ts";

const SECTOR_SIZE = 0x1000;
const SECTOR_DATA_SIZE = 0xF80;
const NUM_SECTORS_PER_SLOT = 14;
const FILE_SIGNATURE = 0x08012025;

// pokeemerald/include/constants/game_stat.h
const GAME_STAT_ENTERED_HOF = 10;
const GAME_STAT_BATTLE_TOWER_SINGLES_STREAK = 32;

const CHARMAP: Record<number, string> = (() => {
  const m: Record<number, string> = { 0x00: " " };
  for (let i = 0; i < 10; i++) m[0xA1 + i] = String.fromCharCode(48 + i);
  for (let i = 0; i < 26; i++) m[0xBB + i] = String.fromCharCode(65 + i);
  for (let i = 0; i < 26; i++) m[0xD5 + i] = String.fromCharCode(97 + i);
  return m;
})();

function decodeGen3String(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    if (b === 0xFF) break;
    out += CHARMAP[b] ?? "?";
  }
  return out;
}

export function parseEmeraldSave(buf: Uint8Array, game: GameStem = "emerald"): SaveInfo | null {
  if (buf.length < 0x20000) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  const readSector = (sectorIdx: number) => {
    const base = sectorIdx * SECTOR_SIZE;
    const signature = view.getUint32(base + 0xFF8, true);
    if (signature !== FILE_SIGNATURE) return null;
    return {
      base,
      id: view.getUint16(base + 0xFF4, true),
      counter: view.getUint32(base + 0xFFC, true),
    };
  };

  const slotCounter = (slot: number) => {
    let max = -1;
    for (let i = 0; i < NUM_SECTORS_PER_SLOT; i++) {
      const s = readSector(slot * NUM_SECTORS_PER_SLOT + i);
      if (s && s.counter > max) max = s.counter;
    }
    return max;
  };

  const slotA = slotCounter(0);
  const slotB = slotCounter(1);
  if (slotA < 0 && slotB < 0) return null;
  const activeSlot = slotB > slotA ? 1 : 0;

  let sb2Base: number | null = null;
  const sb1Chunks: (Uint8Array | null)[] = [null, null, null, null];
  const storageChunks: (Uint8Array | null)[] = Array(9).fill(null);
  for (let i = 0; i < NUM_SECTORS_PER_SLOT; i++) {
    const s = readSector(activeSlot * NUM_SECTORS_PER_SLOT + i);
    if (!s) continue;
    if (s.id === 0) sb2Base = s.base;
    else if (s.id >= 1 && s.id <= 4) {
      sb1Chunks[s.id - 1] = buf.subarray(s.base, s.base + SECTOR_DATA_SIZE);
    } else if (s.id >= 5 && s.id <= 13) {
      storageChunks[s.id - 5] = buf.subarray(s.base, s.base + SECTOR_DATA_SIZE);
    }
  }
  if (sb2Base === null) return null;

  let sb1: Uint8Array | null = null;
  if (sb1Chunks.every((c) => c !== null)) {
    sb1 = new Uint8Array(4 * SECTOR_DATA_SIZE);
    for (let i = 0; i < 4; i++) sb1.set(sb1Chunks[i]!, i * SECTOR_DATA_SIZE);
  }
  const sb1View = sb1 ? new DataView(sb1.buffer, sb1.byteOffset, sb1.byteLength) : null;

  // Emerald's per-save XOR key, regenerated each new-game (load_save.c:129).
  // Applied as u32 XOR to money and gameStats, as u16 XOR (low half of the key)
  // to coins and bag quantities.
  const encryptionKey = view.getUint32(sb2Base + 0xAC, true);
  const encryptionKeyLo = encryptionKey & 0xFFFF;

  // struct Pokedex lives at SB2+0x18; owned[52] @ +0x10 → SB2+0x28. Same as R/S.
  const pokedexOwned: number[] = [];
  const DEX_FLAGS_BYTES = 52;
  for (let i = 0; i < DEX_FLAGS_BYTES; i++) {
    const b = view.getUint8(sb2Base + 0x28 + i);
    if (b === 0) continue;
    for (let bit = 0; bit < 8; bit++) {
      if (b & (1 << bit)) pokedexOwned.push(i * 8 + bit + 1);
    }
  }

  const nameBytes = buf.subarray(sb2Base + 0x00, sb2Base + 0x08);
  const playerName = decodeGen3String(nameBytes);
  const playerGender = view.getUint8(sb2Base + 0x08) === 0 ? "male" : "female";
  const trainerId =
    view.getUint8(sb2Base + 0x0A) |
    (view.getUint8(sb2Base + 0x0B) << 8) |
    (view.getUint8(sb2Base + 0x0C) << 16) |
    (view.getUint8(sb2Base + 0x0D) << 24);
  const hours = view.getUint16(sb2Base + 0x0E, true);
  const minutes = view.getUint8(sb2Base + 0x10);
  const seconds = view.getUint8(sb2Base + 0x11);
  const frames = view.getUint8(sb2Base + 0x12);

  const party: (DecodedPokemon | null)[] = Array(6).fill(null);
  if (sb1) {
    const partyCount = Math.min(6, sb1[0x234]);
    const PARTY_ENTRY_SIZE = 100;
    for (let i = 0; i < partyCount; i++) {
      const offset = 0x238 + i * PARTY_ENTRY_SIZE;
      party[i] = decodePokemon(sb1.subarray(offset, offset + PARTY_ENTRY_SIZE));
    }
  }

  // gSaveBlock1.gameStats[NUM_GAME_STATS=64] @ 0x159C. Each u32 is XOR'd with
  // encryptionKey. GAME_STAT_ENTERED_HOF (10) = have-beaten-E4 flag.
  // Emerald has no bestBattleTowerWinStreak struct field — the trainer-card
  // star for Battle Tower is subsumed by the Frontier Symbols star — so we use
  // GAME_STAT_BATTLE_TOWER_SINGLES_STREAK (32) as the closest equivalent.
  const readGameStat = (idx: number): number =>
    sb1View ? ((sb1View.getUint32(0x159C + idx * 4, true) ^ encryptionKey) >>> 0) : 0;
  const enteredHof = readGameStat(GAME_STAT_ENTERED_HOF) > 0;
  const battleTowerBestStreak = Math.min(0xFFFF, readGameStat(GAME_STAT_BATTLE_TOWER_SINGLES_STREAK));

  // gSaveBlock1.vars[256] @ 0x139C. VAR_MIRAGE_RND_H/L = 0x4024/0x4025 (same as
  // R/S); combined as (H << 16) | L.
  const mirageRnd = sb1View
    ? ((sb1View.getUint16(0x139C + 0x24 * 2, true) << 16) |
      sb1View.getUint16(0x139C + 0x25 * 2, true)) >>> 0
    : null;

  // VAR_POKELOT_RND1=0x404B (high bits), VAR_POKELOT_RND2=0x404C (low bits).
  // Note Emerald's naming is inverted vs. R/S's VAR_LOTTERY_RND_L/H — here
  // SetLotteryNumber writes (lotteryNum >> 16) to RND1, so to reconstruct the
  // 32-bit value we do (RND2 << 16) | RND1. The effective winning number is
  // the low 16 bits (game truncates before comparing OT IDs).
  const lotteryRnd = sb1View
    ? ((sb1View.getUint16(0x139C + 0x4C * 2, true) << 16) |
      sb1View.getUint16(0x139C + 0x4B * 2, true)) >>> 0
    : null;

  // gSaveBlock2.localTimeOffset @ SB2+0x98 — same as R/S.
  const localTimeOffset = {
    days: view.getInt16(sb2Base + 0x98, true),
    hours: view.getInt8(sb2Base + 0x9A),
    minutes: view.getInt8(sb2Base + 0x9B),
    seconds: view.getInt8(sb2Base + 0x9C),
  };

  // gSaveBlock1.dewfordTrends[0].rand @ 0x2E64 + 0x02 = 0x2E66. Seeds the
  // Feebas tile PRNG in Emerald (wild_encounter.c:140).
  const feebasSeed = sb1View ? sb1View.getUint16(0x2E66, true) : null;

  // PokemonStorage spans section IDs 5..13. Layout matches R/S: u8 currentBox
  // at 0x0000, then 3-byte alignment pad, BoxPokemon[14][30] at 0x0004, box
  // names at 0x8344 (14 × 9 chars).
  let boxes: BoxInfo[] = [];
  let currentBox = 0;
  if (storageChunks.every((c) => c !== null)) {
    const storage = new Uint8Array(9 * SECTOR_DATA_SIZE);
    for (let i = 0; i < 9; i++) storage.set(storageChunks[i]!, i * SECTOR_DATA_SIZE);
    currentBox = storage[0];
    const BOXES_COUNT = 14;
    const SLOTS_PER_BOX = 30;
    const BOX_MON_SIZE = 0x50;
    const BOXES_BASE = 0x0004;
    const NAMES_BASE = 0x8344;
    const NAME_LEN = 9;
    boxes = Array.from({ length: BOXES_COUNT }, (_, b) => {
      const boxNameBytes = storage.subarray(
        NAMES_BASE + b * NAME_LEN,
        NAMES_BASE + (b + 1) * NAME_LEN,
      );
      const slots: (DecodedPokemon | null)[] = Array(SLOTS_PER_BOX).fill(null);
      for (let i = 0; i < SLOTS_PER_BOX; i++) {
        const off = BOXES_BASE + (b * SLOTS_PER_BOX + i) * BOX_MON_SIZE;
        slots[i] = decodePokemon(storage.subarray(off, off + BOX_MON_SIZE));
      }
      return { name: decodeGen3String(boxNameBytes) || `Box ${b + 1}`, slots };
    });
  }

  const bag: Bag = sb1View ? parseBag(sb1View, encryptionKeyLo) : emptyBag();

  return {
    game,
    playerName,
    playerGender,
    trainerId: trainerId >>> 0,
    playTime: { hours, minutes, seconds, frames },
    savedAtMs: Date.now(),
    party,
    boxes,
    currentBox,
    pokedexOwned,
    enteredHof,
    battleTowerBestStreak,
    hallOfFame: parseHallOfFame(buf),
    secretBases: sb1 ? parseSecretBases(sb1) : [],
    feebasSeed,
    mirageRnd,
    lotteryRnd,
    localTimeOffset,
    bag,
  };
}

// Emerald bag + PC storage. Offsets from gSaveBlock1 (pokeemerald/include/global.h):
//   pcItems[50]              @ 0x498  — quantity NOT XOR'd (GetPCItemQuantity)
//   bagPocket_Items[30]      @ 0x560
//   bagPocket_KeyItems[30]   @ 0x5D8
//   bagPocket_PokeBalls[16]  @ 0x650
//   bagPocket_TMHM[64]       @ 0x690
//   bagPocket_Berries[46]    @ 0x790
// ItemSlot = { u16 itemId, u16 quantity }. Bag quantities are XOR'd with the
// low 16 bits of gSaveBlock2.encryptionKey (item.c:GetBagItemQuantity).
function parseBag(sb1View: DataView, keyLo: number): Bag {
  const readPocket = (offset: number, count: number, xor: boolean): ItemSlot[] => {
    const out: ItemSlot[] = [];
    for (let i = 0; i < count; i++) {
      const id = sb1View.getUint16(offset + i * 4, true);
      if (id === 0) continue;
      const rawQty = sb1View.getUint16(offset + i * 4 + 2, true);
      const quantity = xor ? (rawQty ^ keyLo) & 0xFFFF : rawQty;
      out.push({ id, quantity });
    }
    return out;
  };
  return {
    pc: readPocket(0x498, 50, false),
    items: readPocket(0x560, 30, true),
    key: readPocket(0x5D8, 30, true),
    balls: readPocket(0x650, 16, true),
    tms: readPocket(0x690, 64, true),
    berries: readPocket(0x790, 46, true),
  };
}

function emptyBag(): Bag {
  return { pc: [], items: [], balls: [], tms: [], berries: [], key: [] };
}

// SaveBlock1 @ 0x1A9C: struct SecretBase secretBases[20] (160 bytes each).
// Layout matches R/S's SecretBaseRecord for the fields we surface (flag byte
// still has gender at bit 4 and battledOwnerToday at bit 5; Emerald adds
// toRegister:4 and registryStatus:2 on either side, which we ignore).
// SecretBaseParty in Emerald has identical field offsets to R/S —
// personality[6] @ 0x34, moves[24] @ 0x4C, species[6] @ 0x7C,
// heldItems[6] @ 0x88, levels[6] @ 0x94, EVs[6] @ 0x9A.
function parseSecretBases(sb1: Uint8Array): SecretBase[] {
  const BASE = 0x1A9C;
  const RECORD_SIZE = 160;
  const COUNT = 20;
  const NAME_LEN = 7;
  const view = new DataView(sb1.buffer, sb1.byteOffset, sb1.byteLength);
  const out: SecretBase[] = [];
  for (let i = 0; i < COUNT; i++) {
    const off = BASE + i * RECORD_SIZE;
    const secretBaseId = sb1[off + 0x00];
    if (secretBaseId === 0) continue;
    const packed = sb1[off + 0x01];
    const gender = ((packed >> 4) & 0x1) === 0 ? "male" : "female";
    const battledOwnerToday = ((packed >> 5) & 0x1) === 1;
    const nameBytes = sb1.subarray(off + 0x02, off + 0x02 + NAME_LEN);
    const trainerName = decodeGen3String(nameBytes);
    const trainerIdBytes = sb1.subarray(off + 0x09, off + 0x09 + 4);
    const trainerId =
      trainerIdBytes[0] |
      (trainerIdBytes[1] << 8) |
      (trainerIdBytes[2] << 16) |
      (trainerIdBytes[3] << 24);
    const ownerType = (trainerIdBytes[0] % 5) + (gender === "female" ? 5 : 0);
    const numTimesEntered = sb1[off + 0x10];
    const decorations: { id: number; pos: number }[] = [];
    for (let d = 0; d < 16; d++) {
      const id = sb1[off + 0x12 + d];
      if (id === 0) continue;
      decorations.push({ id, pos: sb1[off + 0x22 + d] });
    }
    const team: SecretBaseTeamMember[] = [];
    for (let s = 0; s < 6; s++) {
      const species = view.getUint16(off + 0x7C + s * 2, true);
      if (species === 0) continue;
      const personality = view.getUint32(off + 0x34 + s * 4, true);
      const moves: number[] = [];
      for (let m = 0; m < 4; m++) {
        moves.push(view.getUint16(off + 0x4C + (s * 4 + m) * 2, true));
      }
      const heldItem = view.getUint16(off + 0x88 + s * 2, true);
      const level = sb1[off + 0x94 + s];
      const ev = sb1[off + 0x9A + s];
      team.push({ species, level, heldItem, moves, personality, ev });
    }
    out.push({
      isPlayer: i === 0,
      secretBaseId,
      trainerName,
      trainerGender: gender,
      trainerId: trainerId >>> 0,
      ownerType,
      battledOwnerToday,
      numTimesEntered,
      decorations,
      team,
    });
  }
  return out;
}
