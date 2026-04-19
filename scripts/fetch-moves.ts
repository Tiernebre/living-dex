// Fetches Gen 1–3 moves (ids 1–354) from PokeAPI and writes a static lookup
// to web/src/moves.json keyed by move id (which matches the Gen 3 save index).
// Run with `deno task moves`.

const MAX_MOVE = 354;
const CONCURRENCY = 16;
const OUT = new URL("../web/src/moves.json", import.meta.url);

type Move = {
  id: number;
  name: string;
  type: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
};

async function fetchOne(id: number): Promise<Move> {
  const res = await fetch(`https://pokeapi.co/api/v2/move/${id}`);
  if (!res.ok) throw new Error(`move ${id}: ${res.status}`);
  const data = await res.json();
  return {
    id,
    name: data.name,
    type: data.type.name,
    category: data.damage_class?.name ?? "status",
    power: data.power,
    accuracy: data.accuracy,
    pp: data.pp,
  };
}

const results: Move[] = new Array(MAX_MOVE);
let next = 1;
let done = 0;

async function worker() {
  while (next <= MAX_MOVE) {
    const id = next++;
    results[id - 1] = await fetchOne(id);
    done++;
    if (done % 25 === 0) console.log(`  ${done}/${MAX_MOVE}`);
  }
}

console.log(`Fetching ${MAX_MOVE} moves from PokeAPI…`);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const byId: Record<number, Move> = {};
for (const m of results) byId[m.id] = m;

await Deno.writeTextFile(OUT, JSON.stringify(byId, null, 2));
console.log(`Wrote ${OUT.pathname}`);
