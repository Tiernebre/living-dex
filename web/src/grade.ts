import type { StatBlock, StatKey } from "./data";
import { natureEffect } from "./stats";

export type Grade = "S+" | "S" | "A" | "B" | "C" | "D" | "F";

// Weight of a nature's +stat by its rank among non-HP base stats (1 = highest).
// Ties share the rank of the topmost tied value.
const PLUS_RANK_WEIGHT = [1.0, 0.88, 0.75, 0.55, 0.4];
// For the -stat, being lowest is best.
const MINUS_RANK_WEIGHT = [0.4, 0.55, 0.75, 0.88, 1.0];

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
  const factor = (PLUS_RANK_WEIGHT[plusRank - 1] + MINUS_RANK_WEIGHT[minusRank - 1]) / 2;
  return { factor, plusRank, minusRank, neutral: false };
}

export const GRADE_THRESHOLDS: { grade: Grade; min: number }[] = [
  { grade: "S+", min: 108 },
  { grade: "S", min: 96 },
  { grade: "A", min: 82 },
  { grade: "B", min: 60 },
  { grade: "C", min: 45 },
  { grade: "D", min: 30 },
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
  const nat = natureFitScore(nature, base);

  const ivScore = (ivSum / 186) * 100 + perfectCount * 2 + greenCount * 1;
  const total = ivScore * nat.factor;

  let grade: Grade;
  if (perfectCount === 6 && nat.factor >= 0.88) grade = "S+";
  else if (total >= 108) grade = "S+";
  else if (total >= 96) grade = "S";
  else if (total >= 82) grade = "A";
  else if (total >= 60) grade = "B";
  else if (total >= 45) grade = "C";
  else if (total >= 30) grade = "D";
  else grade = "F";

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
