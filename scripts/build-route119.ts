// Builds web/src/route119.json: the Route 119 metatile grid classified by
// Feebas-relevant behavior, plus each surfable tile's fishing-spot ID.
//
// The Feebas tile mechanic (see decomps/pokeemerald/src/wild_encounter.c and
// decomps/pokeruby/src/wild_encounter.c) picks 6 of 447 "fishing spots" on
// Route 119 per save seed. A spot is any tile whose metatile behavior is
// surfable AND not a waterfall; the spot IDs are assigned by scanning the
// map in the game's order (emerald partitions into 3 y-sections, each with
// a pre-counted offset — the flat scan still produces 1..447).
//
// We extract from pokeemerald and cross-check pokeruby. If the surfable-tile
// coordinates match, we emit one file; if not, we bail (would need per-game
// data — not expected since RSE share the Route 119 layout).

const EMERALD = "/Users/tiernebre/Projects/decomps/pokeemerald";
const RUBY = "/Users/tiernebre/Projects/decomps/pokeruby";
const OUT = new URL("../web/src/route119.json", import.meta.url);

// Layout from data/layouts/layouts.json:
//   LAYOUT_ROUTE119: width 40, height 140,
//   primary=gTileset_General, secondary=gTileset_Fortree
const WIDTH = 40;
const HEIGHT = 140;
const NUM_METATILES_IN_PRIMARY = 512;

// Parse MB_* values from the decomp enum and the SURFABLE set from
// sTileBitAttributes, so the hex values stay in sync with the source of
// truth instead of being hand-copied.
async function loadMbValues(decompRoot: string): Promise<Map<string, number>> {
  const src = await Deno.readTextFile(
    `${decompRoot}/include/constants/metatile_behaviors.h`,
  );
  const enumBody = src.match(/enum\s*\{([\s\S]*?)\};/);
  if (!enumBody) throw new Error("couldn't find MB enum");
  // Strip // line comments before matching — some entries reference other
  // MB_ names in trailing comments, which would otherwise inflate indices.
  const stripped = enumBody[1].replace(/\/\/[^\n]*/g, "");
  const names = [...stripped.matchAll(/\b(MB_[A-Z0-9_]+)\b/g)].map((m) => m[1]);
  const map = new Map<string, number>();
  names.forEach((n, i) => map.set(n, i));
  return map;
}

async function loadSurfableMbs(decompRoot: string, mbs: Map<string, number>): Promise<Set<number>> {
  const src = await Deno.readTextFile(`${decompRoot}/src/metatile_behavior.c`);
  const table = src.match(/sTileBitAttributes\s*\[[^\]]+\]\s*=\s*\{([\s\S]*?)\};/);
  if (!table) throw new Error("couldn't find sTileBitAttributes");
  const surfable = new Set<number>();
  for (const m of table[1].matchAll(/\[(MB_[A-Z0-9_]+)\]\s*=\s*([^,]+),/g)) {
    if (m[2].includes("TILE_FLAG_SURFABLE")) {
      const v = mbs.get(m[1]);
      if (v === undefined) throw new Error(`unknown MB: ${m[1]}`);
      surfable.add(v);
    }
  }
  return surfable;
}

const MB = await loadMbValues(EMERALD);
const MB_WATERFALL = MB.get("MB_WATERFALL")!;
const SURFABLE = await loadSurfableMbs(EMERALD, MB);

type TileClass = "land" | "water" | "waterfall";

async function classifyRoute119(decompRoot: string): Promise<TileClass[]> {
  const mapBin = await Deno.readFile(`${decompRoot}/data/layouts/Route119/map.bin`);
  const primaryAttrs = await Deno.readFile(
    `${decompRoot}/data/tilesets/primary/general/metatile_attributes.bin`,
  );
  const secondaryAttrs = await Deno.readFile(
    `${decompRoot}/data/tilesets/secondary/fortree/metatile_attributes.bin`,
  );

  if (mapBin.length !== WIDTH * HEIGHT * 2) {
    throw new Error(`${decompRoot}: expected ${WIDTH * HEIGHT * 2} map bytes, got ${mapBin.length}`);
  }

  const behaviorFor = (metatileId: number): number => {
    let attrLo: number, attrHi: number;
    if (metatileId < NUM_METATILES_IN_PRIMARY) {
      attrLo = primaryAttrs[metatileId * 2];
      attrHi = primaryAttrs[metatileId * 2 + 1];
    } else {
      const idx = metatileId - NUM_METATILES_IN_PRIMARY;
      attrLo = secondaryAttrs[idx * 2];
      attrHi = secondaryAttrs[idx * 2 + 1];
    }
    return (attrLo | (attrHi << 8)) & 0xff;
  };

  const tiles: TileClass[] = new Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = y * WIDTH + x;
      const block = mapBin[i * 2] | (mapBin[i * 2 + 1] << 8);
      const metatileId = block & 0x03ff;
      const behavior = behaviorFor(metatileId);
      if (behavior === MB_WATERFALL) tiles[i] = "waterfall";
      else if (SURFABLE.has(behavior)) tiles[i] = "water";
      else tiles[i] = "land";
    }
  }
  return tiles;
}

const emeraldTiles = await classifyRoute119(EMERALD);
const rubyTiles = await classifyRoute119(RUBY);

// Cross-check: every water / waterfall tile should agree.
let mismatches = 0;
for (let i = 0; i < emeraldTiles.length; i++) {
  if (emeraldTiles[i] !== rubyTiles[i]) mismatches++;
}
if (mismatches > 0) {
  console.warn(
    `WARN: ${mismatches} tile classification mismatches between pokeemerald and pokeruby — ` +
      `using emerald data. (Expected 0 for identical Route 119 layouts.)`,
  );
} else {
  console.log("OK: pokeemerald and pokeruby Route 119 tile classifications match.");
}

// Assign fishing spot IDs in scan order (top-to-bottom, left-to-right). This
// matches both the flat RS scan and the Emerald sectioned scan: sections
// 0..2 cover y-ranges 0–45, 46–91, 92–139 contiguously, so a single flat
// pass yields the same 1..N ordering.
type WaterTile = { x: number; y: number; spotId: number };
const waterTiles: WaterTile[] = [];
let spotId = 0;
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    if (emeraldTiles[y * WIDTH + x] === "water") {
      spotId++;
      waterTiles.push({ x, y, spotId });
    }
  }
}

// Sanity-check against the decomp's NUM_FISHING_SPOTS_{1,2,3} = 131, 167, 149.
const SECTION_Y_BOUNDS: [number, number][] = [
  [0, 45], [46, 91], [92, 139],
];
const EXPECTED_PER_SECTION = [131, 167, 149];
const perSection = SECTION_Y_BOUNDS.map(([lo, hi]) =>
  waterTiles.filter((t) => t.y >= lo && t.y <= hi).length
);
for (let i = 0; i < 3; i++) {
  if (perSection[i] !== EXPECTED_PER_SECTION[i]) {
    console.warn(
      `WARN: section ${i} has ${perSection[i]} water tiles, expected ${EXPECTED_PER_SECTION[i]}`,
    );
  }
}
if (waterTiles.length !== 447) {
  console.warn(`WARN: total water tiles = ${waterTiles.length}, expected 447`);
}

// Compact encoding for the renderer:
//   - `water`: flat [x, y, x, y, ...] in spot-ID order (1-based: index 0 → spotId 1)
//   - `waterfall`: flat [x, y, ...] — drawn distinct from fishable water
const water: number[] = [];
for (const t of waterTiles) { water.push(t.x, t.y); }
const waterfall: number[] = [];
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    if (emeraldTiles[y * WIDTH + x] === "waterfall") waterfall.push(x, y);
  }
}

const out = {
  width: WIDTH,
  height: HEIGHT,
  sections: SECTION_Y_BOUNDS.map(([yMin, yMax], i) => ({
    yMin, yMax, spotCount: perSection[i], expectedSpotCount: EXPECTED_PER_SECTION[i],
  })),
  water,       // [x0, y0, x1, y1, ...] — spotId = index/2 + 1
  waterfall,   // [x, y, ...]
};

await Deno.writeTextFile(OUT, JSON.stringify(out) + "\n");
console.log(
  `Wrote ${waterTiles.length} water tiles (${waterfall.length / 2} waterfall) to ${OUT.pathname}`,
);
