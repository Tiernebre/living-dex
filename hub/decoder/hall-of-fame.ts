// Parse the Gen 3 Hall of Fame record out of flash sectors 28-29.
// These two sectors live outside the A/B save-slot rotation — there's only one
// copy of HoF data, overwritten in place each E4 clear.
//
// Layout (pokeruby/src/save.c, pokeruby/src/hall_of_fame.c):
//   sector 28 (id=0): first 3968 bytes of HoF buffer
//   sector 29 (id=1): next  3968 bytes of HoF buffer
//   total buffer: 7936 bytes, holding struct HallofFameMons[50]
//   struct HallofFameMons { HallofFameMon mons[6]; }     // 120 bytes
//   struct HallofFameMon {
//     u32 tid; u32 personality;
//     u16 species:9, lvl:7;
//     u8  nick[10];
//   }                                                     // 20 bytes
//
// Ordering: new clears are written into the first slot whose first mon has
// species == 0. Once full, the whole array shifts forward one slot (dropping
// oldest) and the new team goes to index 49. Therefore the entries are
// oldest-first up to the last non-empty team.

import type { HallOfFameTeam } from "../protocol.ts";

const SECTOR_SIZE = 0x1000;
const SECTOR_DATA_SIZE = 0xF80; // 3968
const FILE_SIGNATURE = 0x08012025;
const HALL_OF_FAME_SECTOR = 28;
const HALL_OF_FAME_MAX_TEAMS = 50;
const TEAM_SIZE = 120;
const MON_SIZE = 20;

// Gen 3 charmap subset for nicknames. Matches the table in save-ruby.ts —
// duplicated here so this helper stays standalone (future Emerald/FRLG
// parsers just call parseHallOfFame directly).
const CHARMAP: Record<number, string> = (() => {
  const m: Record<number, string> = { 0x00: " " };
  for (let i = 0; i < 10; i++) m[0xA1 + i] = String.fromCharCode(48 + i);
  for (let i = 0; i < 26; i++) m[0xBB + i] = String.fromCharCode(65 + i);
  for (let i = 0; i < 26; i++) m[0xD5 + i] = String.fromCharCode(97 + i);
  return m;
})();

function decodeNick(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    if (b === 0xFF) break;
    out += CHARMAP[b] ?? "?";
  }
  return out;
}

export function parseHallOfFame(buf: Uint8Array): HallOfFameTeam[] {
  if (buf.length < (HALL_OF_FAME_SECTOR + 2) * SECTOR_SIZE) return [];
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  const chunks: (Uint8Array | null)[] = [null, null];
  for (let i = 0; i < 2; i++) {
    const base = (HALL_OF_FAME_SECTOR + i) * SECTOR_SIZE;
    if (view.getUint32(base + 0xFF8, true) !== FILE_SIGNATURE) continue;
    chunks[i] = buf.subarray(base, base + SECTOR_DATA_SIZE);
  }
  if (!chunks[0] || !chunks[1]) return [];

  const hof = new Uint8Array(2 * SECTOR_DATA_SIZE);
  hof.set(chunks[0]!, 0);
  hof.set(chunks[1]!, SECTOR_DATA_SIZE);
  const hofView = new DataView(hof.buffer, hof.byteOffset, hof.byteLength);

  const teams: HallOfFameTeam[] = [];
  for (let t = 0; t < HALL_OF_FAME_MAX_TEAMS; t++) {
    const teamOff = t * TEAM_SIZE;
    // Empty slot sentinel: first mon's species == 0. Everything after is
    // guaranteed empty too (teams are packed oldest-first).
    const firstSpecies = hofView.getUint16(teamOff + 8, true) & 0x01FF;
    if (firstSpecies === 0) break;

    const mons = [];
    for (let m = 0; m < 6; m++) {
      const off = teamOff + m * MON_SIZE;
      const species = hofView.getUint16(off + 8, true) & 0x01FF;
      if (species === 0) continue;
      const packed = hofView.getUint16(off + 8, true);
      mons.push({
        tid: hofView.getUint32(off + 0, true) >>> 0,
        personality: hofView.getUint32(off + 4, true) >>> 0,
        species,
        level: (packed >> 9) & 0x7F,
        nickname: decodeNick(hof.subarray(off + 10, off + 20)),
      });
    }
    if (mons.length > 0) teams.push({ mons });
  }
  return teams;
}
