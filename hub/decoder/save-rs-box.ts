// Parse a Pokémon Box: Ruby & Sapphire save (GameCube .gci memory card file).
// Reference: PKHeX SAV3RSBox.cs + BlockInfoRSBOX.cs.
//
// Format: optional 0x40-byte GCI header, then 0x76000 bytes of save data =
// one 0x2000 header region followed by 46 × 0x2000 blocks (two 23-block slots).
// Block footer (first 0x10 bytes, BIG-endian): {u32 checksum, u32 blockId,
// u32 saveCount, u32 unused}. Active slot = floor(argmax(saveCount) / 23).
// Blocks within that slot are shuffled by id, so sort ascending, then concat
// payload[+0xC..+0xC+0x1FF0] → 23 * 0x1FF0 = 0x2DAB0-byte BoxBuffer.
//
// BoxBuffer holds 25 physical "pages" of 60 mons (12 cols × 5 rows); PKHeX
// exposes them as 50 logical boxes of 30 by splitting each page at col 6.
// Stored mon = 80-byte PK3 + 4-byte depositor TID/SID (LE) = 84 bytes.

import { decodePokemon } from "./gen3.ts";
import type { BoxInfo, DecodedPokemon, GameStem, SaveInfo } from "../protocol.ts";

const GCI_HEADER = 0x40;
const RAW_SIZE = 0x76000;
const BLOCK_SIZE = 0x2000;
const BLOCKS_PER_SLOT = 23;
const TOTAL_BLOCKS = BLOCKS_PER_SLOT * 2;
const PAYLOAD_SIZE = 0x1FF0;
const BLOCK_DATA_OFFSET = 0x0C;

const MON_STRIDE = 84;
const BOX_POKEMON_SIZE = 0x50;
const BOX_COUNT = 50;
const SLOTS_PER_BOX = 30;
const BOXES_BASE = 8;
const NAMES_BASE = 0x1EC38;
const NAME_LEN = 9;
const CURRENT_BOX_OFFSET = 0x04;

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

function readU32BE(buf: Uint8Array, o: number): number {
  return (
    (buf[o] * 0x1000000) +
    ((buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3])
  ) >>> 0;
}

export function parseRSBoxSave(buf: Uint8Array, game: GameStem = "box"): SaveInfo | null {
  let data: Uint8Array;
  if (buf.length === RAW_SIZE) data = buf;
  else if (buf.length === RAW_SIZE + GCI_HEADER) data = buf.subarray(GCI_HEADER);
  else return null;

  // Read every block's (id, saveCount) to pick the active slot.
  type Block = { fileIndex: number; offset: number; id: number; saveCount: number };
  const blocks: Block[] = [];
  for (let i = 0; i < TOTAL_BLOCKS; i++) {
    const offset = BLOCK_SIZE + i * BLOCK_SIZE;
    const id = readU32BE(data, offset + 0x04);
    const saveCount = readU32BE(data, offset + 0x08);
    blocks.push({ fileIndex: i, offset, id, saveCount });
  }

  let maxCount = -1;
  let maxIdx = -1;
  for (const b of blocks) {
    if (b.saveCount > maxCount) {
      maxCount = b.saveCount;
      maxIdx = b.fileIndex;
    }
  }
  if (maxIdx < 0) return null;
  const activeSlot = Math.floor(maxIdx / BLOCKS_PER_SLOT);

  const slotBlocks = blocks
    .slice(activeSlot * BLOCKS_PER_SLOT, (activeSlot + 1) * BLOCKS_PER_SLOT)
    .filter((b) => b.id < BLOCKS_PER_SLOT)
    .sort((a, b) => a.id - b.id);
  if (slotBlocks.length !== BLOCKS_PER_SLOT) return null;

  const boxBuffer = new Uint8Array(BLOCKS_PER_SLOT * PAYLOAD_SIZE);
  for (let i = 0; i < BLOCKS_PER_SLOT; i++) {
    const b = slotBlocks[i];
    boxBuffer.set(
      data.subarray(b.offset + BLOCK_DATA_OFFSET, b.offset + BLOCK_DATA_OFFSET + PAYLOAD_SIZE),
      b.id * PAYLOAD_SIZE,
    );
  }

  // BoxBuffer[0x04] is the current PKHeX "page" = logical box / 2.
  const currentBox = Math.min(BOX_COUNT - 1, boxBuffer[CURRENT_BOX_OFFSET] * 2);

  const boxes: BoxInfo[] = [];
  for (let box = 0; box < BOX_COUNT; box++) {
    const physical = box >>> 1;
    const nameBytes = boxBuffer.subarray(
      NAMES_BASE + physical * NAME_LEN,
      NAMES_BASE + (physical + 1) * NAME_LEN,
    );
    const name = decodeGen3String(nameBytes) || `Box ${box + 1}`;
    const slots: (DecodedPokemon | null)[] = Array(SLOTS_PER_BOX).fill(null);
    for (let slot = 0; slot < SLOTS_PER_BOX; slot++) {
      const row = Math.floor(slot / 6);
      let col = slot % 6;
      if (box & 1) col += 6;
      const boxSlot = row * 12 + col;
      const off = BOXES_BASE + MON_STRIDE * (box & ~1) * SLOTS_PER_BOX + boxSlot * MON_STRIDE;
      slots[slot] = decodePokemon(boxBuffer.subarray(off, off + BOX_POKEMON_SIZE));
    }
    boxes.push({ name, slots });
  }

  return {
    game,
    playerName: "",
    playerGender: "male",
    trainerId: 0,
    playTime: { hours: 0, minutes: 0, seconds: 0, frames: 0 },
    savedAtMs: Date.now(),
    party: Array(6).fill(null),
    boxes,
    currentBox,
    pokedexOwned: [],
    enteredHof: false,
    battleTowerBestStreak: 0,
  };
}
