// Builds web/src/hoenn-dex.json: an ordered list of the 202 Hoenn regional dex
// entries in Ruby/Sapphire/Emerald order. Each entry maps the Hoenn slot (1..202)
// to the national dex number + canonical name.
//
// Source of truth: pokeruby's include/constants/species.h, which defines
// `#define HOENN_DEX_<NAME> <n>` where n=1..202 is the regional slot. We
// cross-reference names against web/src/species.json (keyed by internal Gen 3
// index) to get the national dex number.

const DECOMP_SPECIES_H = "/Users/tiernebre/Projects/decomps/pokeruby/include/constants/species.h";
const SPECIES_JSON = new URL("../web/src/species.json", import.meta.url);
const OUT = new URL("../web/src/hoenn-dex.json", import.meta.url);

type Species = { nationalDex: number; name: string };
const speciesRaw: Record<string, Species> = JSON.parse(
  await Deno.readTextFile(SPECIES_JSON),
);
const byName = new Map<string, Species>();
for (const s of Object.values(speciesRaw)) byName.set(s.name.toLowerCase(), s);
// PokeAPI uses form-qualified names (e.g. deoxys-normal); the decomp uses bare
// species names. Alias the bare name to the base form.
const ALIASES: Record<string, string> = { deoxys: "deoxys-normal" };
for (const [alias, canonical] of Object.entries(ALIASES)) {
  const s = byName.get(canonical);
  if (s) byName.set(alias, s);
}

const src = await Deno.readTextFile(DECOMP_SPECIES_H);
const slots: { hoennDex: number; nationalDex: number; name: string }[] = [];
for (const line of src.split("\n")) {
  const m = line.match(/^#define HOENN_DEX_([A-Z_]+)\s+(\d+)/);
  if (!m) continue;
  const hoennDex = Number(m[2]);
  if (hoennDex < 1 || hoennDex > 202) continue;
  const name = m[1].toLowerCase();
  const species = byName.get(name);
  if (!species) {
    console.warn(`No species.json entry for ${name}`);
    continue;
  }
  slots.push({ hoennDex, nationalDex: species.nationalDex, name: species.name });
}
slots.sort((a, b) => a.hoennDex - b.hoennDex);
if (slots.length !== 202) {
  console.error(`Expected 202 entries, got ${slots.length}`);
  Deno.exit(1);
}

await Deno.writeTextFile(OUT, JSON.stringify(slots, null, 2) + "\n");
console.log(`Wrote ${slots.length} Hoenn dex entries to ${OUT.pathname}`);
