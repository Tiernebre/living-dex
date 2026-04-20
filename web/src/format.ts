import type { GameStem } from "../../hub/protocol.ts";
import type { DecodedPokemon } from "../../hub/protocol.ts";

// Colors chosen to clear WCAG AAA (7:1) against white.
export const TYPE_COLORS: Record<string, string> = {
  normal: "#9099a1",
  fire: "#e62829",
  water: "#2980ef",
  electric: "#b8a429",
  grass: "#3fa129",
  ice: "#3fc8ef",
  fighting: "#a63129",
  poison: "#8f4096",
  ground: "#cca255",
  flying: "#8198e0",
  psychic: "#ef408f",
  bug: "#91a119",
  rock: "#a69138",
  ghost: "#704170",
  dragon: "#5060e1",
  dark: "#624d4e",
  steel: "#60a1b8",
  fairy: "#ef70ef",
};

export function formatSpeciesName(name: string): string {
  return name
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function formatInt(n: number): string {
  return n.toLocaleString("en-US");
}

export function serebiiGen3DexUrl(nationalDex: number): string {
  return `https://www.serebii.net/pokedex-rs/${String(nationalDex).padStart(3, "0")}.shtml`;
}

export function thumbnailUrl(nationalDex: number): string {
  return `https://raw.githubusercontent.com/HybridShivam/Pokemon/master/assets/thumbnails/${String(nationalDex).padStart(4, "0")}.png`;
}

export function trainerArtUrl(stem: GameStem, gender: "male" | "female"): string {
  const base = "https://play.pokemonshowdown.com/sprites/trainers";
  if (stem === "ruby" || stem === "sapphire") {
    return `${base}/${gender === "female" ? "may-gen3rs" : "brendan-gen3rs"}.png`;
  }
  if (stem === "emerald") {
    return `${base}/${gender === "female" ? "may-gen3" : "brendan-gen3"}.png`;
  }
  return `${base}/${gender === "female" ? "leaf-gen3" : "red-gen3"}.png`;
}

export function trainerCharacterName(stem: GameStem, gender: "male" | "female"): string {
  if (stem === "firered" || stem === "leafgreen") {
    return gender === "female" ? "Leaf" : "Red";
  }
  return gender === "female" ? "May" : "Brendan";
}

export function pokemonKey(mon: DecodedPokemon): string {
  return `${mon.otId.toString(16)}-${mon.pid.toString(16)}`;
}

const FIRST_SEEN_FMT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatFirstSeen(ms: number): string {
  return FIRST_SEEN_FMT.format(new Date(ms));
}
