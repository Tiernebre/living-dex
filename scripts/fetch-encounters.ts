// Builds web/src/encounters.json from pret/pokeruby's map_groups.json + wild_encounters.json.
//
// Keys line up with the LOCATION region emitted by the Lua collector
// (SaveBlock1.location.mapGroup / mapNum). pret's data is the same source PokeAPI
// draws from, but direct gives us exact slot weights and avoids a 200-request
// PokeAPI crawl. Run with `deno task encounters`.

const POKERUBY_BASE = "https://raw.githubusercontent.com/pret/pokeruby/master";
const MAP_GROUPS_URL = `${POKERUBY_BASE}/data/maps/map_groups.json`;
const WILD_URL = `${POKERUBY_BASE}/src/data/wild_encounters.json`;
const SPECIES_JSON = new URL("../web/src/species.json", import.meta.url);
const OUT = new URL("../web/src/encounters.json", import.meta.url);

// Which base_label suffixes we treat as Ruby encounter tables.
const RUBY_SUFFIXES = ["_Ruby", "_RubyEmerald", "_RubySapphire", "_RubySapphireEmerald"];

type SpeciesJson = Record<
  string,
  { nationalDex: number; name: string; internalIndex: number }
>;

type MapGroups = {
  group_order: string[];
  [group: string]: string[];
};

type Mon = {
  min_level: number;
  max_level: number;
  species: string; // e.g. "SPECIES_POOCHYENA"
};

type FieldDef = {
  type: "land_mons" | "water_mons" | "rock_smash_mons" | "fishing_mons";
  encounter_rates: number[];
  groups?: { [rod: string]: number[] };
};

type EncounterEntry = {
  map: string;
  base_label: string;
  land_mons?: { encounter_rate: number; mons: Mon[] };
  water_mons?: { encounter_rate: number; mons: Mon[] };
  rock_smash_mons?: { encounter_rate: number; mons: Mon[] };
  fishing_mons?: { encounter_rate: number; mons: Mon[] };
};

type WildJson = {
  wild_encounter_groups: {
    label: string;
    for_maps: boolean;
    fields: FieldDef[];
    encounters: EncounterEntry[];
  }[];
};

type EncounterPokemon = {
  species: number; // Gen 3 internal index — matches DecodedPokemon.species
  nationalDex: number;
  name: string;
  minLevel: number;
  maxLevel: number;
  chance: number; // percent within its method
};

type MethodTable = {
  method: string; // "walk" | "surf" | "rock-smash" | "old-rod" | "good-rod" | "super-rod"
  rate: number; // overall method rate from pret (`encounter_rate`)
  encounters: EncounterPokemon[];
};

type LocationEntry = {
  name: string; // pret map constant, e.g. "MAP_ROUTE_101"
  label: string; // human-friendly label
  methods: MethodTable[];
};

const speciesByInternal: SpeciesJson = JSON.parse(
  await Deno.readTextFile(SPECIES_JSON),
);
const speciesByPretName: Record<string, { nationalDex: number; internalIndex: number; name: string }> = {};
for (const key of Object.keys(speciesByInternal)) {
  const s = speciesByInternal[key];
  // pret uses SPECIES_POOCHYENA; PokeAPI uses "poochyena".
  // Handle species with hyphens/dots specially: nidoran-f/m, mr-mime, ho-oh, etc.
  const pretKey = "SPECIES_" + pretSpeciesKey(s.name);
  speciesByPretName[pretKey] = { nationalDex: s.nationalDex, internalIndex: s.internalIndex, name: s.name };
}

function pretSpeciesKey(name: string): string {
  // PokeAPI names we need to normalize:
  //   nidoran-f → NIDORAN_F
  //   nidoran-m → NIDORAN_M
  //   mr-mime   → MR_MIME
  //   ho-oh     → HO_OH
  //   mime-jr   → MIME_JR (n/a for Gen3 but harmless)
  //   farfetchd → FARFETCHD (already fine)
  //   deoxys    → DEOXYS_NORMAL in pret? pret uses SPECIES_DEOXYS
  return name.replace(/-/g, "_").toUpperCase();
}

// Manual overrides for species whose pret name diverges from PokeAPI's slug.
speciesByPretName["SPECIES_NIDORAN_F"] ??= speciesByPretName["SPECIES_NIDORAN-F"];

// pret CamelCase → MAP_MACRO_CASE (what wild_encounters.json uses).
// Rules: (a) split _ verbatim, (b) within each part insert _ between
// lowercase→uppercase and between uppercase→uppercase+lowercase, then
// uppercase everything. Examples:
//   Route101         → ROUTE101
//   PetalburgWoods   → PETALBURG_WOODS
//   GraniteCave_1F   → GRANITE_CAVE_1F
//   MtPyre_Summit    → MT_PYRE_SUMMIT
//   SSTidalCorridor  → SS_TIDAL_CORRIDOR
function pretMapToConstant(pretName: string): string {
  const parts = pretName.split("_");
  const converted = parts.map((p) =>
    p
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
      .toUpperCase(),
  );
  return "MAP_" + converted.join("_");
}

// Labels for the UI. Pretty much the pret constant with spaces.
function toLabel(pretName: string): string {
  return pretName.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
}

console.log("Fetching pret sources…");
const [mapGroupsRes, wildRes] = await Promise.all([
  fetch(MAP_GROUPS_URL),
  fetch(WILD_URL),
]);
const mapGroups: MapGroups = await mapGroupsRes.json();
const wild: WildJson = await wildRes.json();

// Build: MAP_CONSTANT → { mapGroup, mapNum, label }
const mapConstantIndex = new Map<string, { mapGroup: number; mapNum: number; label: string }>();
for (let g = 0; g < mapGroups.group_order.length; g++) {
  const maps = mapGroups[mapGroups.group_order[g]] as string[];
  for (let n = 0; n < maps.length; n++) {
    mapConstantIndex.set(pretMapToConstant(maps[n]), {
      mapGroup: g,
      mapNum: n,
      label: toLabel(maps[n]),
    });
  }
}

const header = wild.wild_encounter_groups.find((g) => g.label === "gWildMonHeaders");
if (!header) throw new Error("gWildMonHeaders not found in wild_encounters.json");

const fieldsByType = new Map<string, FieldDef>();
for (const f of header.fields) fieldsByType.set(f.type, f);

const METHOD_LABEL: Record<string, string> = {
  land_mons: "walk",
  water_mons: "surf",
  rock_smash_mons: "rock-smash",
};

function dexlookup(spLabel: string): { species: number; nationalDex: number; name: string } | null {
  const hit = speciesByPretName[spLabel];
  if (hit) return { species: hit.internalIndex, nationalDex: hit.nationalDex, name: hit.name };
  // Try a few pret→pokeapi normalizations for oddball names.
  // e.g. SPECIES_NIDORAN_F (pret) but PokeAPI "nidoran-f" → key we stored is "SPECIES_NIDORAN-F"
  //   (pretSpeciesKey replaced "-" with "_", so it'd already match). Nothing to do here yet.
  return null;
}

function foldEncounters(
  mons: Mon[],
  slotIndices: number[],
  rates: number[],
): EncounterPokemon[] {
  // Sum chance per (species) for the given slot indices; track min/max level.
  const byKey = new Map<string, EncounterPokemon>();
  let missing = new Set<string>();
  for (const i of slotIndices) {
    const m = mons[i];
    if (!m) continue;
    const sp = dexlookup(m.species);
    if (!sp) {
      missing.add(m.species);
      continue;
    }
    const rate = rates[i] ?? 0;
    const key = `${sp.species}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.chance += rate;
      existing.minLevel = Math.min(existing.minLevel, m.min_level);
      existing.maxLevel = Math.max(existing.maxLevel, m.max_level);
    } else {
      byKey.set(key, {
        species: sp.species,
        nationalDex: sp.nationalDex,
        name: sp.name,
        minLevel: m.min_level,
        maxLevel: m.max_level,
        chance: rate,
      });
    }
  }
  if (missing.size > 0) {
    console.warn(`  [miss] species without mapping: ${[...missing].join(", ")}`);
  }
  return [...byKey.values()].sort((a, b) => b.chance - a.chance);
}

function isRubyEntry(baseLabel: string): boolean {
  return RUBY_SUFFIXES.some((sfx) => baseLabel.endsWith(sfx));
}

function rubyPriority(baseLabel: string): number {
  // Prefer Ruby-specific tables over shared ones when both exist for the same map.
  if (baseLabel.endsWith("_Ruby")) return 3;
  if (baseLabel.endsWith("_RubySapphire")) return 2;
  if (baseLabel.endsWith("_RubySapphireEmerald")) return 1;
  if (baseLabel.endsWith("_RubyEmerald")) return 1;
  return 0;
}

const out: Record<string, LocationEntry> = {};
const skippedNoConstant: string[] = [];
const chosenEntry = new Map<string, EncounterEntry>();

for (const e of header.encounters) {
  if (!isRubyEntry(e.base_label)) continue;
  const meta = mapConstantIndex.get(e.map);
  if (!meta) {
    skippedNoConstant.push(`${e.map} (${e.base_label})`);
    continue;
  }
  const key = `${meta.mapGroup}:${meta.mapNum}`;
  const prev = chosenEntry.get(key);
  if (!prev || rubyPriority(e.base_label) > rubyPriority(prev.base_label)) {
    chosenEntry.set(key, e);
  }
}

for (const [key, e] of chosenEntry) {
  const [g, n] = key.split(":").map(Number);
  let constantMeta: { label: string } = { label: e.map };
  for (const [mc, meta] of mapConstantIndex) {
    if (meta.mapGroup === g && meta.mapNum === n) {
      constantMeta = { label: meta.label };
      void mc;
      break;
    }
  }

  const methods: MethodTable[] = [];

  for (const type of ["land_mons", "water_mons", "rock_smash_mons"] as const) {
    const block = e[type];
    if (!block) continue;
    const field = fieldsByType.get(type);
    if (!field) continue;
    const indices = block.mons.map((_, i) => i);
    const encounters = foldEncounters(block.mons, indices, field.encounter_rates);
    if (encounters.length === 0) continue;
    methods.push({
      method: METHOD_LABEL[type],
      rate: block.encounter_rate,
      encounters,
    });
  }

  if (e.fishing_mons) {
    const field = fieldsByType.get("fishing_mons");
    if (field?.groups) {
      for (const [rod, slots] of Object.entries(field.groups)) {
        const encounters = foldEncounters(e.fishing_mons.mons, slots, field.encounter_rates);
        if (encounters.length === 0) continue;
        methods.push({
          method: rod.replace(/_/g, "-"), // old_rod → old-rod
          rate: e.fishing_mons.encounter_rate,
          encounters,
        });
      }
    }
  }

  if (methods.length === 0) continue;
  out[key] = {
    name: e.map,
    label: constantMeta.label,
    methods,
  };
}

await Deno.writeTextFile(OUT, JSON.stringify(out, null, 2));
console.log(`Wrote ${OUT.pathname} (${Object.keys(out).length} locations)`);
if (skippedNoConstant.length > 0) {
  console.log(`\n${skippedNoConstant.length} entries skipped (map constant not in map_groups.json):`);
  for (const s of skippedNoConstant.slice(0, 20)) console.log(`  - ${s}`);
  if (skippedNoConstant.length > 20) console.log(`  … and ${skippedNoConstant.length - 20} more`);
}
