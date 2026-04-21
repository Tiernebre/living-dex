import type { StatBlock, StatKey } from "./data";
import { natureEffect } from "./stats";

export type Grade = "S+" | "S" | "A" | "B" | "C" | "D" | "F";

// Base weight from the +stat's rank among the mon's non-HP stats (1 = highest).
// A nature is primarily "good" if it boosts a top stat; the −stat only matters
// when it's lowering something the mon actually uses (e.g. Adamant on
// Salamence is great — the dropped SpA is irrelevant).
const PLUS_RANK_WEIGHT = [1.0, 0.92, 0.75, 0.55, 0.4];
const MINUS_RANK_PENALTY = [0.2, 0.12, 0.05, 0, 0];

function statRank(stat: StatKey, base: StatBlock): number {
  const v = base[stat];
  let better = 0;
  for (const k of ["atk", "def", "spa", "spd", "spe"] as StatKey[]) {
    if (base[k] > v) better++;
  }
  return better + 1; // 1..5
}

export function natureFitScore(
  nature: string,
  base: StatBlock,
): {
  factor: number;
  plusRank: number | null;
  minusRank: number | null;
  neutral: boolean;
} {
  const effect = natureEffect(nature);
  if (!effect) return { factor: 0.85, plusRank: null, minusRank: null, neutral: true };
  const plusRank = statRank(effect.plus, base);
  const minusRank = statRank(effect.minus, base);
  const factor = Math.max(
    0.3,
    PLUS_RANK_WEIGHT[plusRank - 1] - MINUS_RANK_PENALTY[minusRank - 1],
  );
  return { factor, plusRank, minusRank, neutral: false };
}

// S+ is reserved for a flawless mon (6×31 IVs with a nature that fits the
// species) and is awarded through an auto-rule rather than a score threshold.
// The thresholds below cover S and down; middle grades are pulled in so a
// typical wild mon lands around C instead of D/F.
export const GRADE_THRESHOLDS: { grade: Grade; min: number }[] = [
  { grade: "S", min: 95 },
  { grade: "A", min: 78 },
  { grade: "B", min: 58 },
  { grade: "C", min: 38 },
  { grade: "D", min: 20 },
  { grade: "F", min: 0 },
];

export function gradePokemon(
  ivs: StatBlock,
  nature: string,
  base: StatBlock,
): {
  grade: Grade;
  ivSum: number;
  greenCount: number;
  perfectCount: number;
  ivScore: number;
  total: number;
  nature: ReturnType<typeof natureFitScore>;
} {
  const ivVals = (["hp", "atk", "def", "spa", "spd", "spe"] as StatKey[]).map((k) => ivs[k]);
  const ivSum = ivVals.reduce((a, b) => a + b, 0);
  const greenCount = ivVals.filter((v) => v >= 26).length;
  const perfectCount = ivVals.filter((v) => v === 31).length;
  const minIv = Math.min(...ivVals);
  const nat = natureFitScore(nature, base);

  const ivScore = (ivSum / 186) * 100 + perfectCount * 2 + greenCount * 1;
  const total = ivScore * nat.factor;

  // S+ = near-flawless Pokémon. A 30 IV is effectively perfect (1 point off
  // at Lv100), so requiring literal 6×31 is too strict — a mon with all IVs
  // ≥25 and a fit nature deserves the top grade.
  const nearFlawless = ivSum >= 175 && minIv >= 25 && nat.factor >= 0.85;

  let grade: Grade;
  if (nearFlawless) grade = "S+";
  else {
    grade = "F";
    for (const t of GRADE_THRESHOLDS) {
      if (total >= t.min) {
        grade = t.grade;
        break;
      }
    }
  }

  return { grade, ivSum, greenCount, perfectCount, ivScore, total, nature: nat };
}

export const GRADE_CARD_CLASS: Partial<Record<Grade, string>> = {
  "S+": "grade-card grade-card-SPLUS",
  S: "grade-card grade-card-S",
  A: "grade-card grade-card-A",
  B: "grade-card grade-card-B",
};

export const GRADE_STYLE: Record<Grade, { bg: string; fg: string; ring: string }> = {
  "S+": { bg: "linear-gradient(135deg,#fde68a,#f59e0b)", fg: "#3f2d04", ring: "#f59e0b" },
  S: { bg: "linear-gradient(135deg,#fef3c7,#eab308)", fg: "#422c05", ring: "#eab308" },
  A: { bg: "linear-gradient(135deg,#fde68a,#fbbf24)", fg: "#3f2d04", ring: "#f59e0b" },
  B: { bg: "linear-gradient(135deg,#bfdbfe,#3b82f6)", fg: "#0b1f44", ring: "#3b82f6" },
  C: { bg: "linear-gradient(135deg,#e5e7eb,#9ca3af)", fg: "#1f2937", ring: "#9ca3af" },
  D: { bg: "linear-gradient(135deg,#fed7aa,#f97316)", fg: "#3b1d05", ring: "#f97316" },
  F: { bg: "linear-gradient(135deg,#fecaca,#ef4444)", fg: "#450a0a", ring: "#ef4444" },
};

export const CONFETTI_COLORS = [
  "#f59e0b", "#fde68a", "#fbbf24", "#ef4444", "#3b82f6", "#22c55e", "#ec4899", "#a855f7",
];
