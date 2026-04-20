// Parse a Gen 3 Ruby .sav file and extract SaveBlock2 fields (player name, play time)
// plus the player's party from SaveBlock1.
// Reference: pokeruby/src/save.c — 32 flash sectors of 4096 bytes; each sector has a
// 3968-byte data area + footer {u16 id, u16 checksum, u32 signature=0x08012025, u32 counter}.
// Sectors 0-13 = save slot A, 14-27 = save slot B; the slot with the highest counter is active.
// Section id 0 holds gSaveBlock2; section id 1 holds the first 4084 bytes of gSaveBlock1,
// which includes playerPartyCount (u8 @ 0x234) and playerParty[6] (struct Pokemon @ 0x238).

import { decodePokemon } from "./gen3.ts";
import type { BoxInfo, DecodedPokemon, SaveInfo } from "../protocol.ts";
export type { SaveInfo };

const SECTOR_SIZE = 0x1000;
const SECTOR_DATA_SIZE = 0xFF4;
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

export function parseRubySave(buf: Uint8Array): SaveInfo | null {
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
  let sb1Chunk0Base: number | null = null;
  for (let i = 0; i < NUM_SECTORS_PER_SLOT; i++) {
    const s = readSector(activeSlot * NUM_SECTORS_PER_SLOT + i);
    if (!s) continue;
    if (s.id === 0) sb2Base = s.base;
    else if (s.id === 1) sb1Chunk0Base = s.base;
  }
  if (sb2Base === null) return null;

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
  if (sb1Chunk0Base !== null) {
    const partyCount = Math.min(6, view.getUint8(sb1Chunk0Base + 0x234));
    const PARTY_ENTRY_SIZE = 100;
    for (let i = 0; i < partyCount; i++) {
      const offset = sb1Chunk0Base + 0x238 + i * PARTY_ENTRY_SIZE;
      party[i] = decodePokemon(buf.subarray(offset, offset + PARTY_ENTRY_SIZE));
    }
  }

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
    playerName,
    playerGender,
    trainerId: trainerId >>> 0,
    playTime: { hours, minutes, seconds, frames },
    savedAtMs: Date.now(),
    party,
    boxes,
    currentBox,
  };
}
