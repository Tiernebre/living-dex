import type { GameStem } from "../../hub/protocol.ts";
import { GAME_STEMS } from "../../hub/protocol.ts";
import { hoennDex } from "./data";

export const CODE_TO_STEM: Record<string, GameStem> = {
  AXVE: "ruby",
  AXPE: "sapphire",
  BPEE: "emerald",
  BPRE: "firered",
  BPGE: "leafgreen",
};

export const GAME_DISPLAY_NAME: Record<GameStem, string> = {
  ruby: "Ruby",
  sapphire: "Sapphire",
  emerald: "Emerald",
  firered: "FireRed",
  leafgreen: "LeafGreen",
  box: "Pokémon Box",
  colosseum: "Colosseum",
  xd: "XD: Gale of Darkness",
};

// The challenge (README) progresses Sapphire → ... → B/W2. Gen 3 is what we can decode
// today; later gens exist here as a roadmap so the dashboard can show the whole chain.
// Mascots are national dex numbers for the version legendary — uses the existing
// HybridShivam thumbnail CDN so we don't need game box art.
export type ChainStep = {
  stem: GameStem | null;
  label: string;
  short?: string;
  mascots: number[];
  tint: string;
  gen: 3 | 4 | 5;
  stage: number;
  primary?: boolean;
  endOfGen?: boolean;
  external?: boolean;
  // Replaces the handheld 4★ trainer-card breakdown for games that don't
  // have a trainer card (Colosseum, XD). Each entry becomes a row in the
  // stars popover on the dashboard card.
  primaryGoals?: { label: string; detail: string }[];
};

// Ordered by North American release date — the challenge is played as if
// re-living each release year in sequence. See README.md "Challenges".
export const CHALLENGE_CHAIN: ChainStep[] = [
  // Stage 1 — 2003-03 (Gen 3)
  { stem: "ruby",      gen: 3, stage: 1, label: "Ruby",       mascots: [383], tint: "#dc2626" },
  { stem: "sapphire",  gen: 3, stage: 1, label: "Sapphire",   mascots: [382], tint: "#2563eb", primary: true },
  // Stage 2 — 2003-11 (Gen 3 · GameCube)
  { stem: "colosseum", gen: 3, stage: 2, label: "Colosseum", mascots: [197, 196], tint: "#9333ea", primary: true, external: true,
    primaryGoals: [
      { label: "Story", detail: "Beat the main story (defeat Evice at Realgam Tower)" },
      { label: "Shadow Pokémon", detail: "Snag and purify all 48 Shadow Pokémon" },
      { label: "Mt. Battle", detail: "Clear all 100 trainers in Mt. Battle single-battle mode" },
      { label: "Orre Colosseum", detail: "Win every cup in Orre Colosseum" },
    ] },
  // Stage 3 — 2004-09 (Gen 3)
  { stem: "firered",   gen: 3, stage: 3, label: "FireRed",    mascots: [6],   tint: "#ea580c" },
  { stem: "leafgreen", gen: 3, stage: 3, label: "LeafGreen",  mascots: [3],   tint: "#16a34a", primary: true },
  { stem: "box",       gen: 3, stage: 3, label: "Pokémon Box", short: "Box", mascots: [251], tint: "#6366f1", external: true },
  // Stage 4 — 2005-05 (Gen 3)
  { stem: "emerald",   gen: 3, stage: 4, label: "Emerald",    mascots: [384], tint: "#059669", primary: true, endOfGen: true },
  // Stage 5 — 2005-10 (Gen 3 · GameCube)
  { stem: "xd", gen: 3, stage: 5, label: "XD: Gale of Darkness", short: "XD", mascots: [249], tint: "#4c1d95", primary: true, external: true,
    primaryGoals: [
      { label: "Story", detail: "Beat the main story (defeat Greevil at Citadark Isle)" },
      { label: "Shadow Pokémon", detail: "Snag and purify all 83 Shadow Pokémon" },
      { label: "Mt. Battle", detail: "Clear all 100 trainers in Mt. Battle" },
      { label: "Orre Colosseum", detail: "Win every cup in Orre Colosseum" },
      { label: "Battle CDs", detail: "Clear all 60 Battle CDs" },
    ] },
  // Stage 6 — 2007-04 (Gen 4)
  { stem: null, gen: 4, stage: 6, label: "Diamond",   mascots: [483], tint: "#38bdf8", primary: true },
  { stem: null, gen: 4, stage: 6, label: "Pearl",     mascots: [484], tint: "#f9a8d4" },
  // Stage 7 — 2009-03 (Gen 4)
  { stem: null, gen: 4, stage: 7, label: "Platinum",  mascots: [487], tint: "#a855f7", primary: true },
  // Stage 8 — 2010-03 (Gen 4)
  { stem: null, gen: 4, stage: 8, label: "HeartGold", mascots: [250], tint: "#f59e0b", primary: true, endOfGen: true },
  { stem: null, gen: 4, stage: 8, label: "SoulSilver", mascots: [249], tint: "#cbd5e1" },
  // Stage 9 — 2011-03 (Gen 5)
  { stem: null, gen: 5, stage: 9, label: "White",     mascots: [643], tint: "#e5e7eb", primary: true },
  { stem: null, gen: 5, stage: 9, label: "Black",     mascots: [644], tint: "#1f2937" },
  // Stage 10 — 2012-10 (Gen 5)
  { stem: null, gen: 5, stage: 10, label: "Black 2",  mascots: [644], tint: "#0ea5e9", primary: true, endOfGen: true },
  { stem: null, gen: 5, stage: 10, label: "White 2",  mascots: [643], tint: "#6b7280" },
];

export const GEN_LABELS: Record<3 | 4 | 5, string> = {
  3: "Generation III · Hoenn, Kanto & Orre",
  4: "Generation IV · Sinnoh & Johto",
  5: "Generation V · Unova",
};

export const GEN3_NATIONAL_TOTAL = 386;
const KANTO_DEX_TOTAL = 151;

export function isGameStem(s: string): s is GameStem {
  return (GAME_STEMS as readonly string[]).includes(s);
}

// Regional-dex completion target for a primary game's 4★ trainer card.
// Only Gen 3 games have parsers right now — later-gen primaries fall through.
export function regionalDexProgress(
  stem: GameStem,
  owned: Set<number>,
): { caught: number; total: number } | null {
  if (stem === "firered" || stem === "leafgreen") {
    let caught = 0;
    for (let n = 1; n <= KANTO_DEX_TOTAL; n++) if (owned.has(n)) caught++;
    return { caught, total: KANTO_DEX_TOTAL };
  }
  if (stem === "ruby" || stem === "sapphire" || stem === "emerald") {
    let caught = 0;
    for (const entry of hoennDex) if (owned.has(entry.nationalDex)) caught++;
    return { caught, total: hoennDex.length };
  }
  return null;
}
