import speciesData from "./species.json";
import movesData from "./moves.json";
import encountersData from "./encounters.json";
import hoennDexData from "./hoenn-dex.json";
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
export const mapsecNames = mapsecData as string[];

export const speciesByNationalDex: Record<number, Species> = (() => {
  const map: Record<number, Species> = {};
  for (const s of Object.values(species)) map[s.nationalDex] = s;
  return map;
})();

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
