// Mirage Island visibility prediction.
//
// R/S/E store a 32-bit RNG in two script vars (VAR_MIRAGE_RND_H/L). The island
// is visible whenever any party member's (PID & 0xFFFF) equals the top 16 bits
// of that RNG. The game advances the RNG once per in-game day via ISO_RANDOMIZE2.
//
// See pokeruby/src/time_events.c (UpdateMirageRnd, IsMirageIslandPresent) and
// pokeemerald/include/random.h (ISO_RANDOMIZE2).

import type { DecodedPokemon } from "../../hub/protocol.ts";

// ISO_RANDOMIZE2(val) = 1103515245 * val + 12345, u32 overflow.
export function iso2(rnd: number): number {
  return (Math.imul(rnd, 1103515245) + 12345) >>> 0;
}

// The comparison value for day N (N=0 = today).
export function mirageKeyForDay(rnd: number, dayOffset: number): number {
  let r = rnd >>> 0;
  for (let i = 0; i < dayOffset; i++) r = iso2(r);
  return (r >>> 16) & 0xFFFF;
}

export type MirageHit = {
  dayOffset: number;
  slot: number;
  mon: DecodedPokemon;
};

// Scan `horizonDays` into the future and return every day where any party
// member triggers the island. Day 0 = today.
export function predictMirageHits(
  rnd: number,
  party: (DecodedPokemon | null)[],
  horizonDays: number,
): MirageHit[] {
  const pids: { slot: number; mon: DecodedPokemon; low: number }[] = [];
  party.forEach((mon, slot) => {
    if (mon) pids.push({ slot, mon, low: mon.pid & 0xFFFF });
  });
  if (pids.length === 0) return [];
  const hits: MirageHit[] = [];
  let r = rnd >>> 0;
  for (let d = 0; d <= horizonDays; d++) {
    const key = (r >>> 16) & 0xFFFF;
    for (const p of pids) {
      if (p.low === key) hits.push({ dayOffset: d, slot: p.slot, mon: p.mon });
    }
    r = iso2(r);
  }
  return hits;
}

export function isMirageVisibleToday(
  rnd: number,
  party: (DecodedPokemon | null)[],
): MirageHit | null {
  const key = (rnd >>> 16) & 0xFFFF;
  for (let slot = 0; slot < party.length; slot++) {
    const mon = party[slot];
    if (mon && (mon.pid & 0xFFFF) === key) return { dayOffset: 0, slot, mon };
  }
  return null;
}
