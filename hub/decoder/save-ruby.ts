// Parse a Gen 3 Ruby .sav file and extract SaveBlock2 fields (player name, play time)
// plus the player's party from SaveBlock1.
// Reference: pokeruby/src/save.c — 32 flash sectors of 4096 bytes; each sector has a
// 3968-byte data area + footer {u16 id, u16 checksum, u32 signature=0x08012025, u32 counter}.
// Sectors 0-13 = save slot A, 14-27 = save slot B; the slot with the highest counter is active.
// Section id 0 holds gSaveBlock2; section id 1 holds the first 4084 bytes of gSaveBlock1,
// which includes playerPartyCount (u8 @ 0x234) and playerParty[6] (struct Pokemon @ 0x238).

import { decodePokemon } from "./gen3.ts";
import { parseHallOfFame } from "./hall-of-fame.ts";
import type {
  BoxInfo,
  DecodedPokemon,
  GameStem,
  SaveInfo,
  SecretBase,
  SecretBaseTeamMember,
} from "../protocol.ts";
export type { SaveInfo };

const SECTOR_SIZE = 0x1000;
// Each sector is 4096 bytes = 3968 bytes of struct data + 128-byte footer.
// (The footer fields {id, checksum, signature, counter} live at 0xFF4..0xFFF;
// bytes 0xF80..0xFF3 are unused padding, NOT part of the saved struct.)
// pokeruby/src/save.c: #define SECTOR_DATA_SIZE 3968
const SECTOR_DATA_SIZE = 0xF80;
const NUM_SECTORS_PER_SLOT = 14;
const FILE_SIGNATURE = 0x08012025;

// Gen 3 character map → ASCII (only the subset we need for names).
const CHARMAP: Record<number, string> = (() => {
  const m: Record<number, string> = { 0x00: " " };
  for (let i = 0; i < 10; i++) m[0xA1 + i] = String.fromCharCode(48 + i); // '0'..'9'
  for (let i = 0; i < 26; i++) m[0xBB + i] = String.fromCharCode(65 + i); // 'A'..'Z'
  for (let i = 0; i < 26; i++) m[0xD5 + i] = String.fromCharCode(97 + i); // 'a'..'z'
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

// Ruby and Sapphire share the Gen 3 RS save format (same sector layout, same offsets).
// FireRed/LeafGreen and Emerald have different offsets and aren't handled here yet.
export function parseRubySave(buf: Uint8Array, game: GameStem = "ruby"): SaveInfo | null {
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
  // gSaveBlock1 spans section IDs 1..4 (4 chunks). Concatenate them so we can
  // read fields past chunk 0, like gameStats at struct offset 0x1540.
  const sb1Chunks: (Uint8Array | null)[] = [null, null, null, null];
  for (let i = 0; i < NUM_SECTORS_PER_SLOT; i++) {
    const s = readSector(activeSlot * NUM_SECTORS_PER_SLOT + i);
    if (!s) continue;
    if (s.id === 0) sb2Base = s.base;
    else if (s.id >= 1 && s.id <= 4) {
      sb1Chunks[s.id - 1] = buf.subarray(s.base, s.base + SECTOR_DATA_SIZE);
    }
  }
  if (sb2Base === null) return null;
  let sb1: Uint8Array | null = null;
  if (sb1Chunks.every((c) => c !== null)) {
    sb1 = new Uint8Array(4 * SECTOR_DATA_SIZE);
    for (let i = 0; i < 4; i++) sb1.set(sb1Chunks[i]!, i * SECTOR_DATA_SIZE);
  }
  const sb1View = sb1 ? new DataView(sb1.buffer, sb1.byteOffset, sb1.byteLength) : null;

  // gSaveBlock2.pokedex lives at offset 0x18; pokedex.owned is a 52-byte bitfield
  // at +0x10 (i.e. SB2+0x28), indexed by (nationalDex - 1).
  // pokeruby/include/global.h: struct Pokedex { ... u8 owned[DEX_FLAGS_NO]; ... }
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

  // gSaveBlock1.gameStats[NUM_GAME_STATS] @ struct offset 0x1540, 50 × u32 LE.
  // GAME_STAT_ENTERED_HOF = 10. Ruby/Sapphire don't XOR-encrypt this (Emerald does).
  // pokeruby/include/constants/game_stat.h
  const enteredHof = sb1View ? sb1View.getUint32(0x1540 + 10 * 4, true) > 0 : false;

  // gSaveBlock2.battleTower lives at SB2+0xA8; bestBattleTowerWinStreak is a
  // u16 at struct offset 0x4CA (RS layout). Emerald shifts this by 0xA8, so
  // this offset is RS-only.
  // pokeruby/include/global.h: struct BattleTowerData.
  const battleTowerBestStreak = view.getUint16(sb2Base + 0xA8 + 0x4CA, true);

  // gSaveBlock1.vars[256] @ struct offset 0x1340, indexed by (varId - 0x4000).
  // VAR_MIRAGE_RND_H=0x4024 (idx 0x24), VAR_MIRAGE_RND_L=0x4025 (idx 0x25).
  // Combined value = (H << 16) | L; the game tests (rnd >> 16) against each
  // party mon's (PID & 0xFFFF).
  // pokeruby/src/time_events.c, include/constants/vars.h.
  const mirageRnd = sb1View
    ? ((sb1View.getUint16(0x1340 + 0x24 * 2, true) << 16) |
      sb1View.getUint16(0x1340 + 0x25 * 2, true)) >>> 0
    : null;

  // VAR_LOTTERY_RND_L=0x404B (idx 0x4B), VAR_LOTTERY_RND_H=0x404C (idx 0x4C).
  // Only the low 16 bits are the effective "lottery number" — the game
  // truncates GetLotteryNumber() to u16 before matching against OT IDs.
  // Re-rolled once per in-game day from Random(), so not predictable from
  // save state alone — but the currently-stored value IS the number for
  // today's draw and can be cashed in right now.
  // pokeruby/src/lottery_corner.c, src/clock.c:UpdatePerDay.
  const lotteryRnd = sb1View
    ? ((sb1View.getUint16(0x1340 + 0x4C * 2, true) << 16) |
      sb1View.getUint16(0x1340 + 0x4B * 2, true)) >>> 0
    : null;

  // gSaveBlock2.localTimeOffset @ SB2+0x98 — struct Time { s16 days; s8 h; s8 m; s8 s; }.
  // Set once at InitTimeBasedEvents from the hardware RTC.
  const localTimeOffset = {
    days: view.getInt16(sb2Base + 0x98, true),
    hours: view.getInt8(sb2Base + 0x9A),
    minutes: view.getInt8(sb2Base + 0x9B),
    seconds: view.getInt8(sb2Base + 0x9C),
  };

  // gSaveBlock1.easyChatPairs[0].unk2 @ struct offset 0x2DD6 (after the u16
  // bitfield at 0x2DD4). Seeds the Feebas tile PRNG on Route 119.
  // pokeruby/include/global.h: struct EasyChatPair { u16 unk0:7:7:1; u16 unk2; ... }
  const feebasSeed = sb1View ? sb1View.getUint16(0x2DD6, true) : null;

  // gPokemonStorage spans section IDs 5..13 (9 chunks), each holding up to 3968
  // bytes of the struct. Concatenate them in order so we can read BoxPokemon
  // entries without worrying about chunk boundaries.
  const storageChunks: (Uint8Array | null)[] = Array(9).fill(null);
  for (let i = 0; i < NUM_SECTORS_PER_SLOT; i++) {
    const s = readSector(activeSlot * NUM_SECTORS_PER_SLOT + i);
    if (!s) continue;
    const chunkIdx = s.id - 5;
    if (chunkIdx >= 0 && chunkIdx < 9) {
      storageChunks[chunkIdx] = buf.subarray(s.base, s.base + SECTOR_DATA_SIZE);
    }
  }
  let boxes: BoxInfo[] = [];
  let currentBox = 0;
  if (storageChunks.every((c) => c !== null)) {
    const storage = new Uint8Array(9 * SECTOR_DATA_SIZE);
    for (let i = 0; i < 9; i++) storage.set(storageChunks[i]!, i * SECTOR_DATA_SIZE);
    currentBox = storage[0];
    const BOXES_COUNT = 14;
    const SLOTS_PER_BOX = 30;
    const BOX_MON_SIZE = 0x50; // 80-byte BoxPokemon
    const BOXES_BASE = 0x0004;
    const NAMES_BASE = 0x8344;
    const NAME_LEN = 9;
    boxes = Array.from({ length: BOXES_COUNT }, (_, b) => {
      const nameBytes = storage.subarray(
        NAMES_BASE + b * NAME_LEN,
        NAMES_BASE + (b + 1) * NAME_LEN,
      );
      const slots: (DecodedPokemon | null)[] = Array(SLOTS_PER_BOX).fill(null);
      for (let i = 0; i < SLOTS_PER_BOX; i++) {
        const off = BOXES_BASE + (b * SLOTS_PER_BOX + i) * BOX_MON_SIZE;
        slots[i] = decodePokemon(storage.subarray(off, off + BOX_MON_SIZE));
      }
      return { name: decodeGen3String(nameBytes) || `Box ${b + 1}`, slots };
    });
  }

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
  };
}

// SaveBlock1 @ 0x1A08: struct SecretBaseRecord secretBases[20] (160 bytes each).
// pokeruby/include/global.h (SecretBaseRecord + SecretBaseParty).
// Slot 0 = player's own base (empty if player hasn't picked one). Slots 1..19
// are mix-records from record mixing. secretBaseId == 0 means the slot is empty.
function parseSecretBases(sb1: Uint8Array): SecretBase[] {
  const BASE = 0x1A08;
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
    // GetSecretBaseOwnerType: (trainerId[0] % 5) + gender*5
    // (decomp reads playerName[7] which is the byte directly before trainerId
    // in the struct layout — same as trainerId[0] in RS due to alignment padding.)
    const ownerType = (trainerIdBytes[0] % 5) + (gender === "female" ? 5 : 0);
    const numTimesEntered = sb1[off + 0x10];
    const decorations: { id: number; pos: number }[] = [];
    for (let d = 0; d < 16; d++) {
      const id = sb1[off + 0x12 + d];
      if (id === 0) continue;
      decorations.push({ id, pos: sb1[off + 0x22 + d] });
    }
    // SecretBaseParty, offsets from record start:
    //   0x34 personality[6] u32 · 0x4C moves[24] u16 · 0x7C species[6] u16
    //   0x88 heldItems[6] u16   · 0x94 levels[6] u8  · 0x9A EVs[6] u8
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
