// Builds web/src/mapsec.json: an ordered list of Hoenn map-section display
// names, indexed by MAPSEC id (matches the enum in pokeruby's
// include/constants/region_map_sections.h).
//
// Source: pokeruby/src/data/region_map/region_map_sections.json. Names use
// in-game string tokens like {NAME_END} that we strip for display.

const SRC = "/Users/tiernebre/Projects/decomps/pokeruby/src/data/region_map/region_map_sections.json";
const OUT = new URL("../web/src/mapsec.json", import.meta.url);

type Section = { id: string; name: string };
const raw = JSON.parse(await Deno.readTextFile(SRC)) as { map_sections: Section[] };

function prettify(name: string): string {
  const cleaned = name.replace(/\{[A-Z_]+\}/g, " ").replace(/\s+/g, " ").trim();
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((w) => (w === "of" ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

const names = raw.map_sections.map((s) => prettify(s.name));
await Deno.writeTextFile(OUT, JSON.stringify(names, null, 2) + "\n");
console.log(`Wrote ${names.length} map sections to ${OUT.pathname}`);
