// Parse a Gen 3 Ruby .sav file and extract SaveBlock2 fields (player name, play time).
// Reference: pokeruby/src/save.c — 32 flash sectors of 4096 bytes; each sector has a
// 3968-byte data area + footer {u16 id, u16 checksum, u32 signature=0x08012025, u32 counter}.
// Sectors 0-13 = save slot A, 14-27 = save slot B; the slot with the highest counter is active.
// Section id 0 holds gSaveBlock2.

export type SaveInfo = {
  playerName: string;
  playerGender: "male" | "female";
  trainerId: number;
  playTime: { hours: number; minutes: number; seconds: number; frames: number };
  savedAtMs: number;
};

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
  for (let i = 0; i < NUM_SECTORS_PER_SLOT; i++) {
    const s = readSector(activeSlot * NUM_SECTORS_PER_SLOT + i);
    if (s && s.id === 0) {
      sb2Base = s.base;
      break;
    }
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

  return {
    playerName,
    playerGender,
    trainerId: trainerId >>> 0,
    playTime: { hours, minutes, seconds, frames },
    savedAtMs: Date.now(),
  };
}
