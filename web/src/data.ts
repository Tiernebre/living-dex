import type { GameStem } from "../../hub/protocol.ts";
import speciesData from "./species.json";
import movesData from "./moves.json";
import encountersData from "./encounters.json";
import hoennDexData from "./hoenn-dex.json";
import sinnohDexData from "./sinnoh-dex.json";
import mapsecData from "./mapsec.json";

export type GrowthRate =
  | "slow"
  | "medium"
  | "fast"
  | "medium-slow"
  | "slow-then-very-fast"
  | "fast-then-very-slow";

export type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";
export type StatBlock = Record<StatKey, number>;

export type Species = {
  nationalDex: number;
  name: string;
  types: string[];
  sprite: string | null;
  internalIndex: number;
  baseStats: StatBlock;
  growthRate: GrowthRate;
  abilities: string[];
};

export type MoveInfo = {
  id: number;
  name: string;
  type: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
};

export type HoennDexEntry = { hoennDex: number; nationalDex: number; name: string };
export type SinnohDexEntry = { sinnohDex: number; nationalDex: number; name: string };

export type EncounterPokemon = {
  species: number;
  nationalDex: number;
  name: string;
  minLevel: number;
  maxLevel: number;
  chance: number;
};
export type MethodTable = { method: string; rate: number; encounters: EncounterPokemon[] };
export type LocationEntry = { name: string; label: string; methods: MethodTable[] };

export const species = speciesData as Record<string, Species>;
export const moves = movesData as Record<string, MoveInfo>;
export const encounters = encountersData as Record<string, LocationEntry>;
export const hoennDex = hoennDexData as HoennDexEntry[];
export const sinnohDex = sinnohDexData as SinnohDexEntry[];
export const mapsecNames = mapsecData as string[];

export const speciesByNationalDex: Record<number, Species> = (() => {
  const map: Record<number, Species> = {};
  for (const s of Object.values(species)) map[s.nationalDex] = s;
  return map;
})();

// Normalized regional-dex view for game pages. Hoenn and Sinnoh JSONs each
// use their own field names ("hoennDex" / "sinnohDex"), so map both into a
// shared {regional, nationalDex, name} shape that the grid UI can render
// generically. Kanto has no JSON — national #1-151 is already the regional
// numbering, so we synthesize it from speciesByNationalDex.
export type RegionalDexEntry = { regional: number; nationalDex: number; name: string };
export type RegionalDexView = { label: string; entries: RegionalDexEntry[] };

export function regionalDexFor(stem: GameStem): RegionalDexView | null {
  if (stem === "ruby" || stem === "sapphire" || stem === "emerald") {
    return {
      label: "Hoenn Dex",
      entries: hoennDex.map((e) => ({
        regional: e.hoennDex,
        nationalDex: e.nationalDex,
        name: e.name,
      })),
    };
  }
  if (stem === "diamond") {
    return {
      label: "Sinnoh Dex",
      entries: sinnohDex.map((e) => ({
        regional: e.sinnohDex,
        nationalDex: e.nationalDex,
        name: e.name,
      })),
    };
  }
  if (stem === "firered" || stem === "leafgreen") {
    return {
      label: "Kanto Dex",
      entries: Array.from({ length: 151 }, (_, i) => {
        const nationalDex = i + 1;
        return {
          regional: nationalDex,
          nationalDex,
          name: speciesByNationalDex[nationalDex]?.name ?? `species-${nationalDex}`,
        };
      }),
    };
  }
  return null;
}

export function lookup(id: number): Species | undefined {
  return species[String(id)];
}

export function lookupMove(id: number): MoveInfo | undefined {
  return moves[String(id)];
}

const METLOC_SPECIAL_EGG = 0xfd;
const METLOC_IN_GAME_TRADE = 0xfe;
const METLOC_FATEFUL_ENCOUNTER = 0xff;

export function mapsecLabel(id: number | null): string {
  if (id == null) return "Unknown";
  if (id === METLOC_SPECIAL_EGG) return "Egg";
  if (id === METLOC_IN_GAME_TRADE) return "In-game trade";
  if (id === METLOC_FATEFUL_ENCOUNTER) return "Fateful encounter";
  return mapsecNames[id] ?? `Map #${id}`;
}

export const ORIGIN_GAME_LABEL: Record<number, string> = {
  1: "Sapphire",
  2: "Ruby",
  3: "Emerald",
  4: "FireRed",
  5: "LeafGreen",
  15: "Colosseum/XD",
};
