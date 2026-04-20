// Fetches Gen 1–3 species (dex 1–386) from PokeAPI and writes a static
// lookup to web/src/species.json. The file is keyed by the Gen 3 *internal*
// species index (what the save file stores), so UI lookups by the decoder's
// `species` field work directly. Run with `deno task species`.

const MAX_DEX = 386;
const CONCURRENCY = 16;
const OUT = new URL("../web/src/species.json", import.meta.url);

type StatBlock = { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };

type GrowthRate = "slow" | "medium" | "fast" | "medium-slow" | "slow-then-very-fast" | "fast-then-very-slow";

type Species = {
  nationalDex: number;
  name: string;
  types: string[];
  sprite: string;
  internalIndex: number;
  baseStats: StatBlock;
  growthRate: GrowthRate;
  // abilities[0] = slot 1 (abilityBit 0), abilities[1] = slot 2 (abilityBit 1).
  // Gen 3 has no hidden abilities; if a species only has one, both slots map to it.
  abilities: [string, string];
};

type GameIndex = { game_index: number; version: { name: string } };
type StatEntry = { base_stat: number; stat: { name: string } };

const STAT_NAME_MAP: Record<string, keyof StatBlock> = {
  "hp": "hp",
  "attack": "atk",
  "defense": "def",
  "special-attack": "spa",
  "special-defense": "spd",
  "speed": "spe",
};

// PokeAPI exposes 6 growth rates at /growth-rate/1..6. Each lists all species
// that use it, so six requests are enough to cover every Pokémon.
const GROWTH_RATE_IDS: GrowthRate[] = [
  "slow", "medium", "fast", "medium-slow", "slow-then-very-fast", "fast-then-very-slow",
];

async function loadGrowthRates(): Promise<Record<number, GrowthRate>> {
  const out: Record<number, GrowthRate> = {};
  await Promise.all(
    GROWTH_RATE_IDS.map(async (name) => {
      const res = await fetch(`https://pokeapi.co/api/v2/growth-rate/${name}`);
      if (!res.ok) throw new Error(`growth-rate ${name}: ${res.status}`);
      const data = await res.json() as { pokemon_species: { url: string }[] };
      for (const ps of data.pokemon_species) {
        const m = ps.url.match(/\/pokemon-species\/(\d+)\/?$/);
        if (m) out[Number(m[1])] = name;
      }
    }),
  );
  return out;
}

const growthByDex = await loadGrowthRates();

async function fetchOne(id: number): Promise<Species> {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res.ok) throw new Error(`dex ${id}: ${res.status}`);
  const data = await res.json();
  const ruby = data.game_indices.find((g: GameIndex) => g.version.name === "ruby");
  if (!ruby) throw new Error(`dex ${id}: no Ruby game_index`);
  const baseStats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const s of data.stats as StatEntry[]) {
    const key = STAT_NAME_MAP[s.stat.name];
    if (key) baseStats[key] = s.base_stat;
  }
  const growthRate = growthByDex[id];
  if (!growthRate) throw new Error(`dex ${id}: no growth rate`);
  type AbilityEntry = { ability: { name: string }; slot: number; is_hidden: boolean };
  const visible = (data.abilities as AbilityEntry[]).filter((a) => !a.is_hidden);
  const slot1 = visible.find((a) => a.slot === 1)?.ability.name ?? visible[0]?.ability.name ?? "";
  const slot2 = visible.find((a) => a.slot === 2)?.ability.name ?? slot1;
  const abilities: [string, string] = [slot1, slot2];
  return {
    nationalDex: id,
    name: data.name,
    types: data.types.map((t: { type: { name: string } }) => t.type.name),
    sprite: data.sprites.front_default,
    internalIndex: ruby.game_index,
    baseStats,
    growthRate,
    abilities,
  };
}

const results: Species[] = new Array(MAX_DEX);
let next = 1;
let done = 0;

async function worker() {
  while (next <= MAX_DEX) {
    const id = next++;
    results[id - 1] = await fetchOne(id);
    done++;
    if (done % 25 === 0) console.log(`  ${done}/${MAX_DEX}`);
  }
}

console.log(`Fetching ${MAX_DEX} species from PokeAPI…`);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const byInternal: Record<number, Species> = {};
for (const s of results) byInternal[s.internalIndex] = s;

await Deno.writeTextFile(OUT, JSON.stringify(byInternal, null, 2));
console.log(`Wrote ${OUT.pathname}`);
