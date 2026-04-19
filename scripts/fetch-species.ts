// Fetches Gen 1–3 species (dex 1–386) from PokeAPI and writes a static
// lookup to web/src/species.json. The file is keyed by the Gen 3 *internal*
// species index (what the save file stores), so UI lookups by the decoder's
// `species` field work directly. Run with `deno task species`.

const MAX_DEX = 386;
const CONCURRENCY = 16;
const OUT = new URL("../web/src/species.json", import.meta.url);

type Species = {
  nationalDex: number;
  name: string;
  types: string[];
  sprite: string;
  internalIndex: number;
};

type GameIndex = { game_index: number; version: { name: string } };

async function fetchOne(id: number): Promise<Species> {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res.ok) throw new Error(`dex ${id}: ${res.status}`);
  const data = await res.json();
  const ruby = data.game_indices.find((g: GameIndex) => g.version.name === "ruby");
  if (!ruby) throw new Error(`dex ${id}: no Ruby game_index`);
  return {
    nationalDex: id,
    name: data.name,
    types: data.types.map((t: { type: { name: string } }) => t.type.name),
    sprite: data.sprites.front_default,
    internalIndex: ruby.game_index,
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
