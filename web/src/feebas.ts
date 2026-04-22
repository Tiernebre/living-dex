// Feebas tile selection for Gen 3 Route 119.
//
// The game seeds a small LCG from a save-persisted u16 and picks 6 fishing
// spots (IDs 1..447). Ruby/Sapphire use saveblock1.easyChatPairs[0].unk2 as
// the seed; Emerald uses saveblock1.dewfordTrends[0].rand. The PRNG and
// selection logic are otherwise identical — both apply ISO_RANDOMIZE2
// (`1103515245 * x + 12345`) and remap a `% 447` result of 0 back to 447.
// Refs: pokeemerald/src/wild_encounter.c CheckFeebas / FeebasRandom,
//       pokeruby/src/wild_encounter.c CheckFeebas / FeebasRandom.

import route119 from "./route119.json";

export type TileXY = { x: number; y: number };

export type Route119Data = {
  width: number;
  height: number;
  sections: { yMin: number; yMax: number; spotCount: number; expectedSpotCount: number }[];
  water: number[];      // flat [x0, y0, x1, y1, ...]; spotId = i/2 + 1
  waterfall: number[];  // flat [x, y, ...]
};

export const ROUTE119 = route119 as Route119Data;
export const NUM_FISHING_SPOTS = ROUTE119.water.length / 2;
export const NUM_FEEBAS_SPOTS = 6;

// Returns (x, y) for a 1-based fishing-spot ID.
export function spotIdToXY(spotId: number): TileXY {
  const i = (spotId - 1) * 2;
  return { x: ROUTE119.water[i], y: ROUTE119.water[i + 1] };
}

// ISO_RANDOMIZE2 operating on u32 (Math.imul handles the multiplication
// overflow; the unsigned shift keeps the state in [0, 2^32)).
function isoRandomize2(state: number): number {
  return (Math.imul(state, 1103515245) + 12345) >>> 0;
}

// Run the game's 6-spot selection for a given u16 seed. Returns the spot
// IDs in the order the game draws them — duplicates are preserved because
// the game itself doesn't dedupe (a "6 spots" save can cover fewer unique
// tiles when the PRNG repeats).
export function pickFeebasSpotIds(seed: number): number[] {
  let state = seed >>> 0;
  const spots: number[] = [];
  for (let i = 0; i < NUM_FEEBAS_SPOTS; i++) {
    state = isoRandomize2(state);
    const r = (state >>> 16) & 0xffff;
    let spot = r % NUM_FISHING_SPOTS;
    if (spot === 0) spot = NUM_FISHING_SPOTS;
    spots.push(spot);
  }
  return spots;
}

// Convenience: the 6 spots as (x, y) tiles (with duplicates collapsed to a
// unique set, since visually we can't highlight the same tile twice).
export function feebasTiles(seed: number): { spots: number[]; unique: TileXY[] } {
  const spots = pickFeebasSpotIds(seed);
  const seen = new Set<number>();
  const unique: TileXY[] = [];
  for (const id of spots) {
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(spotIdToXY(id));
  }
  return { spots, unique };
}
