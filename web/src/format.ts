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

// Colosseum and XD each have a single canonical protagonist (no gender pick),
// so the Bulbagarden Archives character renders stand in for both save
// variants. These are full-color artwork PNGs rather than GBA pixel sprites —
// consumers should skip `imageRendering: pixelated` for these stems.
export function trainerArtUrl(stem: GameStem, gender: "male" | "female"): string {
  if (stem === "colosseum") {
    return "https://archives.bulbagarden.net/media/upload/thumb/c/c0/Colosseum_Wes.png/250px-Colosseum_Wes.png";
  }
  if (stem === "xd") {
    return "https://archives.bulbagarden.net/media/upload/thumb/3/35/XD_Michael.png/180px-XD_Michael.png";
  }
  const base = "https://play.pokemonshowdown.com/sprites/trainers";
  if (stem === "ruby" || stem === "sapphire") {
    return `${base}/${gender === "female" ? "may-gen3rs" : "brendan-gen3rs"}.png`;
  }
  if (stem === "emerald") {
    return `${base}/${gender === "female" ? "may-gen3" : "brendan-gen3"}.png`;
  }
  if (stem === "diamond") {
    return `${base}/${gender === "female" ? "dawn" : "lucas"}.png`;
  }
  return `${base}/${gender === "female" ? "leaf-gen3" : "red-gen3"}.png`;
}

export function trainerCharacterName(stem: GameStem, gender: "male" | "female"): string {
  if (stem === "colosseum") return "Wes";
  if (stem === "xd") return "Michael";
  if (stem === "firered" || stem === "leafgreen") {
    return gender === "female" ? "Leaf" : "Red";
  }
  if (stem === "diamond") return gender === "female" ? "Dawn" : "Lucas";
  return gender === "female" ? "May" : "Brendan";
}

// Whether the trainer art is a crisp pixel sprite (GBA games — render with
// `imageRendering: pixelated`) or a smooth character illustration (GameCube
// and DS games — keep the browser's default smoothing).
export function trainerArtIsPixelated(stem: GameStem): boolean {
  return stem !== "colosseum" && stem !== "xd" && stem !== "diamond";
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
