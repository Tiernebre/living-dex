import type { DecodedPokemon } from "../../hub/protocol.ts";
import type { GrowthRate, Species, StatBlock, StatKey } from "./data";

export const STATS = [
  ["hp", "HP"],
  ["atk", "Atk"],
  ["def", "Def"],
  ["spa", "SpA"],
  ["spd", "SpD"],
  ["spe", "Spe"],
] as const;

// Gen 3 nature table. Index matches hub/decoder/gen3.ts NATURES order.
// Natures where plus === minus are neutral (no effect).
const NATURE_STAT_ORDER: StatKey[] = ["atk", "def", "spe", "spa", "spd"];

export function natureEffect(nature: string): { plus: StatKey; minus: StatKey } | null {
  const names = [
    "Hardy", "Lonely", "Brave", "Adamant", "Naughty",
    "Bold", "Docile", "Relaxed", "Impish", "Lax",
    "Timid", "Hasty", "Serious", "Jolly", "Naive",
    "Modest", "Mild", "Quiet", "Bashful", "Rash",
    "Calm", "Gentle", "Sassy", "Careful", "Quirky",
  ];
  const idx = names.indexOf(nature);
  if (idx < 0) return null;
  const plus = NATURE_STAT_ORDER[Math.floor(idx / 5)];
  const minus = NATURE_STAT_ORDER[idx % 5];
  if (plus === minus) return null;
  return { plus, minus };
}

// Cumulative EXP to reach a given level for each growth curve.
// Formulas from Bulbapedia "Experience".
export function expForLevel(level: number, rate: GrowthRate): number {
  if (level <= 1) return 0;
  const n = level;
  const n3 = n * n * n;
  switch (rate) {
    case "fast":
      return Math.floor((4 * n3) / 5);
    case "medium":
      return n3;
    case "slow":
      return Math.floor((5 * n3) / 4);
    case "medium-slow":
      return Math.floor((6 * n3) / 5 - 15 * n * n + 100 * n - 140);
    case "slow-then-very-fast":
      if (n < 50) return Math.floor((n3 * (100 - n)) / 50);
      if (n < 68) return Math.floor((n3 * (150 - n)) / 100);
      if (n < 98) return Math.floor((n3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n3 * (160 - n)) / 100);
    case "fast-then-very-slow":
      if (n < 15) return Math.floor((n3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n < 36) return Math.floor((n3 * (n + 14)) / 50);
      return Math.floor((n3 * (Math.floor(n / 2) + 32)) / 50);
  }
}

// BoxPokemon (80-byte struct) has no party tail, so the decoder returns level=0.
// Derive it from experience using the species growth-rate curve.
export function levelFromExp(exp: number, rate: GrowthRate): number {
  let lo = 1,
    hi = 100;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (expForLevel(mid, rate) <= exp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function effectiveLevel(mon: DecodedPokemon, info: Species | null | undefined): number {
  if (mon.level > 0) return mon.level;
  if (!info) return 0;
  return levelFromExp(mon.experience, info.growthRate);
}

const HIDDEN_POWER_TYPES = [
  "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel",
  "fire", "water", "grass", "electric", "psychic", "ice", "dragon", "dark",
] as const;

export function hiddenPower(ivs: {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}): { type: string; power: number } {
  const a = ivs.hp & 1, b = ivs.atk & 1, c = ivs.def & 1;
  const d = ivs.spe & 1, e = ivs.spa & 1, f = ivs.spd & 1;
  const u = (ivs.hp >> 1) & 1, v = (ivs.atk >> 1) & 1, w = (ivs.def >> 1) & 1;
  const x = (ivs.spe >> 1) & 1, y = (ivs.spa >> 1) & 1, z = (ivs.spd >> 1) & 1;
  const typeIdx = Math.floor(((a + 2 * b + 4 * c + 8 * d + 16 * e + 32 * f) * 15) / 63);
  const power = Math.floor(((u + 2 * v + 4 * w + 8 * x + 16 * y + 32 * z) * 40) / 63) + 30;
  return { type: HIDDEN_POWER_TYPES[typeIdx], power };
}

// Gen 3 stat formula (Bulbapedia "Stat"):
//   HP    = floor((2*Base + IV + floor(EV/4)) * L/100) + L + 10
//   Other = floor((floor((2*Base + IV + floor(EV/4)) * L/100) + 5) * nature)
export function computeStats(
  base: StatBlock,
  ivs: StatBlock,
  evs: StatBlock,
  nature: string,
  level: number,
): StatBlock {
  const effect = natureEffect(nature);
  const out = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const [k] of STATS) {
    const common = Math.floor(((2 * base[k] + ivs[k] + Math.floor(evs[k] / 4)) * level) / 100);
    if (k === "hp") {
      out[k] = common + level + 10;
    } else {
      const mod = effect?.plus === k ? 1.1 : effect?.minus === k ? 0.9 : 1.0;
      out[k] = Math.floor((common + 5) * mod);
    }
  }
  return out;
}

export function ivStyle(v: number): { color?: string; weight?: number } {
  if (v === 31) return { color: "var(--iv-perfect)", weight: 700 };
  if (v >= 26) return { color: "var(--iv-great)", weight: 600 };
  if (v >= 16) return {};
  if (v >= 1) return { color: "var(--iv-low)" };
  return { color: "var(--iv-worst)", weight: 600 };
}

export function ivLabel(v: number): string {
  if (v === 31) return "Perfect (31)";
  if (v >= 26) return `Great (${v})`;
  if (v >= 16) return `Decent (${v})`;
  if (v >= 1) return `Low (${v})`;
  return "Worst (0)";
}
